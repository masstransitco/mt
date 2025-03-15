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
 * Main CarGrid component that fetches cars & dispatch data, then displays them in groups.
 * Optimized for performance and memory usage.
 */
function CarGrid({ className = "", isVisible = true, isQrScanStation = false, scannedCar = null }: CarGridProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)
  const dispatchRadius = useAppSelector(selectDispatchRadius)

  // Track render count for debugging
  const renderCountRef = useRef(0)

  // Our primary "available cars" from the store - memoized to prevent unnecessary recalculations
  const availableCarsForDispatch = useAvailableCarsForDispatch()
  const availableCars = useMemo(() => {
    // If in QR mode, override the normal list with just the scannedCar
    if (isQrScanStation && scannedCar) {
      return [scannedCar]
    }
    return availableCarsForDispatch
  }, [isQrScanStation, scannedCar, availableCarsForDispatch])

  const containerRef = useRef<HTMLDivElement>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Track the last fetch time to avoid too frequent API calls
  const lastFetchTimeRef = useRef(0)

  // Skip data fetching for QR scanned cars
  const shouldSkipFetching = isQrScanStation && scannedCar

  // Memoized fetch function—runs only on mount
  const fetchData = useCallback(async () => {
    if (shouldSkipFetching) return

    const now = Date.now()
    const FETCH_COOLDOWN = 10000 // 10 seconds
    if (now - lastFetchTimeRef.current <= FETCH_COOLDOWN) {
      console.log("[CarGrid] Skipping fetch due to cooldown")
      return
    }
    console.log("[CarGrid] Fetching cars, dispatch locations, and availability...")
    lastFetchTimeRef.current = now
    try {
      await Promise.all([dispatch(fetchCars()), dispatch(fetchDispatchLocations())])
      await dispatch(fetchAvailabilityFromFirestore())
      console.log("[CarGrid] Data fetched successfully")
    } catch (err) {
      console.error("[CarGrid] Fetch error:", err)
    }
  }, [dispatch, shouldSkipFetching])

  // Run fetchData only once on mount (or when component becomes visible)
  useEffect(() => {
    if (!isVisible) return
    // Use a flag to ensure this effect runs only once
    if (isInitialLoad) {
      fetchData().finally(() => {
        setIsInitialLoad(false)
      })
    }
  }, [isVisible, fetchData, isInitialLoad])

  // Warn if in QR mode but no scanned car
  useEffect(() => {
    if (isQrScanStation && !scannedCar) {
      console.warn("[CarGrid] isQrScanStation is true but scannedCar is missing!")
    }
  }, [isQrScanStation, scannedCar])

  // Auto-select first available car if none selected
  useEffect(() => {
    if (!isVisible || availableCars.length === 0 || selectedCarId) return
    if (!availableCars.some(car => car.id === selectedCarId)) {
      console.log("[CarGrid] Auto-selecting car:", availableCars[0].id)
      dispatch(selectCar(availableCars[0].id))
    }
  }, [availableCars, selectedCarId, dispatch, isVisible])

  // Group cars by model – memoize based on availableCars only
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible) return []
    if (availableCars.length === 0) {
      console.log("[CarGrid] No available cars to group")
      return []
    }
    if (isQrScanStation && scannedCar) {
      return [{ model: scannedCar.model || "Scanned Car", cars: [scannedCar] }]
    }
    console.log("[CarGrid] Grouping", availableCars.length, "cars by model")
    const groups = availableCars.reduce((acc, car) => {
      const key = car.model || "Unknown Model"
      if (!acc[key]) {
        acc[key] = { model: key, cars: [] }
      }
      if (acc[key].cars.length < 10) {
        acc[key].cars.push(car)
      }
      return acc
    }, {} as Record<string, CarGroup>)
    return Object.values(groups).slice(0, 5)
  }, [availableCars, isVisible, isQrScanStation, scannedCar])

  // For debugging: count renders
  useEffect(() => {
    renderCountRef.current += 1
    if (renderCountRef.current > 5) {
      console.log(`[CarGrid] High render count: ${renderCountRef.current}`)
    }
  }, [])

  // Early return if not visible or still loading
  if (!isVisible) return null
  if (isInitialLoad) return <LoadingSkeleton />

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

export default memo(CarGrid, (prev, next) => {
  return (
    prev.isVisible === next.isVisible &&
    prev.isQrScanStation === next.isQrScanStation &&
    prev.scannedCar === next.scannedCar
  )
})
