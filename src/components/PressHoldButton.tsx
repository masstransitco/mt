"use client"

import { useState, useEffect, useRef } from "react"
import { Lock, Unlock } from "lucide-react"

interface PressHoldButtonProps {
  onComplete: () => void;
  lockState?: boolean; // true = locked, false = unlocked
  holdTime?: number; // Time in ms needed to hold
  className?: string;
}

export default function PressHoldButton({
  onComplete,
  lockState = true, // Default to locked
  holdTime = 3000, // Default to 3 seconds
  className = ""
}: PressHoldButtonProps) {
  // Button interaction states
  const [isPressed, setIsPressed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isBlinking, setIsBlinking] = useState(false)

  // Animation state (true = animation completed, showing result)
  const [isActionComplete, setIsActionComplete] = useState(false)

  // Refs for animations and timers
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle animation frame updates
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = timestamp - startTimeRef.current

    if (elapsed < holdTime) {
      // Calculate progress (0 to 1)
      const newProgress = elapsed / holdTime
      setProgress(newProgress)
      animationRef.current = requestAnimationFrame(animate)
    } else {
      // Animation complete
      setProgress(1)

      // Trigger blink effect
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 600)

      // Trigger haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]) // Vibrate pattern: 100ms on, 50ms off, 100ms on
      }

      // Set action as complete
      setIsActionComplete(true)
      
      // Call the callback
      onComplete();

      // Set timer to reset to ready state after 2.5 seconds
      resetTimerRef.current = setTimeout(() => {
        setIsActionComplete(false)
        setProgress(0)
      }, 2500)

      startTimeRef.current = null
    }
  }

  // Start the animation when pressed
  const handlePressStart = () => {
    // Only allow interaction if not in the "complete" state
    if (!isActionComplete) {
      setIsPressed(true)
      startTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    }
  }

  // Cancel the animation when released before completion
  const handlePressEnd = () => {
    setIsPressed(false)

    if (progress < 1 && !isActionComplete) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      // Reset progress with a smooth animation
      const resetAnimation = () => {
        setProgress((prev) => {
          const newProgress = prev - 0.05
          if (newProgress <= 0) {
            return 0
          } else {
            requestAnimationFrame(resetAnimation)
            return newProgress
          }
        })
      }
      requestAnimationFrame(resetAnimation)
    }
  }

  // Clean up animation frame and timers on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  // Calculate the stroke-dasharray and stroke-dashoffset for the circle
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  // Determine button text and icon based on current state
  const getButtonContent = () => {
    if (isActionComplete) {
      // Just completed action
      return {
        icon: !lockState ? <Lock className="w-16 h-16 mb-2" /> : <Unlock className="w-16 h-16 mb-2" />,
        text: !lockState ? "Locked" : "Unlocked",
      }
    } else {
      // Ready for next action
      return {
        icon: lockState ? <Unlock className="w-16 h-16 mb-2" /> : <Lock className="w-16 h-16 mb-2" />,
        text: lockState ? "Unlock" : "Lock",
      }
    }
  }

  const buttonContent = getButtonContent()

  return (
    <div
      className={`relative select-none isolate ${className}`}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      style={{ touchAction: 'none' }}
    >
      {/* Outer glow effect */}
      <div
        className={`absolute inset-0 rounded-full bg-blue-500 opacity-0 blur-xl transition-opacity duration-300 ${progress > 0 ? `opacity-${Math.min(Math.floor(progress * 10), 10)}` : ""}`}
      ></div>

      {/* Position the components relative to each other */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Button background with glass effect */}
        <div
          className={`
            absolute inset-0 rounded-full
            flex items-center justify-center 
            bg-gradient-to-br from-gray-800 to-gray-900
            backdrop-blur-sm
            shadow-[0_0_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.08)]
            transition-all duration-300 ease-out
            ${isPressed && !isActionComplete ? "scale-97 shadow-[0_0_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.03)]" : "scale-100"}
          `}
        ></div>
        
        {/* Inner shadow overlay for depth */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_15px_rgba(0,0,0,0.4)] pointer-events-none"></div>

        {/* SVG for the animated ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track for the progress ring */}
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />

          {/* Animated progress ring with gradient and glow */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={isBlinking ? "url(#blinkGradient)" : lockState ? "url(#blueGradient)" : "url(#redGradient)"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-100 ease-linear ${isBlinking ? "blink-animation" : ""}`}
            filter="url(#glow)"
          />

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" /> {/* lighter blue */}
              <stop offset="100%" stopColor="#2563EB" /> {/* darker blue */}
            </linearGradient>

            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" /> {/* lighter red */}
              <stop offset="100%" stopColor="#DC2626" /> {/* darker red */}
            </linearGradient>

            <linearGradient id="blinkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={lockState ? "#93C5FD" : "#FCA5A5"} /> {/* much lighter color */}
              <stop offset="100%" stopColor={lockState ? "#3B82F6" : "#EF4444"} /> {/* medium color */}
            </linearGradient>

            {/* Glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={isBlinking ? "4" : "2"} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        </svg>

        {/* Content centered inside the ring */}
        <div className="relative z-10 flex flex-col items-center justify-center text-white">
          <div
            className={`
            transition-all duration-500 ease-out
            ${isActionComplete ? "scale-105" : "scale-100"}
          `}
          >
            {buttonContent.icon}
          </div>
          <span
            className={`
            text-2xl font-medium
            transition-all duration-300
            ${isActionComplete ? (lockState ? "text-red-200" : "text-blue-200") : "text-white"}
          `}
          >
            {buttonContent.text}
          </span>
        </div>

        {/* Particle effects when action completes */}
        {isActionComplete && (
          <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-1.5 h-1.5 ${lockState ? "bg-blue-300" : "bg-red-300"} rounded-full opacity-0`}
                style={{
                  left: `${50 + 45 * Math.cos(i * (Math.PI / 4))}%`,
                  top: `${50 + 45 * Math.sin(i * (Math.PI / 4))}%`,
                  animation: `particle-fade-out 0.8s ease-out ${i * 0.06}s forwards`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}