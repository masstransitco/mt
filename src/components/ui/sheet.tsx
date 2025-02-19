"use client";

import React, {
  ReactNode,
  useLayoutEffect,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
} from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

/**
 * Example usage:
 *
 *  <Sheet
 *    isOpen={open}
 *    onToggle={() => setOpen(!open)}
 *    title="My Bottom Sheet"
 *    subtitle="Optional subtitle"
 *    count={12}
 *    countLabel="stations"
 *  >
 *    <p>My content inside the sheet</p>
 *  </Sheet>
 *
 */

/* -------------------------------------
   1) PulsatingStrip Implementation
------------------------------------- */
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

function lerp(start: Scale, end: Scale, progress: number): Scale {
  return start + (end - start) * progress;
}

function PulsatingStrip({ className }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // The core animation function
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

    // simple interpolation phases
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

    // Apply
    stripRef.current.style.transform = `scale(${scale})`;
    stripRef.current.style.backgroundColor = color;
    stripRef.current.style.opacity = opacity.toString();
    stripRef.current.style.boxShadow = `0px 4px 10px rgba(0, 0, 0, ${shadowIntensity})`;

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Start / stop the animation
  useEffect(() => {
    startTimeRef.current = undefined;
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const stripStyles = useMemo(
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
      <div ref={stripRef} style={stripStyles} className={className} />
    </div>
  );
}

/* -------------------------------------
   2) InfoModal Stub (or real implementation)
------------------------------------- */
function InfoModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded shadow-md">
        <p>Information about this sheet!</p>
        <button onClick={onClose} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded">
          Close
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------
   3) SheetProps + Implementation
------------------------------------- */
interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
}

/**
 * A "Bottom Sheet" that:
 *  - Disables scrolling with scrollLockManager if open
 *  - Has a header with optional title, subtitle, count, and two icons (Info & Down)
 *  - Renders a pulsating strip below the header
 *  - Grows to 70vh if open, or collapses to 0
 *  - Has a scrollable body for the children
 */
export default function Sheet({
  isOpen,
  onToggle,
  children,
  className,
  title,
  subtitle,
  count,
  countLabel,
}: SheetProps) {
  // (A) Lock body scroll if open
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // (B) Local state for showing "InfoModal"
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  return (
    <>
      {/* The "Bottom Sheet" */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",    // top layer
          "bg-background/90 backdrop-blur-sm rounded-t-lg",
          "overflow-hidden",                       // ensures the max-height transition is smooth
          "transition-[max-height] duration-500 ease-in-out",
          isOpen ? "max-h-[70vh]" : "max-h-0",      // expand/collapse
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header Row */}
          <div className="flex items-center justify-between p-4">
            <div>
              {title && (
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
              {typeof count === "number" && (
                <p className="text-sm text-muted-foreground">
                  {count} {countLabel ?? "items"}
                </p>
              )}
            </div>

            {/* Info & Close Icons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setInfoModalOpen(true)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Show info"
              >
                <Info className="w-5 h-5 text-muted-foreground" />
              </button>

              <button
                onClick={onToggle}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close sheet"
              >
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Pulsating strip (just below header) */}
          <PulsatingStrip />

          {/* Scrollable content area */}
          <div className="relative flex-1 overflow-y-auto">
            {children}

            {/* Optional handle at bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
              <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
            </div>
          </div>
        </div>
      </div>

      {/* InfoModal */}
      <InfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </>
  );
}
