// src/components/ui/StationsDisplay.tsx
"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface StationsDisplayProps {
  stationsCount?: number
  totalStations?: number
}

const StationsDisplay = memo(function StationsDisplay({
  stationsCount = 159,
  totalStations = 200,
}: StationsDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [showTotal, setShowTotal] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const displayChangeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Memoize the press handler to prevent recreation on each render
  const handlePress = useCallback(() => {
    if (isAnimating) return // Prevent multiple presses during animation

    setIsPressed(true)
    setIsAnimating(true)

    // Clear any existing timers
    if (displayChangeTimerRef.current) clearTimeout(displayChangeTimerRef.current)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current)

    // Delay the display change to allow for animation
    displayChangeTimerRef.current = setTimeout(
      () => {
        setShowTotal((prev) => !prev)

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
      if (displayChangeTimerRef.current) clearTimeout(displayChangeTimerRef.current)
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

  // Calculate percentage for progress indicator
  const percentage = useMemo(
    () => Math.min(100, Math.round((stationsCount / totalStations) * 100)),
    [stationsCount, totalStations],
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
        <motion.span
          initial={{ color: "rgb(156 163 175)" }}
          animate={{
            color: ["rgb(156 163 175)", "rgb(59 130 246)", "rgb(156 163 175)"],
            textShadow: [
              "0 0 0px rgba(59, 130, 246, 0)",
              "0 0 8px rgba(59, 130, 246, 0.5)",
              "0 0 0px rgba(59, 130, 246, 0)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "reverse",
            ease: "easeInOut",
            times: [0, 0.5, 1],
          }}
        >
          Stations
        </motion.span>
      </motion.div>

      {/* Stations display with toggle functionality */}
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
              key={`stations-${showTotal ? "total" : "online"}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center"
              layout
            >
              {showTotal ? (
                <div className="flex items-center">
                  {/* Total stations display */}
                  <CountDisplay
                    value={totalStations}
                    isPressed={isPressed}
                  />

                  <motion.div
                    variants={pillVariants}
                    initial="initial"
                    animate="animate"
                    className="ml-3 bg-[#1a1a1a] rounded-xl px-3 py-1.5"
                  >
                    <span className="text-gray-300 font-['SF Pro Display'] text-sm">total</span>
                  </motion.div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-center">
                    {/* Online stations display */}
                    <CountDisplay
                      value={stationsCount}
                      isPressed={isPressed}
                    />

                    <motion.div
                      variants={pillVariants}
                      initial="initial"
                      animate="animate"
                      className="ml-3 bg-[#1a1a1a] rounded-xl px-3 py-1.5"
                    >
                      <span className="text-gray-300 font-['SF Pro Display'] text-sm">online</span>
                    </motion.div>
                  </div>

                  {/* Progress bar */}
                  <motion.div
                    className="mt-2 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden w-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{
                        delay: 0.8,
                        duration: 0.8,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{
                        boxShadow: "0 0 8px rgba(59, 130, 246, 0.5)",
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
  // Use a ref to track if component is mounted
  const isMounted = useRef(true)
  const [displayed, setDisplayed] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  // Animation variants for consistent animations
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
    [displayed, isPressed, prefersReducedMotion],
  )

  // Animate the count up
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true

    // Reset display value
    setDisplayValue(0)

    const timer = setTimeout(
      () => {
        if (isMounted.current) {
          setDisplayed(true)

          // Animate the count up
          let start = 0
          const duration = prefersReducedMotion ? 500 : 1500
          const step = Math.ceil(value / (duration / 16)) // 16ms per frame

          const animateCount = () => {
            if (start < value && isMounted.current) {
              start = Math.min(start + step, value)
              setDisplayValue(start)

              if (start < value) {
                requestAnimationFrame(animateCount)
              }
            }
          }

          requestAnimationFrame(animateCount)
        }
      },
      prefersReducedMotion ? 100 : 300,
    )

    // Cleanup function
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
      className="font-['SF Pro Display'] text-3xl font-light tracking-tight"
    >
      {displayValue.toLocaleString()}
    </motion.div>
  )
})

export default StationsDisplay