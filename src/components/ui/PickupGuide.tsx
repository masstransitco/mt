// src/components/ui/PickupGuide.tsx
"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import CarSwap from "@/components/ui/icons/CarSwap"
import { CarParkIcon } from "@/components/ui/icons/CarParkIcon"

interface PickupGuideProps {
  isDepartureFlow?: boolean
  primaryText?: string
  secondaryText?: string
  primaryDescription?: string
  secondaryDescription?: string
  compact?: boolean
}

const PickupGuide = memo(function PickupGuide({
  isDepartureFlow = true,
  primaryText,
  secondaryText,
  primaryDescription,
  secondaryDescription,
  compact = false
}: PickupGuideProps) {
  // Set default text based on isDepartureFlow
  const defaultPrimaryText = isDepartureFlow ? "Pickup from station" : "Choose dropoff station"
  const defaultSecondaryText = isDepartureFlow ? "Scan a car directly" : "Return to any station"
  const defaultPrimaryDesc = isDepartureFlow ? "Choose station on the map" : "Select destination on map"
  const defaultSecondaryDesc = isDepartureFlow ? "Use QR code on windscreen" : "Park at any station"
  
  // Use provided text or defaults
  const finalPrimaryText = primaryText || defaultPrimaryText
  const finalSecondaryText = secondaryText || defaultSecondaryText
  const finalPrimaryDesc = primaryDescription || defaultPrimaryDesc
  const finalSecondaryDesc = secondaryDescription || defaultSecondaryDesc

  const [isPressed, setIsPressed] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stepChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Auto-advance steps
  useEffect(() => {
    const advanceStep = () => {
      setActiveStep((prev) => (prev === 0 ? 1 : 0))
    }

    autoAdvanceTimerRef.current = setTimeout(() => {
      advanceStep()

      // Set up interval for auto-advancing
      const interval = setInterval(advanceStep, 5000)
      autoAdvanceTimerRef.current = interval as unknown as NodeJS.Timeout
    }, 3000)

    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    }
  }, [])

  // Memoize the press handler to prevent recreation on each render
  const handlePress = useCallback(() => {
    if (isAnimating) return // Prevent multiple presses during animation

    setIsPressed(true)
    setIsAnimating(true)

    // Clear any existing timers
    if (stepChangeTimerRef.current) clearTimeout(stepChangeTimerRef.current)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)

    // Delay the step change to allow for animation
    stepChangeTimerRef.current = setTimeout(
      () => {
        setActiveStep((prev) => (prev === 0 ? 1 : 0))

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

  // Handle next step
  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isAnimating) return
      setActiveStep(1)
    },
    [isAnimating],
  )

  // Handle previous step
  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isAnimating) return
      setActiveStep(0)
    },
    [isAnimating],
  )

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (stepChangeTimerRef.current) clearTimeout(stepChangeTimerRef.current)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
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

  // Custom CarSwap icon component for station selection
  const StationIcon = () => (
    <motion.div
      className="relative w-10 h-10 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-blue-500 rounded-full opacity-10 blur-md"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* CarSwap Icon */}
      <div className="relative z-10 text-blue-400">
        <CarSwap width="24" height="24" />
      </div>
    </motion.div>
  )

  // QR scanning icon
  const ScanIcon = () => (
    <motion.div
      className="relative w-10 h-10 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 bg-blue-500 rounded-full opacity-10 blur-md"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      {/* Icon: QR for departure flow, CarPark for return flow */}
      <div className="relative z-10 text-blue-400">
        {isDepartureFlow ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10"
          >
            <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 15H20M14 19H20M17 14V20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <CarParkIcon width="24" height="24" />
        )}
      </div>
    </motion.div>
  )

  return (
    <div className="flex flex-col w-full select-none">
      {/* Title centered horizontally */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-gray-400 text-xs uppercase tracking-wider font-normal mb-2 text-center w-full"
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
          {isDepartureFlow ? "How to Start" : "Return Options"}
        </motion.span>
      </motion.div>

      {/* Guide display with toggle functionality */}
      <div
        className="w-full flex items-center justify-center"
        onMouseDown={handlePress}
        onTouchStart={handlePress}
        style={{
          cursor: "pointer",
        }}
      >
        <motion.div
          className="flex items-center bg-[#111111] px-4 py-3 rounded-2xl shadow-lg w-full"
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
          {/* Left chevron */}
          <motion.div
            className={`text-gray-400 mr-2 ${activeStep === 0 ? "opacity-30" : "opacity-100 hover:text-gray-300"}`}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: activeStep === 0 ? 0.3 : 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={activeStep === 0 ? undefined : handlePrev}
            style={{ cursor: activeStep === 0 ? "default" : "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`guide-step-${activeStep}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center flex-1"
              layout
            >
              {/* Content */}
              {activeStep === 0 ? (
                <div className="flex items-center flex-1">
                  <motion.div
                    className="text-blue-400 mr-3"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <StationIcon />
                  </motion.div>
                  <motion.div
                    className="flex flex-col flex-1"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <span className="text-white font-['SF Pro Display'] text-sm font-medium leading-tight">{finalPrimaryText}</span>
                    {!compact && <span className="text-gray-400 font-['SF Pro Display'] text-xs mt-0.5 leading-tight">{finalPrimaryDesc}</span>}
                  </motion.div>
                </div>
              ) : (
                <div className="flex items-center flex-1">
                  <motion.div
                    className="text-blue-400 mr-3"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <ScanIcon />
                  </motion.div>
                  <motion.div
                    className="flex flex-col flex-1"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <span className="text-white font-['SF Pro Display'] text-sm font-medium leading-tight">{finalSecondaryText}</span>
                    {!compact && <span className="text-gray-400 font-['SF Pro Display'] text-xs mt-0.5 leading-tight">{finalSecondaryDesc}</span>}
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Right chevron */}
          <motion.div
            className={`text-gray-400 ml-2 ${activeStep === 1 ? "opacity-30" : "opacity-100 hover:text-gray-300"}`}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: activeStep === 1 ? 0.3 : 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={activeStep === 1 ? undefined : handleNext}
            style={{ cursor: activeStep === 1 ? "default" : "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
})

export default PickupGuide