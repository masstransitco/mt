"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type FlipDigitProps = {
  value: string
  delay: number
}

// Component for individual flipping digits
const FlipDigit = ({ value, delay }: FlipDigitProps) => {
  const [flipped, setFlipped] = useState(false)
  const [glowing, setGlowing] = useState(false)

  useEffect(() => {
    const flipTimer = setTimeout(() => {
      setFlipped(true)

      // Add glow effect after flip completes
      setTimeout(() => {
        setGlowing(true)

        // Remove glow effect after a short duration
        setTimeout(() => {
          setGlowing(false)
        }, 600)
      }, 300)
    }, delay)

    return () => clearTimeout(flipTimer)
  }, [delay])

  return (
    <div className="relative h-10 w-7 mx-0.5">
      {/* Shadow element */}
      <div className="absolute inset-0 rounded-md bg-black opacity-30 blur-md transform translate-y-1 scale-95"></div>

      {/* Glow effect */}
      <AnimatePresence>
        {glowing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-md bg-blue-500 blur-md z-0"
          />
        )}
      </AnimatePresence>

      {/* Top half (static) */}
      <div className="absolute inset-0 bottom-1/2 bg-[#1A1A1A] rounded-t-md border-t border-l border-r border-[#2A2A2A] overflow-hidden">
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-mono text-xl font-medium"
          style={{ transform: "translateY(50%)" }}
        >
          {value}
        </div>
      </div>

      {/* Bottom half (animated) */}
      <motion.div
        initial={{ rotateX: -90 }}
        animate={flipped ? { rotateX: 0 } : {}}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          delay: delay / 1000,
        }}
        className="absolute inset-0 top-1/2 bg-[#1A1A1A] rounded-b-md border-b border-l border-r border-[#2A2A2A] overflow-hidden origin-top"
        style={{ backfaceVisibility: "hidden" }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center text-white font-mono text-xl font-medium"
          style={{ transform: "translateY(-50%)" }}
        >
          {value}
        </div>

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500 to-transparent opacity-5"></div>
      </motion.div>

      {/* Divider line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#2A2A2A] z-10"></div>
    </div>
  )
}

const Separator = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center justify-center mx-1 text-gray-300 font-mono text-xl">{children}</div>
)

interface PickupTimeProps {
  startTime: Date;
  endTime: Date;
}

export default function PickupTime({ startTime, endTime }: PickupTimeProps) {
  // Format the start and end times
  const formatTime = (date: Date) => {
    const hours = date.getHours() % 12 || 12;
    const minutes = date.getMinutes();
    const ampm = date.getHours() >= 12 ? "pm" : "am";
    
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      ampm
    };
  };
  
  const start = formatTime(startTime);
  const end = formatTime(endTime);
  
  return (
    <div className="flex flex-col items-center w-full">
      {/* Title with blue illumination animation, now centered */}
      <motion.div
        variants={{
          hidden: { opacity: 0, y: -10 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { delay: 0.3, duration: 0.5 },
          },
        }}
        initial="hidden"
        animate="visible"
        className="text-gray-400 text-sm font-medium mb-2 text-center"
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
          Pickup car
        </motion.span>
      </motion.div>

      {/* Flipping clock display */}
      <div className="w-full flex items-center justify-center">
        <div className="flex items-center bg-[#1D1D1D] px-4 py-3 rounded-xl shadow-xl border border-[#2A2A2A]">
          <FlipDigit value={start.hours.charAt(0)} delay={100} />
          <FlipDigit value={start.hours.charAt(1)} delay={250} />
          <Separator>:</Separator>
          <FlipDigit value={start.minutes.charAt(0)} delay={400} />
          <FlipDigit value={start.minutes.charAt(1)} delay={550} />

          <Separator>-</Separator>

          <FlipDigit value={end.hours.charAt(0)} delay={700} />
          <FlipDigit value={end.hours.charAt(1)} delay={850} />
          <Separator>:</Separator>
          <FlipDigit value={end.minutes.charAt(0)} delay={1000} />
          <FlipDigit value={end.minutes.charAt(1)} delay={1150} />

          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.5 }}
            className="ml-2 text-sm font-medium text-blue-400 self-start mt-1"
          >
            {start.ampm}
          </motion.div>
        </div>
      </div>
    </div>
  );
}