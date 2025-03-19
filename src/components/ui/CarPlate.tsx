// src/components/ui/CarPlate.tsx
"use client"

import { useState, useEffect, memo, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

interface CarPlateProps {
  plateNumber?: string
  vehicleModel?: string
}

const CarPlate = memo(function CarPlate({ 
  plateNumber = "NS 1234",
  vehicleModel = "Electric Vehicle"
}: CarPlateProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [isOrange, setIsOrange] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use refs to store timers for proper cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const colorChangeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if user prefers reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Memoize the press handler to prevent recreation on each render
  const handlePress = useCallback(() => {
    if (isAnimating) return // Prevent multiple presses during animation

    setIsPressed(true)
    setIsAnimating(true)

    // Clear any existing timers
    if (colorChangeTimerRef.current) clearTimeout(colorChangeTimerRef.current)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current)

    // Delay the color change to allow for animation
    colorChangeTimerRef.current = setTimeout(
      () => {
        setIsOrange((prev) => !prev)

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
      if (colorChangeTimerRef.current) clearTimeout(colorChangeTimerRef.current)
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current)
    }
  }, [])

  // Animation variants for consistent animations
  const containerVariants = useMemo(
    () => ({
      pressed: {
        scale: 0.98,
        y: 2,
      },
      normal: {
        scale: 1,
        y: 0,
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

  // Split the plate number into characters for animation
  const plateChars = useMemo(() => plateNumber.split(""), [plateNumber])

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
          {vehicleModel}
        </motion.span>
      </motion.div>

      {/* License plate with toggle functionality */}
      <div
        className="w-full flex items-center justify-center"
        onMouseDown={handlePress}
        onTouchStart={handlePress}
        style={{
          cursor: "pointer",
        }}
      >
        <motion.div
          className="relative flex items-center justify-center shadow-lg"
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
          {/* Plate border */}
          <motion.div className="absolute inset-0 rounded-xl border-2 border-black" style={{ zIndex: 2 }} />

          {/* Plate background */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`plate-${isOrange ? "orange" : "white"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`w-full h-full rounded-xl ${
                isOrange ? "bg-amber-400" : "bg-gray-100"
              } px-5 py-3 flex items-center justify-center`}
              style={{ zIndex: 1 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`plate-content-${isOrange ? "orange" : "white"}`}
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center space-x-2"
                >
                  {/* Plate characters with staggered animation */}
                  {plateChars.map((char, index) => (
                    <motion.span
                      key={`${char}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isPressed ? 0.97 : 1,
                      }}
                      transition={{
                        duration: 0.4,
                        delay: 0.1 + index * 0.05,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`text-black font-['SF Pro Display'] text-4xl font-bold ${char === " " ? "w-2" : ""}`}
                    >
                      {char !== " " ? char : ""}
                    </motion.span>
                  ))}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>

          {/* Plate shadow */}
          <motion.div
            className="absolute -bottom-1 inset-x-1 h-2 bg-black opacity-20 blur-sm rounded-full"
            animate={{
              y: isPressed ? 0 : 1,
              scale: isPressed ? 0.98 : 1,
              opacity: isPressed ? 0.15 : 0.2,
            }}
            transition={{ duration: 0.2 }}
            style={{ zIndex: 0 }}
          />
        </motion.div>
      </div>
    </div>
  )
})

export default CarPlate