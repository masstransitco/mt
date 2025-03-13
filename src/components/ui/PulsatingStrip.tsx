"use client";

import React, { useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";

/* Animation parameters */
const ANIMATION_PARAMS = {
  duration: 1400,
  colors: {
    primary: "#2171ec",
    secondary: "#4a9fe8",
    tertiary: "#6abff0",
  },
  scales: {
    min: 0.95,
    max: 1.05,
    mid: 0.97,
    soft: 1.02,
  },
};

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

interface PulsatingStripProps {
  className?: string;
}

function PulsatingStripComponent({ className }: PulsatingStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // The animation function
  useEffect(() => {
    // Define the animation function
    const animate = (currentTime: number) => {
      if (!stripRef.current) return;
      
      // Initialize start time on first call
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }
      
      const elapsed = currentTime - startTimeRef.current;
      const progress = (elapsed % ANIMATION_PARAMS.duration) / ANIMATION_PARAMS.duration;

      let scale: number = ANIMATION_PARAMS.scales.min;
      let color: string = ANIMATION_PARAMS.colors.primary;
      let opacity = 1;
      let shadowIntensity = 0.3;

      if (progress < 0.1) {
        scale = lerp(ANIMATION_PARAMS.scales.min, ANIMATION_PARAMS.scales.max, progress * 10);
        color = ANIMATION_PARAMS.colors.secondary;
        shadowIntensity = 0.6;
      } else if (progress < 0.2) {
        scale = lerp(ANIMATION_PARAMS.scales.max, ANIMATION_PARAMS.scales.mid, (progress - 0.1) * 10);
        color = ANIMATION_PARAMS.colors.secondary;
        opacity = 0.9;
        shadowIntensity = 0.4;
      } else if (progress < 0.3) {
        scale = lerp(ANIMATION_PARAMS.scales.mid, ANIMATION_PARAMS.scales.soft, (progress - 0.2) * 10);
        color = ANIMATION_PARAMS.colors.tertiary;
        opacity = 0.95;
        shadowIntensity = 0.5;
      } else if (progress < 0.4) {
        scale = lerp(ANIMATION_PARAMS.scales.soft, ANIMATION_PARAMS.scales.min, (progress - 0.3) * 10);
        color = ANIMATION_PARAMS.colors.secondary;
        opacity = 0.85;
        shadowIntensity = 0.4;
      } else if (progress < 0.7) {
        scale = ANIMATION_PARAMS.scales.min;
        color = ANIMATION_PARAMS.colors.primary;
        opacity = 0.8;
        shadowIntensity = 0.3;
      }

      stripRef.current.style.transform = `scale(${scale})`;
      stripRef.current.style.backgroundColor = color;
      stripRef.current.style.opacity = opacity.toString();
      stripRef.current.style.boxShadow = `0px 4px 10px rgba(0,0,0,${shadowIntensity})`;

      // Request next frame
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start the animation
    animationRef.current = requestAnimationFrame(animate);

    // Cleanup function to cancel animation when component unmounts
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        ref={stripRef}
        style={{
          width: "110%",
          height: "2px",
          borderRadius: "1px",
          backgroundColor: ANIMATION_PARAMS.colors.primary,
          willChange: "transform, opacity, boxShadow",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
const PulsatingStrip = memo(PulsatingStripComponent);
PulsatingStrip.displayName = "PulsatingStrip";

export default PulsatingStrip;