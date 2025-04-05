"use client"

import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { fetchCars } from "@/store/carSlice"
import { fetchDispatchLocations, selectDispatchRadius } from "@/store/dispatchSlice"
import { selectCar } from "@/store/userSlice"
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager"
import CarCardGroup, { type CarGroup } from "./CarCardGroup"
import EmptyCarState from "@/components/EmptyCarState"
import type { Car } from "@/types/cars"
import { useInView } from "react-intersection-observer"
import ModelManager from "@/lib/modelManager"
import { ChevronLeft } from "@/components/ui/icons/ChevronLeft"
import { ChevronRight } from "@/components/ui/icons/ChevronRight"

interface CarGridProps {
  className?: string
  isVisible?: boolean
  isQrScanStation?: boolean
  scannedCar?: Car | null
}

// Proper model preloading
function preloadCommonCarModels() {
  ModelManager.getInstance().preloadModels([
    "/cars/kona.glb", 
    "/cars/defaultModel.glb",
    "/cars/car2.glb",
    "/cars/car3.glb",
    "/cars/car4.glb"
  ]);
}

// Loading skeleton
const LoadingSkeleton = memo(() => (
  <div className="rounded-xl border border-white/10 bg-black/90 h-28 w-full overflow-hidden backdrop-blur-sm">
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 border-2 border-white/10 border-t-green-500 rounded-full animate-spin" />
        <div className="text-xs text-gray-400">Loading vehicles...</div>
      </div>
    </div>
  </div>
))
LoadingSkeleton.displayName = "LoadingSkeleton"

// Navigation button component
const NavButton = memo(({ direction, onClick, disabled }: { direction: "left" | "right"; onClick: () => void; disabled: boolean }) => (
  <button
    className={`absolute top-1/2 -translate-y-1/2 z-10 ${direction === "left" ? "left-1" : "right-1"} 
              h-8 w-8 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center
              border border-white/20 text-white
              ${disabled ? "opacity-30 cursor-not-allowed" : "opacity-80 hover:opacity-100 cursor-pointer"}`}
    onClick={onClick}
    disabled={disabled}
    aria-label={direction === "left" ? "Previous car group" : "Next car group"}
  >
    {direction === "left" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
  </button>
))
NavButton.displayName = "NavButton"

function CarGrid({ className = "", isVisible = true, isQrScanStation = false, scannedCar = null }: CarGridProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)
  
  // Local state
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  
  // Get available cars with optimized hook
  const availableCarsForDispatch = useAvailableCarsForDispatch({ autoRefresh: true })
  const availableCars = useMemo(() => {
    return isQrScanStation && scannedCar ? [scannedCar] : availableCarsForDispatch
  }, [isQrScanStation, scannedCar, availableCarsForDispatch])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const fetchDataTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  // Set up IntersectionObserver for container visibility
  const [inViewRef, inView] = useInView({
    threshold: 0.1,
    triggerOnce: false
  })
  
  // Skip fetching if in QR mode with a scanned car
  const shouldSkipFetching = isQrScanStation && scannedCar
  
  // Initialize and cleanup
  useEffect(() => {
    if (!initialized) {
      preloadCommonCarModels()
    }
    
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (fetchDataTimeoutRef.current) clearTimeout(fetchDataTimeoutRef.current)
    }
  }, [initialized])
  
  // Optimized fetch data with better parallelization
  const fetchData = useCallback(async () => {
    if (shouldSkipFetching) {
      if (isMountedRef.current) {
        setLoading(false)
        setInitialized(true)
      }
      return
    }
    
    setLoading(true)
    setLoadingError(null)
    console.log("[CarGrid] Fetching cars and dispatch data...")
    
    try {
      // Fetch cars, dispatch locations, and availability in parallel
      const promises = [
        dispatch(fetchCars()),
        dispatch(fetchDispatchLocations())
      ]
      
      // Wait for all promises to resolve in parallel
      await Promise.all(promises)
      
      // Now fetch availability
      try {
        await dispatch(fetchAvailabilityFromFirestore())
      } catch (availErr) {
        console.warn("[CarGrid] Availability fetch warning:", availErr)
        // Continue even if this fails - we'll still have the cars
      }
      
      if (isMountedRef.current) {
        setLoading(false)
        setInitialized(true)
        console.log("[CarGrid] Data fetched successfully")
      }
    } catch (err) {
      console.error("[CarGrid] Fetch error:", err)
      if (isMountedRef.current) {
        setLoadingError(err instanceof Error ? err.message : "Failed to load vehicles")
        setLoading(false)
      }
    }
  }, [dispatch, shouldSkipFetching])
  
  // Fetch data when component becomes visible and not already initialized
  useEffect(() => {
    // Check visibility conditions
    if (!isVisible || !inView) return
    
    // Only fetch when not initialized
    if (!initialized) {
      fetchData()
    } else {
      setLoading(false) // Already initialized
    }
  }, [isVisible, inView, fetchData, initialized])
  
  // Auto-select first car effect
  useEffect(() => {
    if (!isVisible || availableCars.length === 0 || selectedCarId) return
    dispatch(selectCar(availableCars[0].id))
  }, [availableCars, selectedCarId, dispatch, isVisible])
  
  // Force stop loading if we have cars
  useEffect(() => {
    if (availableCars.length > 0 && loading) {
      console.log("[CarGrid] Cars available, stopping loading state")
      setLoading(false)
      setInitialized(true)
    }
  }, [availableCars, loading])
  
  // Group cars by model with better memoization
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible || availableCars.length === 0) return []
    
    if (isQrScanStation && scannedCar) {
      return [{ model: scannedCar.model || "Scanned Car", cars: [scannedCar] }]
    }
    
    // Group cars by model
    const groups: Record<string, CarGroup> = {}
    availableCars.forEach(car => {
      const key = car.model || "Unknown Model"
      if (!groups[key]) {
        groups[key] = { model: key, cars: [] }
      }
      // No arbitrary limits, take all cars
      groups[key].cars.push(car)
    })
    
    return Object.values(groups)
  }, [availableCars, isVisible, isQrScanStation, scannedCar])
  
  // Navigation handlers
  const goToPrevGroup = useCallback(() => {
    setCurrentGroupIndex(curr => (curr > 0 ? curr - 1 : curr))
  }, [])
  
  const goToNextGroup = useCallback(() => {
    setCurrentGroupIndex(curr => (curr < groupedByModel.length - 1 ? curr + 1 : curr))
  }, [groupedByModel.length])
  
  // Reset current group index when model groups change
  useEffect(() => {
    if (groupedByModel.length > 0 && currentGroupIndex >= groupedByModel.length) {
      setCurrentGroupIndex(0)
    }
  }, [groupedByModel.length, currentGroupIndex])
  
  // Early return if not visible
  if (!isVisible) return null
  
  // Show loading state or error
  if (loading && !initialized) return <LoadingSkeleton />
  
  if (loadingError) {
    return (
      <div className="rounded-xl border border-red-800 bg-black/90 p-4 flex items-center justify-center h-32 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-red-400 text-sm">{loadingError}</p>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={`w-full relative ${className}`} 
      ref={(el) => {
        containerRef.current = el
        inViewRef(el) // Connect with inView
      }}
    >
      {groupedByModel.length > 0 ? (
        <>
          {/* Car navigation arrows */}
          {groupedByModel.length > 1 && (
            <>
              <NavButton 
                direction="left" 
                onClick={goToPrevGroup} 
                disabled={currentGroupIndex === 0} 
              />
              <NavButton 
                direction="right" 
                onClick={goToNextGroup} 
                disabled={currentGroupIndex === groupedByModel.length - 1} 
              />
            </>
          )}
          
          {/* Group indicator dots */}
          {groupedByModel.length > 1 && (
            <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 flex items-center space-x-1.5">
              {groupedByModel.map((_, index) => (
                <button
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentGroupIndex 
                      ? "bg-white w-2.5" 
                      : "bg-white/40 hover:bg-white/60"
                  }`}
                  onClick={() => setCurrentGroupIndex(index)}
                  aria-label={`Go to car group ${index + 1}`}
                />
              ))}
            </div>
          )}
          
          {/* Car groups container */}
          <div className="overflow-hidden w-full">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={currentGroupIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full"
              >
                <CarCardGroup 
                  group={groupedByModel[currentGroupIndex]} 
                  isVisible={inView} 
                  rootRef={containerRef} 
                  isQrScanStation={isQrScanStation} 
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      ) : (
        <EmptyCarState isQrScanStation={isQrScanStation} />
      )}
    </div>
  )
}

export default memo(CarGrid, (prev, next) => {
  return (
    prev.isVisible === next.isVisible &&
    prev.isQrScanStation === next.isQrScanStation &&
    prev.scannedCar === next.scannedCar
  )
})