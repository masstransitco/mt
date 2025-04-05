"use client"

import type React from "react"
import { memo, useState, useEffect, useRef, useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { selectCar } from "@/store/userSlice"
import { BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Gauge, Info, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import type { Car } from "@/types/cars"
import { CarSeat } from "@/components/ui/icons/CarSeat"

// Fallback skeleton while the 3D viewer loads
const ViewerSkeleton = memo(() => (
  <div className="relative w-full h-full rounded-lg overflow-hidden bg-black/10 backdrop-blur-sm">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-black/5 via-black/10 to-black/5" />
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

/** Observe element visibility via IntersectionObserver */
function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = { threshold: 0.1 },
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => setIsIntersecting(entry.isIntersecting))
    }, options)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref, options])

  return isIntersecting
}

/** Custom hook for (optionally) hooking into scroll events */
function useTouchScrollHandler() {
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.currentTarget.dataset.touchY = e.touches[0].clientY.toString()
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const touchY = e.touches[0].clientY
    el.dataset.touchY = touchY.toString()
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.touchY
  }, [])

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }
}

// Simple info popup component for tooltips
const InfoPopup = memo(function InfoPopup({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false)

  const handleShowInfo = useCallback(() => {
    setIsVisible(true)
    setTimeout(() => setIsVisible(false), 3000)
  }, [])

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleShowInfo}
        className="text-gray-400 hover:text-gray-300 focus:outline-none transition-colors"
        aria-label="More information"
      >
        <Info size={14} />
      </button>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-black/80 text-xs text-white w-48 text-center shadow-lg z-50 backdrop-blur-sm"
        >
          {text}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/80" />
        </motion.div>
      )}
    </div>
  )
})
InfoPopup.displayName = "InfoPopup"

// Helper function to format "Last driven" time
function formatLastDriven(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never driven"

  try {
    const lastUpdate = new Date(timestamp)
    // Check if date is valid
    if (isNaN(lastUpdate.getTime())) {
      return "Unknown"
    }

    const now = new Date()
    const diffMs = now.getTime() - lastUpdate.getTime()

    // Calculate time units
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`
    } else {
      return "Just now"
    }
  } catch (error) {
    return "Unknown"
  }
}

// Dynamically load Car3DViewer with a consistent loading state.
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
})

function CarCardGroup({ group, isVisible = true, rootRef, isQrScanStation = false }: CarCardGroupProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId)

  // Odometer popup state
  const [showOdometerPopup, setShowOdometerPopup] = useState(false)
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Card ref for intersection observer
  const cardRef = useRef<HTMLDivElement>(null)
  const isInView = useIntersectionObserver(cardRef, { threshold: 0.1 })

  // Decide which car to display
  const displayedCar =
    group.cars.length === 1 ? group.cars[0] : group.cars.find((c) => c.id === selectedCarId) || group.cars[0]

  // Battery info
  const { batteryPercentage, batteryIconColor, BatteryIcon } = (() => {
    const rawBattery = displayedCar.electric_battery_percentage_left
    const parsed = rawBattery != null ? Number(rawBattery) : Number.NaN
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90
    let Icon = BatteryFull
    let color = "text-green-500" // Apple-style green
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
    return { batteryPercentage: percentage, batteryIconColor: color, BatteryIcon: Icon }
  })()

  const modelUrl = displayedCar?.modelUrl || "/cars/defaultModel.glb"

  // Format last driven time
  const lastDrivenText = formatLastDriven(displayedCar.location_updated)

  // Handler to select a car
  const handleSelectCar = useCallback(
    (carId: number) => {
      dispatch(selectCar(carId))
      setShowOdometerPopup(false)
    },
    [dispatch],
  )

  // Odometer popup toggling
  const handleOdometerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowOdometerPopup((prev) => !prev)
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current)
    popupTimeoutRef.current = setTimeout(() => setShowOdometerPopup(false), 3000)
  }, [])

  // Cleanup odometer popup on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current)
    }
  }, [])

  // Determine if any car in the group is selected
  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId)

  // Optional scroll handlers
  const touchScrollHandlers = useTouchScrollHandler()

  return (
    <motion.div
      ref={cardRef}
      onClick={() => {
        if (!isGroupSelected) {
          dispatch(selectCar(displayedCar.id))
        }
      }}
      initial={{ opacity: 0, x: 15 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: isGroupSelected ? 1.0 : 0.98,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative overflow-hidden rounded-xl bg-black/90 text-white border border-white/10 shadow-lg transition-all cursor-pointer w-full h-28 backdrop-blur-sm"
      style={{
        contain: "content",
      }}
      {...touchScrollHandlers}
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-row flex-1">
          {/* Car Viewer Section */}
          <div className="relative w-[45%] h-full overflow-hidden flex items-center justify-center">
            {!isQrScanStation && group.cars.length > 1 && (
              <div className="absolute top-1.5 left-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                <select
                  className="cursor-pointer bg-black/70 border border-white/20 rounded-full px-2 py-0.5 text-white text-xs backdrop-blur-sm"
                  onChange={(e) => handleSelectCar(Number.parseInt(e.target.value, 10))}
                  value={displayedCar.id}
                  style={{ WebkitAppearance: "none", appearance: "none", paddingRight: "1.5rem" }}
                >
                  {group.cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 5L0 0H8L4 5Z" fill="white" />
                  </svg>
                </div>
              </div>
            )}
            {isInView && isVisible ? (
              <Car3DViewer
                modelUrl={modelUrl}
                imageUrl={displayedCar?.image}
                interactive={isGroupSelected}
                height="100%"
                width="100%"
                isVisible={true}
              />
            ) : (
              <ViewerSkeleton />
            )}
          </div>

          {/* Car Info Section */}
          <div className="w-[55%] h-full p-3 pl-2 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <p className="font-medium text-sm leading-tight text-white">{displayedCar.model || "Unknown Model"}</p>
                {displayedCar.name && (
                  <span className="text-xs text-white/70 font-medium rounded-full bg-white/10 px-2 py-0.5">
                    {displayedCar.name}
                  </span>
                )}
              </div>
              <div className="flex items-center mt-2 gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/10">
                  <BatteryIcon className={`w-3.5 h-3.5 ${batteryIconColor}`} />
                  <span className="text-xs font-medium">{batteryPercentage}%</span>
                </div>
                <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/10">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs">{(batteryPercentage * 3.2).toFixed(0)} km</span>
                </div>
                <div className="flex items-center gap-1 bg-black/40 rounded-full px-2 py-0.5 border border-white/10">
                  <CarSeat className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-xs">1+4</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Component */}
        <div className="w-full h-6 bg-black/50 px-3 flex items-center justify-between text-xs border-t border-white/10">
          <div className="flex items-center gap-1.5 relative">
            <div className="relative">
              <Clock
                className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-white transition-colors"
                onClick={handleOdometerClick}
              />
              <AnimatePresence>
                {showOdometerPopup && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 bottom-5 bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-white/20 z-10 min-w-32 backdrop-blur-sm"
                  >
                    <div>Total distance: {displayedCar.odometer || "N/A"} km</div>
                    <div>Year: {displayedCar.year || "2021"}</div>
                    <div className="absolute -bottom-2 left-2 transform w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/80" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-gray-400">Last driven: {lastDrivenText}</span>
          </div>

          {/* Status indicator */}
          <div className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Ready</div>
        </div>
      </div>
    </motion.div>
  )
}

export default memo(CarCardGroup, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.isQrScanStation === nextProps.isQrScanStation &&
    prevProps.group.model === nextProps.group.model &&
    prevProps.group.cars.length === nextProps.group.cars.length
  )
})

