"use client"

import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { fetchCars } from "@/store/carSlice"
import { fetchDispatchLocations, selectDispatchRadius, fetchAvailabilityFromFirestore } from "@/store/dispatchSlice"
import { selectCar } from "@/store/userSlice"
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager"
import CarCardGroup, { type CarGroup } from "./CarCardGroup"
import type { Car } from "@/types/cars"

/**
 * CarGrid props.
 */
interface CarGridProps {
  className?: string
  isVisible?: boolean
  /** If a car was scanned, we override the normal availableCars logic. */
  isQrScanStation?: boolean
  scannedCar?: Car | null
}

// State for tracking model preload status
const modelPreloadState: Record<string, boolean> = {};

// Preload common car models that we know will be used frequently
export function preloadCommonCarModels() {
  const commonModels = ["/cars/kona.glb", "/cars/defaultModel.glb"];
  commonModels.forEach(url => {
    if (!modelPreloadState[url]) {
      // Create a lightweight preload
      const image = new Image();
      image.src = url;
      modelPreloadState[url] = true;
      console.log(`[CarGrid] Preloaded car model: ${url}`);
    }
  });
}

// Memoized empty state component for consistent styling
const EmptyState = memo(({ isQrScanStation }: { isQrScanStation: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
    className="rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm p-3 flex items-center justify-center h-32"
  >
    <div className="text-center">
      <p className="text-gray-400 text-sm">
        {isQrScanStation ? "Car not found or not in range" : "No cars available right now. Please check again later."}
      </p>
    </div>
  </motion.div>
))
EmptyState.displayName = "EmptyState"

// Memoized loading skeleton for consistent styling
const LoadingSkeleton = memo(() => (
  <div className="rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm h-32 w-full animate-pulse flex items-center justify-center">
    <div className="text-xs text-gray-400">Loading vehicles...</div>
  </div>
))
LoadingSkeleton.displayName = "LoadingSkeleton"

/**
 * Optimized CarGrid component with improved performance:
 * - Aggressive caching of expensive operations
 * - Reduced re-renders with memoization
 * - Improved loading and error states
 * - Better resource management
 * - Race condition protection
 * - Proper cleanup on unmount
 */
function CarGrid({ className = "", isVisible = true, isQrScanStation = false, scannedCar = null }: CarGridProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)
  const dispatchRadius = useAppSelector(selectDispatchRadius)

  // State tracking
  const [componentState, setComponentState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [dataFreshness, setDataFreshness] = useState(0) // Used to track data freshness
  
  // Refs for tracking component lifecycle and preventing unnecessary operations
  const mountedRef = useRef(true)
  const fetchCallRef = useRef(0)
  const lastFetchTimeRef = useRef(0)
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Auto select car timer
  const autoSelectTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Efficiently get and memoize available cars from Redux
  const availableCarsForDispatch = useAvailableCarsForDispatch()
  
  // Decide which cars to display - memoized based on relevant dependencies only
  const availableCars = useMemo(() => {
    // Allow override when in QR scan mode
    if (isQrScanStation && scannedCar) {
      return [scannedCar]
    }
    
    // Otherwise use cars from dispatch logic
    return availableCarsForDispatch
  }, [isQrScanStation, scannedCar, availableCarsForDispatch])
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Optimized fetch function with safeguards against race conditions
  const fetchData = useCallback(async () => {
    // Skip fetching for QR scanned cars
    if (isQrScanStation && scannedCar) return
    
    // Prevent fetching when not visible
    if (!isVisible) return
    
    // Throttle fetch calls
    const now = Date.now()
    const FETCH_COOLDOWN = 10000 // 10 seconds minimum between fetches
    if (now - lastFetchTimeRef.current <= FETCH_COOLDOWN) {
      console.log("[CarGrid] Skipping fetch due to cooldown")
      return
    }
    
    // Abort if component unmounted
    if (!mountedRef.current) return
    
    // Track this fetch attempt
    const currentFetchId = ++fetchCallRef.current
    lastFetchTimeRef.current = now
    
    // Clear any previous error
    setLoadingError(null)
    
    console.log("[CarGrid] Fetching cars and dispatch data...")
    
    try {
      // Run these in parallel
      await Promise.all([
        dispatch(fetchCars()),
        dispatch(fetchDispatchLocations())
      ])
      
      // Only load availability if still the current fetch
      if (currentFetchId === fetchCallRef.current && mountedRef.current) {
        await dispatch(fetchAvailabilityFromFirestore())
      }
      
      // If component is still mounted and this is still the current fetch
      if (mountedRef.current && currentFetchId === fetchCallRef.current) {
        setComponentState('loaded')
        setDataFreshness(prev => prev + 1) // Increment to signal fresh data
        console.log("[CarGrid] Data fetched successfully")
      }
    } catch (err) {
      console.error("[CarGrid] Fetch error:", err)
      
      // Only update state if this is still the current fetch
      if (mountedRef.current && currentFetchId === fetchCallRef.current) {
        setComponentState('error')
        setLoadingError(err instanceof Error ? err.message : "Failed to load vehicles")
      }
    }
  }, [dispatch, isQrScanStation, scannedCar, isVisible])
  
  // Group cars by model – memoized based on availableCars only
  const groupedByModel = useMemo(() => {
    // Skip expensive calculations if component isn't visible
    if (!isVisible || availableCars.length === 0) {
      return []
    }
    
    // Special case for QR scan
    if (isQrScanStation && scannedCar) {
      return [{ model: scannedCar.model || "Scanned Car", cars: [scannedCar] }]
    }
    
    // Group cars by model
    const groups = availableCars.reduce((acc, car) => {
      const key = car.model || "Unknown Model"
      if (!acc[key]) {
        acc[key] = { model: key, cars: [] }
      }
      if (acc[key].cars.length < 10) { // Limit to 10 cars per group
        acc[key].cars.push(car)
      }
      return acc
    }, {} as Record<string, CarGroup>)
    
    return Object.values(groups).slice(0, 5) // Limit to 5 groups
  }, [availableCars, isVisible, isQrScanStation, scannedCar])
  
  // Optimize visibility changes with timeouts to avoid flicker
  useEffect(() => {
    // Cancel existing visibility timeout if any
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current)
      visibilityTimeoutRef.current = null
    }
    
    if (isVisible) {
      // Component is visible, check if we need to fetch data
      const now = Date.now()
      const FETCH_COOLDOWN = 30000 // 30 seconds between fetches
      const timeSinceLastFetch = now - lastFetchTimeRef.current
      
      if (componentState === 'idle' || timeSinceLastFetch > FETCH_COOLDOWN) {
        // Skip loading state if we have a scanned car
        if (isQrScanStation && scannedCar) {
          setComponentState('loaded')
        } else {
          setComponentState('loading')
          fetchData()
        }
      }
    } else {
      // Use timeout when hiding to prevent flickering during quick transitions
      visibilityTimeoutRef.current = setTimeout(() => {
        // No need to change state when hidden - preserve loaded state
      }, 300)
    }
    
    // Cleanup on unmount
    return () => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }
    }
  }, [isVisible, componentState, isQrScanStation, scannedCar, fetchData])

  // Track component lifecycle
  useEffect(() => {
    // Mark as mounted
    mountedRef.current = true
    
    // Load common models on first mount
    preloadCommonCarModels()
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false
      
      // Clear all timers
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }
      
      if (autoSelectTimerRef.current) {
        clearTimeout(autoSelectTimerRef.current)
      }
    }
  }, [])
  
  // Auto-select first available car if none selected
  useEffect(() => {
    // Skip if no cars, component not visible, or car already selected
    if (!isVisible || 
        availableCars.length === 0 || 
        selectedCarId || 
        componentState !== 'loaded') {
      return
    }
    
    // Check if selected car is still in available list
    const isSelectedCarAvailable = availableCars.some(car => car.id === selectedCarId)
    
    // Only auto-select if no car selected or if selected car no longer available
    if (!selectedCarId || !isSelectedCarAvailable) {
      // Add small delay to avoid selection during transitions
      if (autoSelectTimerRef.current) {
        clearTimeout(autoSelectTimerRef.current)
      }
      
      autoSelectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && availableCars.length > 0) {
          console.log("[CarGrid] Auto-selecting car:", availableCars[0].id)
          dispatch(selectCar(availableCars[0].id))
        }
      }, 300)
    }
    
    return () => {
      if (autoSelectTimerRef.current) {
        clearTimeout(autoSelectTimerRef.current)
      }
    }
  }, [availableCars, selectedCarId, dispatch, isVisible, componentState])

  // Early return if not visible (after all hooks are defined)
  if (!isVisible) {
    return null;
  }
  
  // Show different UI based on component state
  if (componentState === 'loading' && !isQrScanStation) {
    return <LoadingSkeleton />;
  }
  
  if (componentState === 'error') {
    return (
      <div className="rounded-lg border border-red-800 bg-gray-900/50 backdrop-blur-sm p-3 flex items-center justify-center h-32">
        <div className="text-center">
          <p className="text-red-400 text-sm">{loadingError || "Failed to load vehicles"}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={className} ref={containerRef}>
      {groupedByModel.length > 0 ? (
        <div className="py-1">
          <AnimatePresence>
            {groupedByModel.map((group, index) => (
              <motion.div
                key={`${group.model}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <CarCardGroup
                  key={`group-${group.model}`}
                  group={group}
                  isVisible={true}
                  rootRef={containerRef}
                  isQrScanStation={isQrScanStation}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState isQrScanStation={isQrScanStation} />
      )}
    </div>
  )
}

// Use React.memo with custom comparison to prevent unnecessary re-renders
export default memo(CarGrid, (prev, next) => {
  // Only re-render if these props change
  return (
    prev.isVisible === next.isVisible &&
    prev.isQrScanStation === next.isQrScanStation &&
    prev.scannedCar === next.scannedCar
  )
})