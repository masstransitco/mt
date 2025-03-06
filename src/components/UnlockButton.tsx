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
  const intervalRef = useRef<NodeJS.Timer | null>(null);

  const totalDurationMs = 5000; // 5 seconds
  const stepMs = 50; // how often we update
  const stepsNeeded = totalDurationMs / stepMs; // 5000/50 = 100 steps
  const circleRadius = 40; // adjust for ring size
  const circumference = 2 * Math.PI * circleRadius;

  // Handler to start counting
  const handlePointerDown = () => {
    // If already counting, skip
    if (intervalRef.current !== null) return;

    let currentStep = 0;
    intervalRef.current = setInterval(() => {
      currentStep += 1;
      const newProgress = (currentStep / stepsNeeded) * 100;

      setProgress(newProgress);

      // If we've reached 100%:
      if (newProgress >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setProgress(100); // ensure it's exact
        onUnlocked(); // Call the unlock callback
      }
    }, stepMs);
  };

  // Handler to reset if user lets go / leaves the button
  const handlePointerUpOrLeave = () => {
    if (intervalRef.current) {
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

  // strokeDashoffset for the animated circle
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center">
      <div
        className="relative w-24 h-24 flex items-center justify-center select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        style={{
          // So the ring is pressable on touch devices
          touchAction: "none",
        }}
      >
        {/* The label over the center */}
        <span className="absolute text-center text-sm text-white pointer-events-none">
          Press &amp; Hold
        </span>

        {/* The background track circle */}
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* The 'track' circle */}
          <circle
            cx="50"
            cy="50"
            r={circleRadius}
            fill="none"
            stroke="#2F2F2F"
            strokeWidth="8"
          />
          {/* The animated progress circle */}
          <circle
            cx="50"
            cy="50"
            r={circleRadius}
            fill="none"
            stroke="#38bdf8" // tailwind's sky-400
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Optional: Instruction text or dynamic feedback */}
      <p className="mt-2 text-xs text-gray-300">
        Hold for 5s to unlock.
      </p>
    </div>
  );
}
