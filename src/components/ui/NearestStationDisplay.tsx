"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"

interface NearestStationDisplayProps {
  /**
   * Estimated walking time (minutes) from the origin location
   * to the selected destination station.
   */
  minutesAway?: number
  
  /**
   * The name of the selected station or destination
   */
  locationName?: string
  
  /**
   * The source location type - determines which display mode to use
   * Mutually exclusive with each other
   */
  sourceLocationName: "current location" | "search location"
}

/**
 * Displays the walking time to a station with visual feedback.
 * 
 * This component handles two mutually exclusive scenarios:
 * 1. Walking from the user's current location to a station
 * 2. Walking from a search location to a station
 * 
 * The sourceLocationName prop determines which scenario is active.
 * Only when sourceLocationName is "search location" will the "from search location"
 * text be shown, otherwise it shows just the walking time to the station.
 */
const NearestStationDisplay = memo(function NearestStationDisplay({
  minutesAway = 5,
  locationName,
  sourceLocationName,
}: NearestStationDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Animation refs
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle press down to trigger quick scale animation
  const handlePress = useCallback(() => {
    if (isPressed) return
    setIsPressed(true)

    // Reset after a short delay
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => {
      setIsPressed(false)
    }, prefersReducedMotion ? 150 : 300)
  }, [isPressed, prefersReducedMotion])

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
    }
  }, [])

  // Container press variants
  const containerVariants = useMemo(
    () => ({
      pressed: { scale: 0.98, backgroundColor: "#0c0c0c" },
      normal: { scale: 1, backgroundColor: "#1a1a1a" },
    }),
    [],
  )

  return (
    <div className="flex flex-col w-full select-none">

      {/* Card */}
      <div className="w-full flex items-center justify-center">
        <motion.div
          className="flex items-center bg-[#1a1a1a] px-4 py-2.5 rounded-xl shadow-md w-full justify-between"
          animate="normal"
          variants={containerVariants}
          transition={{
            duration: prefersReducedMotion ? 0.1 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          initial="normal"
        >
          <MinutesDisplay value={minutesAway} isPressed={isPressed} />

          {/* Small pill */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{
              opacity: 1,
              scale: 1,
              x: 0,
              transition: {
                duration: prefersReducedMotion ? 0.3 : 0.5,
                delay: prefersReducedMotion ? 0.2 : 0.4,
                ease: [0.16, 1, 0.3, 1],
              },
            }}
            className="bg-[#2a2a2a] rounded-lg px-2.5 py-1"
          >
            <span className="text-gray-300 font-medium text-xs">
              {locationName 
                ? `walk to ${locationName}` 
                : "walk to station"}
              {sourceLocationName === "search location" 
                ? "" 
                : ""}
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
})

/** Minutes counting animation */
interface MinutesDisplayProps {
  value: number
  isPressed?: boolean
  prefersReducedMotion?: boolean
}
const MinutesDisplay = memo(function MinutesDisplay({
  value,
  isPressed = false,
  prefersReducedMotion = false,
}: MinutesDisplayProps) {
  const isMounted = useRef(true)
  const [displayValue, setDisplayValue] = useState(0)

  const numberVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: 10 },
      animate: {
        opacity: 1,
        y: 0,
        scale: isPressed ? 0.97 : 1,
        color: isPressed ? "rgb(219, 234, 254)" : "rgb(255, 255, 255)",
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.5,
          delay: prefersReducedMotion ? 0.1 : 0.3,
          ease: [0.16, 1, 0.3, 1],
          scale: { duration: prefersReducedMotion ? 0.1 : 0.2 },
          color: { duration: prefersReducedMotion ? 0.1 : 0.2 },
        },
      },
    }),
    [isPressed, prefersReducedMotion],
  )

  // Count up animation
  useEffect(() => {
    isMounted.current = true
    setDisplayValue(0)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        let start = 0
        const duration = prefersReducedMotion ? 500 : 1500
        const step = Math.ceil(value / (duration / 16))

        const animateMinutes = () => {
          if (start < value && isMounted.current) {
            start = Math.min(start + step, value)
            setDisplayValue(start)
            if (start < value) requestAnimationFrame(animateMinutes)
          }
        }
        requestAnimationFrame(animateMinutes)
      }
    }, prefersReducedMotion ? 100 : 300)

    return () => {
      isMounted.current = false
      clearTimeout(timer)
    }
  }, [value, prefersReducedMotion])

  return (
    <motion.div variants={numberVariants} initial="initial" animate="animate" className="font-medium text-xl tracking-tight flex items-center text-white">
      <span>{displayValue}</span>
      <span className="ml-2 text-sm text-gray-300 font-normal">minutes</span>
    </motion.div>
  )
})

export default NearestStationDisplay