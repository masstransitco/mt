"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock } from "lucide-react"

interface TripProgressProps {
  timeRemaining: string  // Format: "15:30"
  currentProgress: number  // 0-100
  floorNumber?: string
  parkingBay?: string
}

interface Stage {
  id: number
  name: string
  startThreshold: number
  endThreshold: number
  width: string
}

export default function TripProgress({
  timeRemaining = "15:30",
  currentProgress = 80,
  floorNumber = "2",
  parkingBay = "B42",
}: TripProgressProps) {
  const [progress, setProgress] = useState(0)
  const [isFlashing, setIsFlashing] = useState(false)
  const isReady = currentProgress >= 80

  const stages: Stage[] = [
    {
      id: 1,
      name: "Preparing car for dispatch",
      startThreshold: 0,
      endThreshold: 25,
      width: "25%",
    },
    {
      id: 2,
      name: "Arriving station soon",
      startThreshold: 25,
      endThreshold: 80,
      width: "55%",
    },
    {
      id: 3,
      name: "Ready to drive",
      startThreshold: 80,
      endThreshold: 100,
      width: "20%",
    },
  ]

  // Determine current stage based on progress
  const currentStage =
    stages.find((stage) => currentProgress >= stage.startThreshold && currentProgress <= stage.endThreshold) ||
    stages[0]

  useEffect(() => {
    // Animate progress on mount
    const timer = setTimeout(() => {
      setProgress(currentProgress)
    }, 500)

    return () => clearTimeout(timer)
  }, [currentProgress])

  // Handle headlight flash button click
  const handleFlashHeadlights = () => {
    setIsFlashing(true)

    // Reset flashing state after animation completes
    setTimeout(() => {
      setIsFlashing(false)
    }, 3000)
  }

  return (
    <div className="space-y-6 rounded-2xl bg-black p-6 shadow-md border border-gray-800">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium tracking-tight text-white">Your Car</h2>
        <div className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Arriving in {timeRemaining}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Single progress bar with markers and pulsing animation */}
        <div className="space-y-4">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-800">
            {/* Progress fill with pulsing animation */}
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-white"
              initial={{ width: "0%" }}
              animate={{
                width: `${progress}%`,
                opacity: [0.9, 1, 0.9],
              }}
              transition={{
                width: { duration: 1.5, ease: "easeOut" },
                opacity: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
              }}
            />

            {/* Stage markers */}
            <div className="absolute left-[25%] top-0 h-full w-0.5 bg-gray-700" />
            <div className="absolute left-[80%] top-0 h-full w-0.5 bg-gray-700" />
          </div>

          {/* Stage labels */}
          <div className="relative flex w-full justify-between text-xs">
            <div className="absolute left-0 -translate-x-1/2 transform">
              <div className="h-2 w-2 rounded-full bg-gray-600" />
              <span className="absolute left-0 top-4 whitespace-nowrap text-xs font-medium text-gray-400">0%</span>
            </div>
            <div className="absolute left-1/4 -translate-x-1/2 transform">
              <div className="h-2 w-2 rounded-full bg-gray-600" />
              <span className="absolute left-0 top-4 whitespace-nowrap text-xs font-medium text-gray-400">25%</span>
            </div>
            <div className="absolute left-[80%] -translate-x-1/2 transform">
              <div className="h-2 w-2 rounded-full bg-gray-600" />
              <span className="absolute left-0 top-4 whitespace-nowrap text-xs font-medium text-gray-400">80%</span>
            </div>
            <div className="absolute right-0 -translate-x-1/2 transform">
              <div className="h-2 w-2 rounded-full bg-gray-600" />
              <span className="absolute right-0 top-4 whitespace-nowrap text-xs font-medium text-gray-400">100%</span>
            </div>
          </div>
        </div>

        {/* Stage descriptions - aligned with progress bar sections */}
        <div className="flex w-full">
          {stages.map((stage) => {
            const isActive = stage.id === currentStage.id
            const isCompleted = currentProgress > stage.endThreshold

            return (
              <div
                key={stage.id}
                className={`px-2 py-3 text-center transition-all ${
                  isActive
                    ? "bg-white text-black"
                    : isCompleted
                      ? "bg-gray-700 text-white"
                      : "bg-gray-800 text-gray-400"
                }`}
                style={{ width: stage.width }}
              >
                <p className="text-xs font-medium leading-tight sm:text-sm">{stage.name}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floor and Parking Bay information - only shown when car is ready */}
      {isReady && (
        <motion.div
          className="rounded-xl bg-gray-900 p-5 border border-gray-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col space-y-4">
            <div className="flex items-center">
              {/* Mechanical status light replacing MapPin */}
              <div className="relative h-5 w-5 mr-3 flex-shrink-0">
                {/* Outer ring - metal housing */}
                <div className="absolute inset-0 rounded-full bg-gray-700 shadow-inner"></div>

                {/* Beveled edge */}
                <div className="absolute inset-[1px] rounded-full bg-gradient-to-br from-gray-600 to-gray-800"></div>

                {/* Glass lens effect */}
                <div className="absolute inset-[1.5px] rounded-full bg-gray-900 overflow-hidden">
                  {/* Light bulb inner glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br"
                    animate={{
                      backgroundColor: [
                        "rgba(30, 30, 30, 1)",
                        "rgba(74, 222, 128, 0.8)",
                        "rgba(255, 255, 255, 0.9)",
                        "rgba(74, 222, 128, 0.8)",
                        "rgba(30, 30, 30, 1)",
                      ],
                      opacity: [0.7, 0.9, 1, 0.9, 0.7],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.25, 0.5, 0.75, 1],
                    }}
                  />

                  {/* Light reflection effect */}
                  <motion.div
                    className="absolute h-1/2 w-1/2 left-1/4 top-0 rounded-b-full bg-white/20"
                    animate={{
                      opacity: [0.1, 0.3, 0.1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>

                {/* Outer glow effect */}
                <motion.div
                  className="absolute -inset-1 rounded-full opacity-0"
                  animate={{
                    boxShadow: [
                      "0 0 2px rgba(255, 255, 255, 0)",
                      "0 0 6px rgba(74, 222, 128, 0.5)",
                      "0 0 8px rgba(255, 255, 255, 0.6)",
                      "0 0 6px rgba(74, 222, 128, 0.5)",
                      "0 0 2px rgba(255, 255, 255, 0)",
                    ],
                    opacity: [0.1, 0.5, 0.7, 0.5, 0.1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                  }}
                />
              </div>

              <span className="text-sm font-medium text-white">Your car is ready for pickup</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-800 p-4 text-center">
                <p className="text-xs text-gray-400">Floor</p>
                <p className="mt-1 text-2xl font-bold text-white">{floorNumber}</p>
              </div>
              <div className="rounded-lg bg-gray-800 p-4 text-center">
                <p className="text-xs text-gray-400">Parking Bay</p>
                <p className="mt-1 text-2xl font-bold text-white">{parkingBay}</p>
              </div>
            </div>

            {/* Flash headlights button */}
            <motion.button
              onClick={handleFlashHeadlights}
              disabled={isFlashing}
              className="group relative mt-2 h-16 w-full overflow-hidden rounded-lg bg-gray-800 transition-all hover:bg-gray-750 active:scale-[0.98] disabled:opacity-80"
              whileHover={{ boxShadow: "0 0 15px rgba(255, 255, 255, 0.1)" }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-transparent to-gray-700"></div>
                <div className="absolute left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-gray-700 to-transparent"></div>
                <div className="absolute left-2/3 top-0 h-full w-1/3 bg-gradient-to-r from-transparent to-gray-700"></div>
              </div>

              {/* Content container */}
              <div className="relative z-10 flex h-full items-center justify-between px-5">
                {/* Text */}
                <div className="text-left">
                  <p className="text-sm font-medium text-white">
                    {isFlashing ? "Locating vehicle..." : "Can't find your car?"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isFlashing ? "Lights flashing" : "Flash headlights to locate"}
                  </p>
                </div>

                {/* Pulse animation container */}
                <div className="relative h-8 w-8">
                  {/* Concentric circles */}
                  <AnimatePresence>
                    {isFlashing ? (
                      <>
                        {[0, 1, 2].map((index) => (
                          <motion.div
                            key={`pulse-${index}`}
                            initial={{ scale: 0.1, opacity: 1 }}
                            animate={{ scale: 2.5, opacity: 0 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{
                              duration: 1.5,
                              repeat: 1,
                              delay: index * 0.4,
                              ease: "easeOut",
                            }}
                            className="absolute inset-0 rounded-full border border-white"
                          ></motion.div>
                        ))}
                      </>
                    ) : null}
                  </AnimatePresence>

                  {/* Center dot */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={
                      isFlashing
                        ? {
                            opacity: [1, 0.5, 1, 0.5, 1],
                            scale: [1, 1.1, 1, 1.1, 1],
                          }
                        : {}
                    }
                    transition={
                      isFlashing
                        ? {
                            duration: 2,
                            times: [0, 0.25, 0.5, 0.75, 1],
                            ease: "easeInOut",
                          }
                        : {}
                    }
                  >
                    <div className="relative h-4 w-4">
                      {/* Outer ring */}
                      <div className="absolute inset-0 rounded-full bg-white"></div>

                      {/* Inner dot */}
                      <div className="absolute inset-[3px] rounded-full bg-gray-800"></div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Flash overlay effect */}
              <AnimatePresence>
                {isFlashing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.8, 0, 0.8, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 2,
                      times: [0, 0.25, 0.5, 0.75, 1],
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 bg-white"
                  ></motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Status indicator - only shown when car is not ready */}
      {!isReady && (
        <div className="rounded-xl bg-gray-900 p-5">
          <div className="flex items-center">
            {/* Mechanical status light for not-ready state */}
            <div className="relative h-5 w-5 mr-3 flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-gray-700 shadow-inner"></div>
              <div className="absolute inset-[1px] rounded-full bg-gradient-to-br from-gray-600 to-gray-800"></div>
              <div className="absolute inset-[1.5px] rounded-full bg-gray-900 overflow-hidden">
                <motion.div
                  className="absolute inset-0 rounded-full bg-white/50"
                  animate={{
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="absolute h-1/2 w-1/2 left-1/4 top-0 rounded-b-full bg-white/20"></div>
              </div>
            </div>
            <span className="text-sm font-medium text-white">
              {currentProgress >= 25 ? "Your car is arriving soon" : "Your car is being prepared"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}