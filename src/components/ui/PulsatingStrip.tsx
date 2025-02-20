import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function PulsatingStrip({ className }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0); // Use number explicitly to avoid type issues with animation ID
  const startTimeRef = useRef<number>(0); // Avoid undefined, initialize with 0

  const animate = (currentTime: number) => {
    if (!stripRef.current) return; // Avoid errors if ref is not defined

    // Calculate elapsed time
    const elapsed = currentTime - startTimeRef.current;
    const progress = (elapsed % 1400) / 1400;

    // Define variables for animation properties
    let scale = 0.95;
    let color = "#2171ec";
    let opacity = 1;
    let shadowIntensity = 0.3;

    // Adjust values based on the progress
    if (progress < 0.1) {
      scale = 1.05;
      color = "#4a9fe8";
      shadowIntensity = 0.6;
    } else if (progress < 0.2) {
      scale = 0.97;
      color = "#4a9fe8";
      opacity = 0.9;
      shadowIntensity = 0.4;
    } else if (progress < 0.3) {
      scale = 1.02;
      color = "#6abff0";
      opacity = 0.95;
      shadowIntensity = 0.5;
    } else if (progress < 0.4) {
      scale = 0.95;
      color = "#4a9fe8";
      opacity = 0.85;
      shadowIntensity = 0.4;
    } else if (progress < 0.7) {
      scale = 0.95;
      color = "#2171ec";
      opacity = 0.8;
      shadowIntensity = 0.3;
    }

    // Apply styles directly to the element
    if (stripRef.current) {
      stripRef.current.style.transform = `scale(${scale})`;
      stripRef.current.style.backgroundColor = color;
      stripRef.current.style.opacity = opacity.toString();
      stripRef.current.style.boxShadow = `0px 4px 10px rgba(0,0,0,${shadowIntensity})`;
    }

    // Request the next animation frame
    animationRef.current = requestAnimationFrame(animate);
  };

  // Setup animation when component is mounted, clean up when unmounted
  useEffect(() => {
    startTimeRef.current = performance.now(); // Initialize start time for the animation
    animationRef.current = requestAnimationFrame(animate);

    // Clean up the animation when the component unmounts
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []); // Run once when the component is mounted

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        ref={stripRef}
        style={{
          width: "110%",
          height: "1px",
          borderRadius: "1px",
          backgroundColor: "#2171ec",
          willChange: "transform, opacity, boxShadow",
          transition: "transform 0.05s ease-out",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}
