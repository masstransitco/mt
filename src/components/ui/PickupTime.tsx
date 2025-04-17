// src/components/PickupTime.tsx
"use client"

import { useEffect, useState, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { useAppSelector } from "@/store/store"
import { selectDepartureDate, selectDepartureTime } from "@/store/bookingSlice"
import { addMinutes } from "date-fns"

interface PickupTimeProps {
  startTime?: Date
  endTime?: Date
  // If no times are provided, component will try to use Redux state
  useReduxTime?: boolean
}

const PickupTime = memo(function PickupTime({ 
  startTime: propStartTime, 
  endTime: propEndTime, 
  useReduxTime = true 
}: PickupTimeProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [use24HourFormat, setUse24HourFormat] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  
  // Get time from Redux if enabled
  const reduxDate = useAppSelector(selectDepartureDate)
  const reduxTime = useAppSelector(selectDepartureTime)
  
  // Combine date and time from Redux or use provided props
  const effectiveStartTime = useMemo(() => {
    if (!useReduxTime || !reduxDate || !reduxTime) {
      return propStartTime || new Date(Date.now() + 5 * 60000) // Fallback to 5 minutes from now
    }
    
    // Combine reduxDate and reduxTime into a single Date object
    const combinedDate = new Date(
      reduxDate.getFullYear(),
      reduxDate.getMonth(),
      reduxDate.getDate(),
      reduxTime.getHours(),
      reduxTime.getMinutes()
    )
    
    return combinedDate
  }, [useReduxTime, reduxDate, reduxTime, propStartTime])
  
  // Calculate end time (15 minutes after start time)
  const effectiveEndTime = useMemo(() => {
    if (propEndTime) return propEndTime
    return effectiveStartTime ? addMinutes(effectiveStartTime, 15) : new Date(Date.now() + 20 * 60000)
  }, [effectiveStartTime, propEndTime])

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const formatChangeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Memoize the time formatting function to avoid recalculations
  const formatTime = useCallback((date: Date, use24Hour: boolean) => {
    if (use24Hour) {
      // 24-hour format
      const hours = date.getHours().toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")
      return {
        hours,
        minutes,
        ampm: "",
      }
    } else {
      // 12-hour format with am/pm
      const hours = (date.getHours() % 12 || 12).toString().padStart(2, "0")
      const minutes = date.getMinutes().toString().padStart(2, "0")
      const ampm = date.getHours() >= 12 ? "pm" : "am"
      return {
        hours,
        minutes,
        ampm,
      }
    }
  }, [])

  // Memoize the formatted times to prevent recalculation on every render
  const { start, end } = useMemo(() => {
    return {
      start: formatTime(effectiveStartTime, use24HourFormat),
      end: formatTime(effectiveEndTime, use24HourFormat),
    }
  }, [effectiveStartTime, effectiveEndTime, use24HourFormat, formatTime])

  // Memoize the press handler to prevent recreation on each render
  const handlePress = useCallback(() => {
    if (isAnimating) return // Prevent multiple presses during animation

    setIsPressed(true)
    setIsAnimating(true)

    // Clear any existing timers
    if (formatChangeTimerRef.current) clearTimeout(formatChangeTimerRef.current)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current)

    // Delay the format change to allow for animation
    formatChangeTimerRef.current = setTimeout(
      () => {
        setUse24HourFormat((prev) => !prev)

        // Reset animation state after a delay
        animationTimerRef.current = setTimeout(
          () => {
            setIsAnimating(false)
            setIsPressed(false)
          },
          prefersReducedMotion ? 100 : 300,
        )
      },
      prefersReducedMotion ? 100 : 300,
    )
  }, [isAnimating, prefersReducedMotion])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (formatChangeTimerRef.current) clearTimeout(formatChangeTimerRef.current)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [])

  // Animation variants for consistent animations
  const containerVariants = useMemo(
    () => ({
      pressed: {
        scale: 0.98,
        backgroundColor: "#0a0a0a",
      },
      normal: {
        scale: 1,
        backgroundColor: "#111111",
      },
    }),
    [],
  )

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

  return (
    <div className="flex flex-col w-full select-none">
      {/* Title centered horizontally */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-gray-400 text-xs uppercase tracking-wider font-normal mb-3 text-center w-full"
      >
        Pickup Time
      </motion.div>

      {/* Time display with toggle functionality */}
      <div
        className="w-full flex items-center justify-center"
        onMouseDown={handlePress}
        onTouchStart={handlePress}
        style={{
          cursor: "pointer",
        }}
      >
        <motion.div
          className="flex items-center bg-[#111111] px-6 py-4 rounded-2xl shadow-lg"
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
              key={`time-${use24HourFormat ? "24h" : "12h"}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center"
              layout
            >
              <TimeDisplay
                value={`${start.hours}:${start.minutes}`}
                isPressed={isPressed}
              />

              <div className="mx-3 text-gray-400">—</div>

              <TimeDisplay
                value={`${end.hours}:${end.minutes}`}
                isPressed={isPressed}
              />

              {!use24HourFormat && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.8 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.2 : 0.3 }}
                  className="ml-2 text-sm font-medium text-gray-400 self-start mt-1"
                >
                  {start.ampm}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
})

interface TimeDisplayProps {
  value: string
  isPressed?: boolean
  prefersReducedMotion?: boolean
}

const TimeDisplay = memo(function TimeDisplay({
  value,
  isPressed = false,
  prefersReducedMotion = false,
}: TimeDisplayProps) {
  // Use a ref to track if component is mounted
  const isMounted = useRef(true)
  const [displayed, setDisplayed] = useState(false)

  // Animation variants for consistent animations
  const charVariants = useMemo(
    () => ({
      initial: { opacity: 0, y: 10 },
      animate: (index: number) => ({
        opacity: displayed ? 1 : 0,
        y: displayed ? 0 : 10,
        scale: isPressed ? 0.97 : 1,
        color: isPressed ? "rgb(219, 234, 254)" : "rgb(255, 255, 255)",
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.5,
          delay: prefersReducedMotion ? 0.1 : 0.3 + index * 0.1,
          ease: [0.16, 1, 0.3, 1],
          scale: { duration: prefersReducedMotion ? 0.1 : 0.2 },
          color: { duration: prefersReducedMotion ? 0.1 : 0.2 },
        },
      }),
    }),
    [displayed, isPressed, prefersReducedMotion],
  )

  const glowVariants = useMemo(
    () => ({
      initial: { opacity: 0 },
      animate: (index: number) => ({
        opacity: isPressed ? [0, 0.9, 0.4] : [0, 0.7, 0],
        scale: isPressed ? 1.2 : 1,
        transition: {
          delay: isPressed ? 0 : prefersReducedMotion ? 0.2 : 0.5 + index * 0.1,
          duration: isPressed ? (prefersReducedMotion ? 0.2 : 0.3) : prefersReducedMotion ? 0.5 : 1.5,
          times: isPressed ? [0, 0.3, 1] : [0, 0.1, 1],
        },
      }),
    }),
    [isPressed, prefersReducedMotion],
  )

  useEffect(() => {
    // Set mounted flag
    isMounted.current = true

    const timer = setTimeout(
      () => {
        if (isMounted.current) {
          setDisplayed(true)
        }
      },
      prefersReducedMotion ? 100 : 300,
    )

    // Cleanup function
    return () => {
      isMounted.current = false
      clearTimeout(timer)
    }
  }, [prefersReducedMotion])

  // Memoize the character array to prevent recreation on each render
  const characters = useMemo(() => value.split(""), [value])

  return (
    <div className="flex">
      {characters.map((char, index) => (
        <motion.div
          key={`${char}-${index}-${value}`}
          custom={index}
          variants={charVariants}
          initial="initial"
          animate="animate"
          className="relative mx-0.5"
          style={{ willChange: "transform, opacity, color" }}
        >
          <span className="text-white font-['SF_Pro_Display'] text-3xl font-light tracking-tight">{char}</span>

          {/* Subtle highlight effect - only render for non-colon characters */}
          {char !== ":" && (
            <motion.div
              custom={index}
              variants={glowVariants}
              initial="initial"
              animate="animate"
              className="absolute inset-0 bg-blue-500 rounded-full filter blur-md -z-10"
              style={{ willChange: "transform, opacity" }}
            />
          )}
        </motion.div>
      ))}
    </div>
  )
})

export default PickupTime