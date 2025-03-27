"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import dynamic from "next/dynamic"

// Lazy-load CarGrid with a loading state
const CarGrid = dynamic(() => import("@/components/booking/CarGrid"), {
  loading: () => (
    <div className="h-32 w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicles...</div>
    </div>
  ),
  ssr: false,
})

// Import Car type
import type { Car } from "@/types/cars"

interface PickupGuideProps {
  isDepartureFlow?: boolean
  primaryText?: string
  secondaryText?: string
  primaryDescription?: string
  secondaryDescription?: string
  compact?: boolean
  // New props for CarGrid integration
  showCarGrid?: boolean
  scannedCar?: Car | null
}

const PickupGuide = memo(function PickupGuide({
  isDepartureFlow = true,
  primaryText,
  secondaryText,
  primaryDescription,
  secondaryDescription,
  compact = false,
  // New props with defaults
  showCarGrid = false,
  scannedCar = null,
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

  const [activeStep, setActiveStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
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

  // Handle step change
  const handleStepChange = useCallback(
    (newStep: number) => {
      if (isAnimating || newStep === activeStep) return

      setIsAnimating(true)

      // Clear auto-advance timer
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)

      // Change step
      setActiveStep(newStep)

      // Reset animation state after a delay
      animationTimerRef.current = setTimeout(
        () => {
          setIsAnimating(false)
        },
        prefersReducedMotion ? 100 : 300,
      )
    },
    [activeStep, isAnimating, prefersReducedMotion],
  )

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current)
    }
  }, [])

  // Animation variants
  const contentVariants = useMemo(
    () => ({
      initial: {
        opacity: 0,
        y: 10,
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
        y: -10,
        transition: {
          duration: prefersReducedMotion ? 0.2 : 0.3,
        },
      },
    }),
    [prefersReducedMotion],
  )

  // Step indicator dots
  const StepIndicator = () => (
    <div className="flex space-x-1.5 mt-3">
      {[0, 1].map((step) => (
        <button
          key={step}
          onClick={() => handleStepChange(step)}
          className="group focus:outline-none"
          aria-label={`Go to step ${step + 1}`}
        >
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${
              activeStep === step ? "bg-white" : "bg-gray-600"
            } group-hover:bg-gray-400 transition-colors`}
            animate={{
              scale: activeStep === step ? 1.2 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col w-full select-none">
      {/* Title */}
      <div className="text-gray-400 text-xs uppercase tracking-wider font-normal mb-2 text-left pl-1">
        {isDepartureFlow ? "Ways To Start" : "Ways to Return"}
      </div>

      {/* Guide display */}
      <div className="relative">
        <motion.div className="bg-[#1a1a1a] rounded-xl shadow-md overflow-hidden" layout>
          <AnimatePresence mode="wait">
            <motion.div
              key={`guide-step-${activeStep}`}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="p-4"
            >
              {activeStep === 0 ? (
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-4 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-white">
                      <span className="text-sm font-medium">1</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white text-base font-medium mb-1">{finalPrimaryText}</h3>
                    {!compact && <p className="text-gray-400 text-sm">{finalPrimaryDesc}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-4 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-white">
                      <span className="text-sm font-medium">2</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white text-base font-medium mb-1">{finalSecondaryText}</h3>
                    {!compact && <p className="text-gray-400 text-sm">{finalSecondaryDesc}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation controls */}
          <div className="flex justify-between items-center px-4 py-3 bg-[#222222]">
            <StepIndicator />

            <div className="flex space-x-2">
              <button
                onClick={() => handleStepChange(0)}
                disabled={activeStep === 0}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  activeStep === 0
                    ? "bg-[#2a2a2a] text-gray-500 cursor-default"
                    : "bg-[#2a2a2a] text-white hover:bg-[#333333]"
                }`}
                aria-label="Previous step"
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
              </button>

              <button
                onClick={() => handleStepChange(1)}
                disabled={activeStep === 1}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  activeStep === 1
                    ? "bg-[#2a2a2a] text-gray-500 cursor-default"
                    : "bg-[#2a2a2a] text-white hover:bg-[#333333]"
                }`}
                aria-label="Next step"
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
              </button>
            </div>
          </div>

          {/* Car Grid integration - similar to how StationDetail renders it */}
          {showCarGrid && (
            <div className="bg-[#1a1a1a] border-t border-[#2a2a2a] p-4">
              <div className="text-sm text-gray-400 mb-3">Available vehicles:</div>
              <CarGrid className="w-full" isVisible={true} scannedCar={scannedCar} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
})

export default PickupGuide

