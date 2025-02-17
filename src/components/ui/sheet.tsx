"use client";

import React, {
  ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

type AnimationColor = string;
type Scale = number;

interface AnimationParams {
  duration: number;
  colors: {
    primary: AnimationColor;
    secondary: AnimationColor;
    tertiary: AnimationColor;
  };
  scales: {
    min: Scale;
    max: Scale;
    mid: Scale;
    soft: Scale;
  };
}

// Animation config for the pulsating strip
const ANIMATION_PARAMS: AnimationParams = {
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

interface PulsatingStripProps {
  className?: string;
}

const PulsatingStrip = React.memo(({ className }: PulsatingStripProps) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback((currentTime: number) => {
    if (!startTimeRef.current) startTimeRef.current = currentTime;
    if (!stripRef.current) return;

    const elapsed = currentTime - startTimeRef.current;
    const progress =
      (elapsed % ANIMATION_PARAMS.duration) / ANIMATION_PARAMS.duration;

    let scale: Scale = ANIMATION_PARAMS.scales.min;
    let color: AnimationColor = ANIMATION_PARAMS.colors.primary;
    let opacity = 1;
    let shadowIntensity = 0.3;

    if (progress < 0.1) {
      scale = lerp(
        ANIMATION_PARAMS.scales.min,
        ANIMATION_PARAMS.scales.max,
        progress * 10
      );
      color = ANIMATION_PARAMS.colors.secondary;
      shadowIntensity = 0.6;
    } else if (progress < 0.2) {
      scale = lerp(
        ANIMATION_PARAMS.scales.max,
        ANIMATION_PARAMS.scales.mid,
        (progress - 0.1) * 10
      );
      color = ANIMATION_PARAMS.colors.secondary;
      opacity = 0.9;
      shadowIntensity = 0.4;
    } else if (progress < 0.3) {
      scale = lerp(
        ANIMATION_PARAMS.scales.mid,
        ANIMATION_PARAMS.scales.soft,
        (progress - 0.2) * 10
      );
      color = ANIMATION_PARAMS.colors.tertiary;
      opacity = 0.95;
      shadowIntensity = 0.5;
    } else if (progress < 0.4) {
      scale = lerp(
        ANIMATION_PARAMS.scales.soft,
        ANIMATION_PARAMS.scales.min,
        (progress - 0.3) * 10
      );
      color = ANIMATION_PARAMS.colors.secondary;
      opacity = 0.85;
      shadowIntensity = 0.4;
    } else if (progress < 0.7) {
      scale = ANIMATION_PARAMS.scales.min;
      color = ANIMATION_PARAMS.colors.primary;
      opacity = 0.8;
      shadowIntensity = 0.3;
    }

    // Apply animations
    stripRef.current.style.transform = `scale(${scale})`;
    stripRef.current.style.backgroundColor = color;
    stripRef.current.style.opacity = opacity.toString();
    stripRef.current.style.boxShadow = `0px 4px 10px rgba(0, 0, 0, ${shadowIntensity})`;

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    startTimeRef.current = undefined;
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const styles = useMemo(
    () => ({
      width: "110%",
      height: "2.5px",
      borderRadius: "1px",
      backgroundColor: ANIMATION_PARAMS.colors.primary,
      willChange: "transform, opacity, box-shadow",
      transition: "transform 0.05s ease-out",
      transformOrigin: "center",
    }),
    []
  );

  return (
    <div className={cn("flex justify-center", className)}>
      <div ref={stripRef} style={styles} />
    </div>
  );
});

PulsatingStrip.displayName = "PulsatingStrip";

const lerp = (start: Scale, end: Scale, progress: number): Scale => {
  return start + (end - start) * progress;
};

interface SheetProps {
  /** Controls whether the sheet is open or collapsed to 0 height */
  isOpen: boolean;
  /** Callback to toggle the sheet (e.g., close on button click) */
  onToggle: () => void;
  /** The main content inside the sheet (e.g. StationDetail) */
  children: ReactNode;
  /** Optional additional classes */
  className?: string;
  /**
   * The main title (e.g. "Departure" or "Arrival")
   */
  title?: string;
  /**
   * A subtitle below the title
   * (e.g. "Pick up the car from this station" or "Return the car at this station")
   */
  subtitle?: string;
  /**
   * If you want to display the number of results (e.g. "12 stations found")
   */
  count?: number;
  /**
   * The label that follows the numeric count, e.g. "stations found"
   */
  countLabel?: string;
}

/**
 * Sheet component that:
 * 1) Disables page scroll when open (via scrollLockManager).
 * 2) Displays a “bottom sheet” with optional header info + a pulsating strip.
 * 3) Lets internal content scroll independently, up to a set max-height.
 */
const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  subtitle,
  count,
  countLabel,
}: SheetProps) => {
  // Lock body scrolling if isOpen
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50", // keep on top
        "bg-background/90 backdrop-blur-sm rounded-t-lg",
        "overflow-hidden", // needed for smooth max-height transition
        "transition-[max-height] duration-500 ease-in-out",
        isOpen ? "max-h-[70vh]" : "max-h-0",
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div>
            {/* e.g. "Departure"/"Arrival" */}
            {title && (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            )}
            {/* e.g. "Pick up the car from this station" */}
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {/* e.g. "12 stations found" */}
            {typeof count === "number" && (
              <p className="text-sm text-muted-foreground">
                {count} {countLabel ?? "stations found"}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <button
              onClick={onToggle}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close sheet"
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Pulsating strip (optional) */}
        <PulsatingStrip />

        {/* Scrollable content area */}
        <div className="relative flex-1 overflow-y-auto">
          {children}

          {/* Bottom handle (optional) */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
            <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sheet;
