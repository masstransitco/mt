"use client";

import React, { useState, useEffect, useRef } from "react";
import { LucideLock, LucideUnlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnlockButtonProps {
  onUnlocked: () => void;
  holdTime?: number; // Time in ms needed to hold
  className?: string;
}

/**
 * A button that requires press-and-hold to unlock.
 * Now supports full width and custom height through className prop
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
        "bg-gray-800 rounded-lg text-white border border-gray-700",
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
      {/* Progress bar */}
      <div 
        className="absolute inset-0 bg-blue-600 origin-left transition-transform"
        style={{ transform: `scaleX(${progress})` }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 w-full h-full">
        {unlocked ? (
          <>
            <LucideUnlock className="w-8 h-8 mb-2" />
            <span className="font-medium">Unlocked</span>
          </>
        ) : (
          <>
            <LucideLock className={cn("w-8 h-8 mb-2", isHolding && "animate-pulse")} />
            <span className="font-medium">
              {isHolding ? "Hold to unlock..." : "Press & hold to unlock"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
