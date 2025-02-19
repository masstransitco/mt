"use client";

import React, {
  ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

// Pulsating strip constants/types
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

/**
 * The pulsating strip that sits just under the sheet header
 */
const PulsatingStrip = React.memo<{ className?: string }>(({ className }) => {
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

    // Apply final styling
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

// This is your InfoModal import
import InfoModal from "./info-modal";

interface SheetProps {
  /** Whether the sheet is open or collapsed to 0 height */
  isOpen: boolean;
  /** Callback to toggle the sheet (e.g., close on button click) */
  onToggle: () => void;
  /** The main content inside the sheet (e.g. StationDetail) */
  children: ReactNode;
  /** Optional additional classes */
  className?: string;
  /** Title (e.g. "Departure" or "Arrival") */
  title?: string;
  /** Subtitle below the title */
  subtitle?: string;
  /** e.g. "12 stations found" */
  count?: number;
  /** The label that follows the numeric count, e.g. "stations found" */
  countLabel?: string;
}

/**
 * A "Bottom Sheet" with the older dark-styled layout:
 *  - If isOpen => max-h: 70vh, else 0
 *  - Dark gray background, white text
 *  - Has a header with optional title, subtitle, count, Info & ChevronDown icons
 *  - Lock scroll if open
 *  - Pulsating strip under the header
 *  - Scrollable body
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
  // Lock body scrolling if isOpen
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // Local state for showing the InfoModal
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  return (
    <>
      {/* The main bottom sheet container */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50", // on top
          "overflow-hidden transition-[max-height] duration-500 ease-in-out",
          // Older dark styling:
          "bg-gray-900/90 text-white backdrop-blur-sm rounded-t-lg",
          isOpen ? "max-h-[70vh]" : "max-h-0", // if open => 70vh, else collapsed
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sheet Header */}
          <div className="flex items-center justify-between p-4">
            <div>
              {title && (
                <h2 className="text-lg font-semibold">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm opacity-80">{subtitle}</p>
              )}
              {typeof count === "number" && (
                <p className="text-sm opacity-80">
                  {count} {countLabel ?? "items"}
                </p>
              )}
            </div>

            {/* Buttons: Info & ChevronDown */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setInfoModalOpen(true)}
                className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="Show info"
              >
                <Info className="w-5 h-5" />
              </button>
              <button
                onClick={onToggle}
                className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="Close sheet"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Pulsating strip */}
          <PulsatingStrip />

          {/* Scrollable content area */}
          <div className="relative flex-1 overflow-y-auto">
            {children}

            {/* Optional bottom handle */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
              <div className="w-32 h-1 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>

      {/* The InfoModal (imported from ./info-modal) */}
      <InfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </>
  );
}
