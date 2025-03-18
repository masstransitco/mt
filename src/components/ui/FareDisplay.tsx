// src/components/FareDisplay.tsx
"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface FareDisplayProps {
  baseFare?: number
  currency?: string
  perMinuteRate?: number
  maxDailyFare?: number
}

const FareDisplay = memo(function FareDisplay({
  baseFare = 50.0,
  currency = "HKD",
  perMinuteRate = 1,
  maxDailyFare = 600.0,
}: FareDisplayProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [showMaxDaily, setShowMaxDaily] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const formatChangeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

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
        setShowMaxDaily((prev) => !prev)

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

  const rateContainerVariants = useMemo(
    () => ({
      initial: { opacity: 0, x: -10 },
      animate: {
        opacity: 1,
        x: 0,
        transition: {
          duration: prefersReducedMotion ? 0.3 : 0.7,
          delay: prefersReducedMotion ? 0.2 : 0.4,
          ease: [0.16, 1, 0.3, 1],
        },
      },
    }),
    [prefersReducedMotion],
  )

  const rateContentVariants = useMemo(
    () => ({
      initial: { opacity: 0, scale: 0.9 },
      animate: {
        opacity: 1,
        scale: 1,
        x: isPressed ? 1 : 0,
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.3,
          delay: prefersReducedMotion ? 0.3 : 0.8,
          x: { duration: 0.2, delay: 0 },
        },
      },
    }),
    [isPressed, prefersReducedMotion],
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
        Starting Fare
      </motion.div>

      {/* Fare display with toggle functionality */}
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
              key={`fare-${showMaxDaily ? "max" : "base"}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center"
              layout
            >
              {/* Currency is always shown */}
              <motion.span
                className="text-gray-400 text-lg font-medium mr-2 font-['SF_Pro_Display']"
                animate={{
                  color: isPressed ? "rgb(156, 163, 175)" : "rgb(156, 163, 175)",
                }}
                transition={{ duration: 0.2 }}
              >
                {currency}
              </motion.span>

              {/* Toggle between base fare and max daily fare */}
              {showMaxDaily ? (
                <div className="flex items-center">
                  <PriceDisplay
                    value={maxDailyFare.toFixed(2)}
                    prefix="$"
                    isPressed={isPressed}
                  />
                  <motion.div
                    variants={rateContainerVariants}
                    initial="initial"
                    animate="animate"
                    className="ml-3 bg-[#1a1a1a] rounded-xl px-3 py-1.5"
                  >
                    <span className="text-gray-300 font-['SF_Pro_Display'] text-sm">max/day</span>
                  </motion.div>
                </div>
              ) : (
                <div className="flex items-center">
                  <PriceDisplay
                    value={baseFare.toFixed(2)}
                    prefix="$"
                    isPressed={isPressed}

                  />

                  {/* Per minute rate in a separate container */}
                  <motion.div
                    variants={rateContainerVariants}
                    initial="initial"
                    animate="animate"
                    className="flex items-center ml-4"
                    style={{ willChange: "transform, opacity" }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "auto" }}
                      transition={{
                        duration: prefersReducedMotion ? 0.2 : 0.5,
                        delay: prefersReducedMotion ? 0.2 : 0.6,
                      }}
                      className="overflow-hidden"
                      style={{ willChange: "width" }}
                    >
                      <motion.div
                        className="flex items-center bg-[#1a1a1a] rounded-xl px-3 py-1.5"
                        animate={{
                          backgroundColor: isPressed ? "#141414" : "#1a1a1a",
                          y: isPressed ? 1 : 0,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          variants={rateContentVariants}
                          initial="initial"
                          animate="animate"
                          className="flex items-center"
                          style={{ willChange: "transform, opacity" }}
                        >
                          <motion.span
                            className="text-blue-400 font-['SF_Pro_Display'] text-base font-medium"
                            animate={{
                              color: isPressed ? "rgb(147, 197, 253)" : "rgb(96, 165, 250)",
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            +${perMinuteRate}
                          </motion.span>
                          <motion.span
                            className="text-gray-400 font-['SF_Pro_Display'] text-sm ml-1"
                            animate={{
                              color: isPressed ? "rgb(156, 163, 175)" : "rgb(156, 163, 175)",
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            /min
                          </motion.span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
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

interface PriceDisplayProps {
  value: string
  prefix?: string
  isPressed?: boolean
  prefersReducedMotion?: boolean
}

const PriceDisplay = memo(function PriceDisplay({
  value,
  prefix = "",
  isPressed = false,
  prefersReducedMotion = false,
}: PriceDisplayProps) {
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
        color: isPressed && !isNaN(Number(index)) ? "rgb(219, 234, 254)" : "rgb(255, 255, 255)",
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
  const characters = useMemo(() => (prefix + value).split(""), [prefix, value])

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
          <span className="text-white font-['SF_Pro_Display'] font-light text-3xl tracking-tight">{char}</span>

          {/* Subtle highlight effect for numbers only */}
          {!isNaN(Number(char)) && (
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

export default FareDisplay