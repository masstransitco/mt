"use client";

import React, { useState, useRef, useEffect } from "react";

interface UnlockButtonProps {
  /** Called once the user has successfully press-held for 5 seconds. */
  onUnlocked: () => void;
}

/**
 * UnlockButton: A press-and-hold for 5 seconds
 * that displays a radial progress ring. If the user
 * completes the 5 seconds, we call onUnlocked().
 * Releasing earlier resets the progress.
 */
export default function UnlockButton({ onUnlocked }: UnlockButtonProps) {
  const [progress, setProgress] = useState(0);

  // Use ReturnType<typeof setInterval> so we can call clearInterval without TS conflict
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDurationMs = 5000; // 5 seconds
  const stepMs = 50; // how often we update
  const stepsNeeded = totalDurationMs / stepMs; // 5000/50 = 100 steps
  const circleRadius = 40; // adjust for ring size
  const circumference = 2 * Math.PI * circleRadius;

  const handlePointerDown = () => {
    if (intervalRef.current !== null) return; // Already counting

    let currentStep = 0;
    intervalRef.current = setInterval(() => {
      currentStep += 1;
      const newProgress = (currentStep / stepsNeeded) * 100;
      setProgress(newProgress);

      // If we've reached 100%:
      if (newProgress >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setProgress(100);
        onUnlocked();
      }
    }, stepMs);
  };

  // Cancel if user lets go too soon
  const handlePointerUpOrLeave = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // strokeDashoffset for the ring
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center">
      <div
        className="relative w-24 h-24 flex items-center justify-center select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        style={{ touchAction: "none" }}
      >
        <span className="absolute text-center text-sm text-white pointer-events-none">
          Press &amp; Hold
        </span>

        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* track circle */}
          <circle
            cx="50"
            cy="50"
            r={circleRadius}
            fill="none"
            stroke="#2F2F2F"
            strokeWidth="8"
          />
          {/* progress circle */}
          <circle
            cx="50"
            cy="50"
            r={circleRadius}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p className="mt-2 text-xs text-gray-300">
        Hold for 5s to unlock.
      </p>
    </div>
  );
}
