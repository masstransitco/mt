"use client"

import React, { useEffect, useMemo, useState, useRef, useCallback, memo, MutableRefObject } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { fetchCars } from "@/store/carSlice"
import { fetchDispatchLocations, fetchAvailabilityFromFirestore } from "@/store/dispatchSlice"
import { selectCar } from "@/store/userSlice"
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager"
import EmptyCarState from "@/components/EmptyCarState"
import type { Car } from "@/types/cars"
import { useInView } from "react-intersection-observer"
import ModelManager from "@/lib/modelManager"
import { DynamicCarCardScene } from "./CarComponents"
import { CarSceneFallback } from "./SimpleFallback"

interface CarGridWithSceneProps {
  className?: string
  isVisible?: boolean
  isQrScanStation?: boolean
  scannedCar?: Car | null
}

// More efficient model preloading with prioritization
function preloadCommonCarModels() {
  // This is only called client-side already, but add an extra safety check
  if (typeof window === 'undefined') return
  
  try {
    const modelManager = ModelManager.getInstance();
    if (modelManager) {
      modelManager.preloadModels(['/cars/defaultModel.glb', '/cars/car2.glb', '/cars/car3.glb', '/cars/car4.glb']);
    }
  } catch (error) {
    console.warn('Error preloading car models:', error);
  }
}

// Loading skeleton
const LoadingSkeleton = memo(() => (
  <div className="rounded-xl border border-white/10 bg-black/90 h-60 w-full overflow-hidden backdrop-blur-sm">
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="w-6 h-6 border-2 border-white/10 border-t-green-500 rounded-full animate-spin" />
        <div className="text-xs text-gray-400">Loading vehicles...</div>
      </div>
    </div>
  </div>
))
LoadingSkeleton.displayName = "LoadingSkeleton"

function CarGridWithScene({ 
  className = "", 
  isVisible = true, 
  isQrScanStation = false, 
  scannedCar = null 
}: CarGridWithSceneProps) {
  const dispatch = useAppDispatch()
  
  // Local state
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  
  // Get available cars with optimized hook
  const availableCarsForDispatch = useAvailableCarsForDispatch({ autoRefresh: true })
  const availableCars = useMemo(() => {
    return isQrScanStation && !!scannedCar ? [scannedCar] : availableCarsForDispatch
  }, [isQrScanStation, scannedCar, availableCarsForDispatch])
  
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fetchDataTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  // Set up IntersectionObserver for container visibility (client-side only)
  const [inViewRef, inView] = useInView({
    threshold: 0.1,
    triggerOnce: false,
    // Fallback to true so loading starts right away on initial render
    initialInView: true
  })
  
  // Skip fetching if in QR mode with a scanned car
  const shouldSkipFetching = isQrScanStation && !!scannedCar
  
  // Initialize and cleanup - client side only
  useEffect(() => {
    // Skip during server-side rendering
    if (!isBrowser) return
    
    if (!initialized) {
      // Only call preload on client-side
      setTimeout(() => {
        preloadCommonCarModels()
      }, 0)
    }
    
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (fetchDataTimeoutRef.current) clearTimeout(fetchDataTimeoutRef.current)
    }
  }, [initialized, isBrowser])
  
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
    console.log("[CarGridWithScene] Fetching cars and dispatch data...")
    
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
        console.warn("[CarGridWithScene] Availability fetch warning:", availErr)
        // Continue even if this fails - we'll still have the cars
      }
      
      if (isMountedRef.current) {
        setLoading(false)
        setInitialized(true)
        console.log("[CarGridWithScene] Data fetched successfully")
      }
    } catch (err) {
      console.error("[CarGridWithScene] Fetch error:", err)
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
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)
  useEffect(() => {
    if (!isVisible || availableCars.length === 0 || selectedCarId) return
    dispatch(selectCar(availableCars[0].id))
  }, [availableCars, selectedCarId, dispatch, isVisible])
  
  // Force stop loading if we have cars
  useEffect(() => {
    if (availableCars.length > 0 && loading) {
      console.log("[CarGridWithScene] Cars available, stopping loading state")
      setLoading(false)
      setInitialized(true)
    }
  }, [availableCars, loading])
  
  // Early return if not visible
  if (!isVisible) return null
  
  // Show loading state or error
  if (loading && !initialized) return <LoadingSkeleton />
  
  if (loadingError) {
    return (
      <CarSceneFallback message={loadingError} height="15rem" />
    )
  }
  
  // Safety check for React SSR
  if (!isBrowser) {
    return <CarSceneFallback message="Initializing..." height="15rem" />;
  }
  
  return (
    <div 
      className={`w-full relative ${className}`} 
      ref={(el) => {
        // Update ref and connect with InView
        containerRef.current = el
        if (el) inViewRef(el) // Connect with inView only if element exists
      }}
    >
      {availableCars.length > 0 ? (
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full rounded-xl overflow-hidden"
          >
            <DynamicCarCardScene 
              cars={availableCars} 
              isVisible={inView} 
              className="rounded-xl overflow-hidden"
            />
          </motion.div>
        </AnimatePresence>
      ) : (
        <EmptyCarState isQrScanStation={isQrScanStation} />
      )}
    </div>
  )
}

export default CarGridWithScene