"use client";
import React, { useState, useEffect, useRef } from "react";
import { LucideLock, LucideUnlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface UnlockButtonProps {
  onUnlocked: () => void;
  holdTime?: number; // Time in ms needed to hold
  className?: string;
}

/**
 * A button that requires press-and-hold to unlock.
 * Enhanced with smooth animations and a circular progress indicator.
 */
export default function UnlockButton({
  onUnlocked,
  holdTime = 1500, // 1.5 seconds by default
  className
}: UnlockButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Start the press-and-hold counter
  const handleStart = () => {
    if (unlocked) return;
    
    setIsHolding(true);
    startTimeRef.current = Date.now();
    
    // Clear any existing timers
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
    }
    
    // Start animation loop
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(elapsed / holdTime, 1);
      setProgress(newProgress);
      
      if (newProgress < 1) {
        timerRef.current = requestAnimationFrame(updateProgress);
      } else {
        // Complete!
        setUnlocked(true);
        setIsHolding(false);
        onUnlocked();
      }
    };
    
    timerRef.current = requestAnimationFrame(updateProgress);
  };
  
  // Cancel the press-and-hold counter
  const handleEnd = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    setIsHolding(false);
    
    // Only reset progress if not fully unlocked
    if (progress < 1) {
      setProgress(0);
    }
  };
  
  // Calculate circle properties for progress indicator
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        "bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg text-white border border-gray-700",
        "shadow-lg hover:shadow-blue-900/30 shadow-blue-900/10 transition-shadow",
        "touch-none select-none cursor-pointer", 
        className
      )}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {/* Background ripple effect when holding */}
      {isHolding && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.15, scale: 1 }}
          className="absolute inset-0 bg-blue-500 rounded-lg"
        />
      )}
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 w-full h-full">
        <div className="relative">
          {/* Circular progress indicator */}
          <svg 
            className="w-24 h-24 transform -rotate-90"
            viewBox="0 0 100 100"
          >
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              strokeWidth="4"
              stroke="rgba(255,255,255,0.1)"
              fill="none"
            />
            
            {/* Progress ring */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              strokeWidth="4"
              stroke={unlocked ? "#10B981" : "#3B82F6"}
              fill="none"
              strokeLinecap="round"
              initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
              animate={{ 
                strokeDashoffset,
                stroke: unlocked ? "#10B981" : "#3B82F6" 
              }}
              transition={{ duration: 0.1 }}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: unlocked ? 0 : strokeDashoffset
              }}
            />
          </svg>
          
          {/* Icon in center */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <AnimatePresence mode="wait">
              {unlocked ? (
                <motion.div
                  key="unlocked"
                  initial={{ opacity: 0, scale: 0.5, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -10 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <LucideUnlock className="w-10 h-10 text-green-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="locked"
                  initial={{ opacity: 0, scale: 0.5, y: -10 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isHolding ? [1, 1.1, 1] : 1, 
                    y: 0, 
                    rotate: isHolding ? [0, -5, 5, -5, 0] : 0 
                  }}
                  exit={{ opacity: 0, scale: 0.5, y: 10 }}
                  transition={{ 
                    type: "spring", 
                    duration: 0.5,
                    scale: { 
                      repeat: isHolding ? Infinity : 0, 
                      repeatType: "mirror", 
                      duration: 1.5 
                    },
                    rotate: { 
                      repeat: isHolding ? Infinity : 0, 
                      repeatType: "mirror", 
                      duration: 0.6 
                    }
                  }}
                >
                  <LucideLock className="w-10 h-10 text-blue-300" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Text label */}
        <motion.span 
          className="font-medium mt-4 text-center"
          animate={{ 
            color: unlocked ? "rgb(167, 243, 208)" : "rgb(191, 219, 254)",
            y: isHolding && !unlocked ? [0, -2, 0] : 0 
          }}
          transition={{ 
            y: { repeat: isHolding ? Infinity : 0, duration: 0.5 } 
          }}
        >
          {unlocked ? (
            "Unlocked"
          ) : (
            isHolding ? "Hold to unlock..." : "Press & hold to unlock"
          )}
        </motion.span>
      </div>
      
      {/* Success burst animation */}
      {unlocked && (
        <motion.div 
          className="absolute inset-0 bg-green-500 opacity-0 z-5 rounded-lg"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 0], opacity: [0, 0.2, 0] }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      )}
    </div>
  );
}
