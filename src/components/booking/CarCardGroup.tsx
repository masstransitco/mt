"use client"

import type React from "react"
import { memo, useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { selectCar } from "@/store/userSlice"
import { BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Gauge, Info } from "lucide-react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import type { Car } from "@/types/cars"

// Fallback skeleton while the 3D viewer loads
const ViewerSkeleton = memo(() => (
  <div className="relative w-full h-full bg-gray-900/30 rounded-lg overflow-hidden">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-900/30 via-gray-800/30 to-gray-900/30" />
  </div>
))
ViewerSkeleton.displayName = "ViewerSkeleton"

export interface CarGroup {
  model: string
  cars: Car[]
}

interface CarCardGroupProps {
  group: CarGroup
  isVisible?: boolean
  rootRef?: React.RefObject<HTMLDivElement>
  /** If true, we skip showing the "select car" dropdown, because there's only one scanned car. */
  isQrScanStation?: boolean
}

// Dynamically load Car3DViewer for better code splitting
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
})

/**
 * Optimized CarCardGroup component
 * - Uses IntersectionObserver to only load 3D models when visible
 * - Implements better memory management
 * - Reduces re-renders with memoization
 */
function CarCardGroup({ group, isVisible = true, rootRef, isQrScanStation = false }: CarCardGroupProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)

  // State for UI interactions
  const [showOdometerPopup, setShowOdometerPopup] = useState(false)
  const [shouldRender3D, setShouldRender3D] = useState(false)
  
  // Refs for tracking lifecycle and timeouts
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)

  // IntersectionObserver to load the 3D model only when visible
  // This significantly reduces memory usage by loading models on demand
  useEffect(() => {
    if (!isVisible) {
      setShouldRender3D(false)
      return
    }
    
    // Skip intersection handling if card element doesn't exist
    if (!cardRef.current) return

    // Clean up existing observer if any
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect()
      intersectionObserverRef.current = null
    }

    const options: IntersectionObserverInit = {
      threshold: 0.1, // 10% visibility is enough to trigger loading
      root: rootRef?.current ?? null,
    }

    // Create new observer
    intersectionObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setShouldRender3D(true)
          // Once triggered, no need to keep observing
          if (intersectionObserverRef.current) {
            intersectionObserverRef.current.disconnect()
          }
        }
      })
    }, options)

    // Start observing
    intersectionObserverRef.current.observe(cardRef.current)

    // Clean up
    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect()
      }
    }
  }, [isVisible, rootRef])

  // Cleanup popup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current)
      }
    }
  }, [])

  // Detect if the user has selected any car in this group
  const isGroupSelected = useMemo(() => {
    return selectedCarId && group.cars.some((c) => c.id === selectedCarId)
  }, [group.cars, selectedCarId])

  // Decide which car should be displayed
  const displayedCar = useMemo(() => {
    // For single car groups
    if (group.cars.length === 1) {
      return group.cars[0]
    }
    
    // If a car in this group is selected, show it
    const foundSelected = group.cars.find((c) => c.id === selectedCarId)
    
    // Fallback to first car if none selected
    return foundSelected || group.cars[0]
  }, [group.cars, selectedCarId])

  // Calculate battery indicators - memoized to prevent recalculation
  const { batteryPercentage, batteryIconColor, BatteryIcon } = useMemo(() => {
    const rawBattery = displayedCar.electric_battery_percentage_left
    const parsed = rawBattery != null ? Number(rawBattery) : Number.NaN
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90

    let Icon = BatteryFull
    let color = "text-green-400"

    if (percentage <= 9) {
      Icon = BatteryWarning
      color = "text-red-500"
    } else if (percentage < 40) {
      Icon = BatteryLow
      color = "text-orange-400"
    } else if (percentage < 80) {
      Icon = BatteryMedium
      color = "text-lime-400"
    }

    return {
      batteryPercentage: percentage,
      batteryIconColor: color,
      BatteryIcon: Icon,
    }
  }, [displayedCar.electric_battery_percentage_left])

  // Get 3D model URL with fallback
  const modelUrl = displayedCar?.modelUrl || "/cars/defaultModel.glb"

  // Handle car selection - memoized callback
  const handleSelectCar = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const carId = Number.parseInt(e.target.value, 10)
      dispatch(selectCar(carId))
      setShowOdometerPopup(false)
    },
    [dispatch],
  )

  // Handle odometer info click
  const handleOdometerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowOdometerPopup((prev) => !prev)

    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current)
    }

    popupTimeoutRef.current = setTimeout(() => {
      setShowOdometerPopup(false)
    }, 3000)
  }, [])

  // Handle clicking on the card to select car
  const handleCardClick = useCallback(() => {
    if (!isGroupSelected && displayedCar) {
      dispatch(selectCar(displayedCar.id))
    }
  }, [isGroupSelected, displayedCar, dispatch])

  return (
    <motion.div
      ref={cardRef}
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isGroupSelected ? 1.0 : 0.98,
      }}
      transition={{ type: "tween", duration: 0.2 }}
      className="
        relative 
        overflow-hidden 
        rounded-lg 
        bg-gray-900/50 
        text-white 
        border border-gray-800 
        backdrop-blur-sm 
        shadow-md 
        transition-colors 
        cursor-pointer 
        mb-2 
        w-full
        h-32
      "
      style={{
        contain: "content",
      }}
    >
      {/* "Selected" badge if group is selected */}
      {isGroupSelected && (
        <div className="absolute top-2 right-2 z-10">
          <div className="px-1.5 py-0.5 rounded-full bg-blue-500/80 text-white text-xs backdrop-blur-sm">Selected</div>
        </div>
      )}

      {/* Row layout: left = 3D model, right = stats */}
      <div className="flex flex-row h-full">
        {/* Left: 3D viewer container */}
        <div className="relative w-1/2 h-full overflow-hidden">
          {/* Optional dropdown if we have multiple cars & not in QR flow */}
          {!isQrScanStation && group.cars.length > 1 && (
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <select
                className="cursor-pointer bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-white text-xs backdrop-blur-sm"
                onChange={handleSelectCar}
                value={displayedCar.id}
              >
                {group.cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditionally render 3D or skeleton based on visibility/intersection */}
          {shouldRender3D && isVisible ? (
            <Car3DViewer
              modelUrl={modelUrl}
              imageUrl={displayedCar?.image}
              interactive={!!isGroupSelected}
              height="100%"
              width="100%"
              isVisible={true}
            />
          ) : (
            <ViewerSkeleton />
          )}
        </div>

        {/* Right: Info panel */}
        <div className="w-1/2 h-full p-3 flex flex-col justify-between">
          {/* Top half: car name & battery stats */}
          <div>
            <div className="flex items-start justify-between">
              <p className="font-medium text-sm leading-tight text-white">{displayedCar.model || "Unknown Model"}</p>
            </div>

            {/* Battery + range row */}
            <div className="flex items-center mt-1.5 gap-1.5">
              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-1.5 py-0.5">
                <BatteryIcon className={`w-3.5 h-3.5 ${batteryIconColor}`} />
                <span className="text-xs font-medium">{batteryPercentage}%</span>
              </div>

              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-1.5 py-0.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs">{(batteryPercentage * 3.2).toFixed(0)} km</span>
              </div>
            </div>

            {/* Example: Odometer info */}
            <div className="flex items-center mt-2 text-gray-400 text-xs relative">
              <Info
                className="w-3.5 h-3.5 mr-1 cursor-pointer hover:text-white transition-colors"
                onClick={handleOdometerClick}
              />
              <span>Year: {displayedCar.year || "2021"}</span>

              {showOdometerPopup && (
                <div className="absolute left-0 bottom-6 bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg border border-gray-700 z-10">
                  Total distance: {displayedCar.odometer || "N/A"} km
                </div>
              )}
            </div>
          </div>

          {/* Bottom: last update info */}
          <div className="mt-2 text-xs text-gray-400">Last updated: {displayedCar.location_updated 
            ? new Date(displayedCar.location_updated).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})
            : "Unknown"}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Use React.memo with custom comparison function to prevent unnecessary re-renders
export default memo(CarCardGroup, (prevProps, nextProps) => {
  // Check if crucial props have changed
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.isQrScanStation === nextProps.isQrScanStation &&
    prevProps.group.model === nextProps.group.model &&
    prevProps.group.cars.length === nextProps.group.cars.length
  )
})