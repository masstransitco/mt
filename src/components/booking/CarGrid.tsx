"use client"

import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { fetchCars } from "@/store/carSlice"
import { fetchDispatchLocations, selectDispatchRadius, fetchAvailabilityFromFirestore } from "@/store/dispatchSlice"
import { selectCar } from "@/store/userSlice"
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager"
import CarCardGroup, { type CarGroup } from "./CarCardGroup"
import EmptyCarState from "@/components/EmptyCarState"
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

// Preload common car models that we know will be used frequently
const modelPreloadState: Record<string, boolean> = {}
export function preloadCommonCarModels() {
  const commonModels = ["/cars/kona.glb", "/cars/defaultModel.glb"]
  commonModels.forEach((url) => {
    if (!modelPreloadState[url]) {
      const image = new Image()
      image.src = url
      modelPreloadState[url] = true
      console.log(`[CarGrid] Preloaded car model: ${url}`)
    }
  })
}

// Memoized loading skeleton for consistent styling
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

/**
 * Main CarGrid component.
 * - Fetches cars and dispatch data using a single debounce in a useEffect.
 * - Auto-selects the first available car if none is selected.
 * - Groups cars by model with a simple grouping logic.
 */
function CarGrid({ className = "", isVisible = true, isQrScanStation = false, scannedCar = null }: CarGridProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)
  const dispatchRadius = useAppSelector(selectDispatchRadius)

  // Local loading and initialization state
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Get available cars from the store (or override with scannedCar)
  const availableCarsForDispatch = useAvailableCarsForDispatch()
  const availableCars = useMemo(() => {
    return isQrScanStation && scannedCar ? [scannedCar] : availableCarsForDispatch
  }, [isQrScanStation, scannedCar, availableCarsForDispatch])

  const containerRef = useRef<HTMLDivElement>(null)
  const lastFetchTimeRef = useRef(0)
  const isMountedRef = useRef(true)
  const autoSelectTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Skip fetching if in QR mode with a scanned car
  const shouldSkipFetching = isQrScanStation && scannedCar

  // Preload common models on mount
  useEffect(() => {
    if (!initialized) {
      preloadCommonCarModels()
    }
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current)
    }
  }, [initialized])

  // Single fetch effect (debounced by 60 seconds)
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
    lastFetchTimeRef.current = Date.now()
    try {
      // Batch API calls together
      await Promise.all([dispatch(fetchCars()), dispatch(fetchDispatchLocations())])
      await dispatch(fetchAvailabilityFromFirestore())
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

  useEffect(() => {
    if (!isVisible) return
    // If not initialized or data is stale (> 60 seconds), fetch new data.
    if (!initialized || Date.now() - lastFetchTimeRef.current > 60000) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [isVisible, fetchData, initialized])

  // Consolidated auto-select effect: auto-select the first available car when data is loaded.
  useEffect(() => {
    if (!isVisible || availableCars.length === 0 || selectedCarId) return
    console.log("[CarGrid] Auto-selecting car:", availableCars[0].id)
    dispatch(selectCar(availableCars[0].id))
  }, [availableCars, selectedCarId, dispatch, isVisible])

  // Group cars by model.
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible || availableCars.length === 0) return []
    if (isQrScanStation && scannedCar) {
      return [{ model: scannedCar.model || "Scanned Car", cars: [scannedCar] }]
    }
    const groups = availableCars.reduce(
      (acc, car) => {
        const key = car.model || "Unknown Model"
        if (!acc[key]) acc[key] = { model: key, cars: [] }
        // (Optional) Remove limit if not necessary.
        if (acc[key].cars.length < 10) acc[key].cars.push(car)
        return acc
      },
      {} as Record<string, CarGroup>,
    )
    // (Optional) Limit to 5 groups if needed.
    return Object.values(groups).slice(0, 5)
  }, [availableCars, isVisible, isQrScanStation, scannedCar])

  // Early return if not visible
  if (!isVisible) return null

  // Show loading skeleton during initial load
  if (loading && !initialized) return <LoadingSkeleton />

  // Show error state if fetch failed
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
    <div className={`w-full ${className}`} ref={containerRef}>
      {groupedByModel.length > 0 ? (
        <div className="w-full">
          <AnimatePresence>
            {groupedByModel.map((group, index) => (
              <motion.div
                key={`${group.model}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="w-full mb-2 last:mb-0"
              >
                <CarCardGroup group={group} isVisible={true} rootRef={containerRef} isQrScanStation={isQrScanStation} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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

