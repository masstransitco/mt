// src/components/ui/StationsDisplay.tsx
"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface StationsDisplayProps {
  /**
   * Estimated walking time (minutes) from the user's location
   * to the nearest station. A simple way is to compute distance
   * in meters and divide by walking speed (~1.4 m/s), then convert to minutes.
   */
  minutesAway?: number
  /**
   * How many stations are available/online
   */
  stationsCount?: number
  /**
   * Total stations in the network
   */
  totalStations?: number
}

const StationsDisplay = memo(function StationsDisplay({
  minutesAway = 5,
  stationsCount = 159,
  totalStations = 200,
}: StationsDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [showNearest, setShowNearest] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Refs for animation timers
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const displayChangeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Toggle the display mode on press
  const handlePress = useCallback(() => {
    if (isAnimating) return // Prevent multiple presses during animation

    setIsPressed(true)
    setIsAnimating(true)

    // Clear any existing timers
    if (displayChangeTimerRef.current) clearTimeout(displayChangeTimerRef.current)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current)

    // Delay the display change to allow for animation
    displayChangeTimerRef.current = setTimeout(() => {
      setShowNearest((prev) => !prev)

      // Reset animation after switching
      animationTimerRef.current = setTimeout(() => {
        setIsAnimating(false)
        setIsPressed(false)
      }, prefersReducedMotion ? 100 : 300)
    }, prefersReducedMotion ? 100 : 300)
  }, [isAnimating, prefersReducedMotion])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (displayChangeTimerRef.current) clearTimeout(displayChangeTimerRef.current)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [])

  // Variants for container press animation
  const containerVariants = useMemo(
    () => ({
      pressed: {
        scale: 0.98,
        backgroundColor: "#0c0c0c",
      },
      normal: {
        scale: 1,
        backgroundColor: "#1a1a1a",
      },
    }),
    [],
  )

  // Variants for content fade/slide in/out
  const contentVariants = useMemo(
    () => ({
      initial: {
        opacity: 0,
        y: isAnimating ? 20 : 10,
      },
      animate: {
        opacity: 1,
        y: 0,
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.4,
          ease: [0.16, 1, 0.3, 1],
        },
      },
      exit: {
        opacity: 0,
        y: -20,
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.3,
        },
      },
    }),
    [isAnimating, prefersReducedMotion],
  )

  // Variants for small "pill" labels
  const pillVariants = useMemo(
    () => ({
      initial: { opacity: 0, scale: 0.9, x: -10 },
      animate: {
        opacity: 1,
        scale: 1,
        x: 0,
        transition: {
          duration: prefersReducedMotion ? 0.3 : 0.5,
          delay: prefersReducedMotion ? 0.2 : 0.4,
          ease: [0.16, 1, 0.3, 1],
        },
      },
    }),
    [prefersReducedMotion],
  )

  // Calculate progress percentage for stations
  const percentage = useMemo(() => {
    return Math.min(100, Math.round((stationsCount / totalStations) * 100))
  }, [stationsCount, totalStations])

  return (
    <div className="flex flex-col w-full select-none">
      {/* Title - toggles between "Nearest" and "Stations" */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-gray-400 text-xs uppercase tracking-wider font-normal mb-1.5 text-left w-full pl-1"
      >
        <span className="text-gray-400">{showNearest ? "NEAREST" : "STATIONS"}</span>
      </motion.div>

      {/* Main display card */}
      <div
        className="w-full flex items-center justify-center"
        onMouseDown={handlePress}
        onTouchStart={handlePress}
        style={{ cursor: "pointer" }}
      >
        <motion.div
          className="flex items-center bg-[#1a1a1a] px-4 py-2.5 rounded-xl shadow-md w-full"
          animate={isPressed ? "pressed" : "normal"}
          variants={containerVariants}
          transition={{
            duration: prefersReducedMotion ? 0.1 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          initial="normal"
          whileTap="pressed"
          layout
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`stations-${showNearest ? "nearest" : "online"}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center w-full justify-between"
              layout
            >
              {showNearest ? (
                // "Minutes Away" display
                <div className="flex items-center w-full justify-between">
                  <MinutesDisplay value={minutesAway} isPressed={isPressed} />

                  <motion.div
                    variants={pillVariants}
                    initial="initial"
                    animate="animate"
                    className="bg-[#2a2a2a] rounded-lg px-2.5 py-1"
                  >
                    <span className="text-gray-300 font-medium text-xs">walk</span>
                  </motion.div>
                </div>
              ) : (
                // "Stations" display with progress bar
                <div className="flex flex-col w-full gap-1.5">
                  <div className="flex items-center justify-between">
                    <CountDisplay value={stationsCount} isPressed={isPressed} />

                    <motion.div
                      variants={pillVariants}
                      initial="initial"
                      animate="animate"
                      className="bg-[#2a2a2a] rounded-lg px-2.5 py-1"
                    >
                      <span className="text-gray-300 font-medium text-xs">online</span>
                    </motion.div>
                  </div>

                  {/* Progress bar */}
                  <motion.div
                    className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    <motion.div
                      className="h-full bg-[#10a37f] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{
                        delay: 0.8,
                        duration: 0.8,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
})

/** Displays an integer count with a light "counting up" animation */
interface CountDisplayProps {
  value: number
  isPressed?: boolean
  prefersReducedMotion?: boolean
}
const CountDisplay = memo(function CountDisplay({
  value,
  isPressed = false,
  prefersReducedMotion = false,
}: CountDisplayProps) {
  const isMounted = useRef(true)
  const [displayed, setDisplayed] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  // Variants for count text
  const numberVariants = useMemo(() => {
    return {
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
    }
  }, [isPressed, prefersReducedMotion])

  // Animate the count up
  useEffect(() => {
    isMounted.current = true
    setDisplayValue(0)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setDisplayed(true)

        let start = 0
        const duration = prefersReducedMotion ? 500 : 1500
        const step = Math.ceil(value / (duration / 16)) // ~16ms per frame

        const animateCount = () => {
          if (start < value && isMounted.current) {
            start = Math.min(start + step, value)
            setDisplayValue(start)

            if (start < value) requestAnimationFrame(animateCount)
          }
        }
        requestAnimationFrame(animateCount)
      }
    }, prefersReducedMotion ? 100 : 300)

    return () => {
      isMounted.current = false
      clearTimeout(timer)
    }
  }, [value, prefersReducedMotion])

  return (
    <motion.div
      variants={numberVariants}
      initial="initial"
      animate="animate"
      className="font-medium text-xl tracking-tight text-white"
    >
      {displayValue.toLocaleString()}
    </motion.div>
  )
})

/** Displays minutes with a light "counting up" animation */
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
  const [displayed, setDisplayed] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  // Variants for the minute text
  const numberVariants = useMemo(() => {
    return {
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
    }
  }, [isPressed, prefersReducedMotion])

  // Animate the minutes up
  useEffect(() => {
    isMounted.current = true
    setDisplayValue(0)

    const timer = setTimeout(() => {
      if (isMounted.current) {
        setDisplayed(true)

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
    <motion.div
      variants={numberVariants}
      initial="initial"
      animate="animate"
      className="font-medium text-xl tracking-tight flex items-center text-white"
    >
      <span>{displayValue}</span>
      <span className="ml-2 text-sm text-gray-300 font-normal">minutes</span>
    </motion.div>
  )
})

export default StationsDisplay