"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"

interface StationsOnlineDisplayProps {
  /**
   * How many stations are available/online
   */
  stationsCount?: number
  /**
   * Total stations in the network
   */
  totalStations?: number
}

/** Displays the total online stations and a progress bar with a press/scale effect. */
const StationsOnlineDisplay = memo(function StationsOnlineDisplay({
  stationsCount = 159,
  totalStations = 200,
}: StationsOnlineDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // For press animation
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

  // Calculate progress percentage
  const percentage = useMemo(() => {
    return Math.min(100, Math.round((stationsCount / totalStations) * 100))
  }, [stationsCount, totalStations])

  return (
    <div className="flex flex-col w-full select-none">

      {/* Pressable Card */}
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
        >
          <div className="flex flex-col w-full gap-1.5">
            <div className="flex items-center justify-between">
              <CountDisplay value={stationsCount} isPressed={isPressed} />

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
  const [displayValue, setDisplayValue] = useState(0)

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
        let start = 0
        const duration = prefersReducedMotion ? 500 : 1500
        const step = Math.ceil(value / (duration / 16))

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

export default StationsOnlineDisplay