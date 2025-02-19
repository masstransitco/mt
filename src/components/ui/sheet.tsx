"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
  useLayoutEffect,
} from "react";
import { BottomSheet } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";

import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { incrementOpenSheets, decrementOpenSheets } from "@/lib/scrollLockManager";

/* -----------------------------------------------
   1) The PulsatingStrip Code (inlined)
----------------------------------------------- */
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

    // Basic interpolation phases
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

    // Apply to DOM
    stripRef.current.style.transform = `scale(${scale})`;
    stripRef.current.style.backgroundColor = color;
    stripRef.current.style.opacity = opacity.toString();
    stripRef.current.style.boxShadow = `0px 4px 10px rgba(0,0,0,${shadowIntensity})`;

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
      <div ref={stripRef} style={stripStyles} />
    </div>
  );
}

/* -----------------------------------------------
   2) Simple InfoModal Stub
----------------------------------------------- */
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
        <button
          onClick={onClose}
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------
   3) The Sheet with dynamic snap points & non-blocking
----------------------------------------------- */
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
 * A bottom sheet using react-spring-bottom-sheet with:
 * - Dark gray styling
 * - Dynamic snap points based on content height
 * - Non-blocking => user can still interact with app behind
 * - Pulsating strip below the header
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
  // Lock page scroll if open:
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // For the Info button
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // We'll measure the content's height & create dynamic snap points
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Re-measure if children change
  useLayoutEffect(() => {
    if (contentRef.current) {
      const scrollHeight = contentRef.current.scrollHeight;
      setContentHeight(scrollHeight);
    }
  }, [children]);

  // The first snap is a minimal 100px (to show the pulsating strip),
  // second snap is enough to show all content or up to 90% of screen,
  // e.g. min(contentHeight, maxHeight * 0.9)
  const snapPoints = useCallback(
    ({ maxHeight }: { maxHeight: number }) => {
      // clamp the content-based height
      const neededHeight = Math.min(contentHeight + 60, maxHeight * 0.9);
      // minimal collapsed snap point
      const collapsed = 100;
      // if the content is super small, maybe only two snaps:
      // [ collapsed, neededHeight ]
      // if neededHeight < collapsed, you might do something like neededHeight = collapsed
      if (neededHeight < collapsed) return [neededHeight];

      return [collapsed, neededHeight];
    },
    [contentHeight]
  );

  // We'll default to the second snap if we want to see the content,
  // else it starts at collapsed
  const defaultSnap = useCallback(
    ({ maxHeight }: { maxHeight: number }) => {
      // We'll see if the content is bigger than 200px
      if (contentHeight > 200) {
        // open with the "content" snap
        const neededHeight = Math.min(contentHeight + 60, maxHeight * 0.9);
        return neededHeight;
      } else {
        // small => just collapsed
        return 100;
      }
    },
    [contentHeight]
  );

  // We'll build a custom header with dark styling & the pulsating strip
  const SheetHeader = (
    <div className="pb-2 border-b border-gray-700 bg-gray-900/90 text-white">
      <div className="flex items-center justify-between px-4 pt-4">
        {/* Left side: Title, Subtitle, Count */}
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-200">{subtitle}</p>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-200">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>

        {/* Right side: Info + Close icons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setInfoModalOpen(true)}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <Info className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* The pulsating strip just below */}
      <PulsatingStrip className="mt-2 mx-4" />
    </div>
  );

  return (
    <>
      <BottomSheet
        open={isOpen}
        onDismiss={onToggle} // if user drags below the min snap or taps the backdrop
        snapPoints={snapPoints}
        defaultSnap={defaultSnap}
        header={SheetHeader}
        blocking={false}    // (3) user can still interact with the app behind
        className={cn(
          // optional tailwind classes for the .rsbs-root
          "rsbs-dark text-white",
          className
        )}
        style={{
          // inline styling for the sheet container
          backgroundColor: "rgba(17,17,17,0.8)", 
          color: "#fff",
        }}
      >
        {/* The scrollable content area:
            We'll measure this ref to decide how tall the sheet should be. */}
        <div
          ref={contentRef}
          className="relative px-4 pt-2 pb-6 bg-gray-900 text-white"
        >
          {children}

          {/* Optional bottom handle */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <div className="w-32 h-1 rounded-full bg-white/25" />
          </div>
        </div>
      </BottomSheet>

      {/* Info Modal */}
      <InfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </>
  );
}
