"use client";

import React, { ReactNode, useLayoutEffect, useMemo, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { incrementOpenSheets, decrementOpenSheets } from "@/lib/scrollLockManager";

// Animation parameters memoized to prevent recreation
const ANIMATION_PARAMS = {
  duration: 1400, // 1.4s in milliseconds
  colors: {
    primary: '#2171ec',
    secondary: '#4a9fe8',
    tertiary: '#6abff0'
  },
  scales: {
    min: 0.95,
    max: 1.05,
    mid: 0.97,
    soft: 1.02
  }
} as const;

// Define type for animation parameters
type AnimationParams = typeof ANIMATION_PARAMS;
type Scale = number;

interface PulsatingStripProps {
  className?: string;
}

const PulsatingStrip = React.memo(({ className }: PulsatingStripProps) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = (currentTime: number) => {
    if (!startTimeRef.current) startTimeRef.current = currentTime;
    if (!stripRef.current) return;

    const elapsed = currentTime - startTimeRef.current;
    const progress = (elapsed % ANIMATION_PARAMS.duration) / ANIMATION_PARAMS.duration;

    // Calculate animation values based on progress
    let scale: Scale = ANIMATION_PARAMS.scales.min;
    let color = ANIMATION_PARAMS.colors.primary;
    let opacity = 1;
    let shadowIntensity = 0.3;

    if (progress < 0.1) {
      // First beat
      scale = lerp(ANIMATION_PARAMS.scales.min, ANIMATION_PARAMS.scales.max, progress * 10);
      color = ANIMATION_PARAMS.colors.secondary;
      shadowIntensity = 0.6;
    } else if (progress < 0.2) {
      // Quick dip
      scale = lerp(ANIMATION_PARAMS.scales.max, ANIMATION_PARAMS.scales.mid, (progress - 0.1) * 10);
      color = ANIMATION_PARAMS.colors.secondary;
      opacity = 0.9;
      shadowIntensity = 0.4;
    } else if (progress < 0.3) {
      // Second beat
      scale = lerp(ANIMATION_PARAMS.scales.mid, ANIMATION_PARAMS.scales.soft, (progress - 0.2) * 10);
      color = ANIMATION_PARAMS.colors.tertiary;
      opacity = 0.95;
      shadowIntensity = 0.5;
    } else if (progress < 0.4) {
      // Return to rest
      scale = lerp(ANIMATION_PARAMS.scales.soft, ANIMATION_PARAMS.scales.min, (progress - 0.3) * 10);
      color = ANIMATION_PARAMS.colors.secondary;
      opacity = 0.85;
      shadowIntensity = 0.4;
    } else if (progress < 0.7) {
      // Rest period
      scale = ANIMATION_PARAMS.scales.min;
      opacity = 0.8;
      shadowIntensity = 0.3;
    }

    stripRef.current.style.transform = `scale(${scale})`;
    stripRef.current.style.backgroundColor = color;
    stripRef.current.style.opacity = opacity.toString();
    stripRef.current.style.boxShadow = `0px 4px 10px rgba(0, 0, 0, ${shadowIntensity})`;

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!prefersReducedMotion) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const styles = useMemo(() => ({
    width: '99%',
    height: '3.2px',
    borderRadius: '1.5px',
    backgroundColor: ANIMATION_PARAMS.colors.primary,
    willChange: 'transform, opacity, box-shadow',
    transition: 'transform 0.05s ease-out'
  }), []);

  return (
    <div className={cn("flex justify-center", className)}>
      <div ref={stripRef} style={styles} />
    </div>
  );
});

PulsatingStrip.displayName = 'PulsatingStrip';

// Linear interpolation helper with proper typing
const lerp = (start: number, end: number, progress: number): number => {
  return start + (end - start) * progress;
};

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  count?: number;
  countLabel?: string;
}

const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  count,
  countLabel,
}: SheetProps) => {
  useLayoutEffect(() => {
    if (isOpen) {
      incrementOpenSheets();
    }
    return () => {
      if (isOpen) {
        decrementOpenSheets();
      }
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm",
        "overflow-hidden",
        "transition-[max-height] duration-500 ease-in-out",
        isOpen ? "max-h-[50vh]" : "max-h-0",
        className
      )}
    >
      <div className="flex flex-col min-h-0">
        {/* Header Section */}
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {typeof count === "number" && (
              <p className="text-sm text-muted-foreground">
                {count} {countLabel ?? "stations found"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              Sort by
            </button>
            <button
              onClick={onToggle}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close sheet"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Optimized Pulsating Strip */}
        <PulsatingStrip />

        {/* Content Section */}
        <div className="overflow-y-auto">{children}</div>

        {/* Bottom Handle */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
};

export default Sheet;
