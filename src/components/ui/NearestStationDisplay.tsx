"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, useReducedMotion, useAnimation, AnimatePresence } from "framer-motion"

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
  
  /**
   * Whether the walking time is from accurate route data
   * or just an estimation
   */
  isAccurateTime?: boolean
  
  /**
   * Called when the user clicks on the walking time display
   * to show the walking route
   */
  onShowWalkingRoute?: () => void
  
  /**
   * Whether the walking route is currently shown on the map
   */
  isWalkingRouteShown?: boolean
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
  isAccurateTime = false,
  onShowWalkingRoute,
  isWalkingRouteShown = false,
}: NearestStationDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  
  // Animation controls
  const pulseControls = useAnimation()
  
  // Animation refs
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // More subtle Tesla-like animation effects
  useEffect(() => {
    if (!isWalkingRouteShown && !prefersReducedMotion) {
      // Run very subtle pulsing animation when in default state
      pulseControls.start({
        boxShadow: [
          "0 0 0 0px rgba(255, 255, 255, 0)",
          "0 0 0 1px rgba(255, 255, 255, 0.15)",
          "0 0 0 0px rgba(255, 255, 255, 0)"
        ],
        transition: {
          duration: 4,
          ease: "easeInOut",
          times: [0, 0.5, 1],
          repeat: Infinity,
          repeatType: "loop"
        }
      });
    } else if (isWalkingRouteShown) {
      // Show subtle green border when walking route is active
      pulseControls.stop();
      pulseControls.set({
        boxShadow: "0 0 0 1px rgba(16, 163, 127, 0.4)"
      });
    }
    
    return () => {
      pulseControls.stop();
    };
  }, [isWalkingRouteShown, pulseControls, prefersReducedMotion]);
  
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

  // Container variants - Tesla-inspired subtle styling
  const containerVariants = useMemo(
    () => ({
      pressed: { 
        scale: 1, 
        backgroundColor: "#131313",
      },
      normal: { 
        scale: 1, 
        backgroundColor: "#181818",
      },
      hover: {
        backgroundColor: "#1D1D1D",
      }
    }),
    [],
  )

  return (
    <div className="flex flex-col w-full select-none">
      {/* Card with sleeker Tesla-inspired design */}
      <div className="w-full flex items-center justify-center">
        <motion.div 
          className={`rounded-sm overflow-hidden w-full ${isWalkingRouteShown ? "" : "pulsating-border"}`}
          animate={pulseControls}
          initial={{boxShadow: "0 0 0 0px rgba(255, 255, 255, 0)"}}
        >
          <motion.div
            className="flex items-center px-3 py-2 bg-[#181818] w-full justify-between shadow-sm"
            initial="normal"
            animate={isWalkingRouteShown ? "pressed" : "normal"}
            variants={containerVariants}
            transition={{
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <MinutesDisplay value={minutesAway} isPressed={isPressed || isWalkingRouteShown} />

            {/* Minimal Tesla-inspired label */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: -5 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                transition: {
                  duration: prefersReducedMotion ? 0.2 : 0.3,
                  delay: prefersReducedMotion ? 0.1 : 0.2,
                  ease: [0.16, 1, 0.3, 1],
                },
              }}
              className={`rounded-sm px-2 py-0.5 ${
                isWalkingRouteShown 
                  ? 'bg-[#1e4a3a]' 
                  : isAccurateTime 
                    ? 'bg-[#2a3a2a]' 
                    : 'bg-[#232323]'
              }`}
            >
              <span className="font-medium text-xs text-neutral-300">
                {locationName 
                  ? `walk to ${locationName}` 
                  : "walk to nearest station"
                }
              </span>
            </motion.div>
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
      <span className="ml-1 text-sm text-gray-300 font-normal">mins</span>
    </motion.div>
  )
})

export default NearestStationDisplay