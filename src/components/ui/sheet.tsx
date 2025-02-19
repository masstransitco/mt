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

// IMPORTANT: install & import the library + its default CSS
import { BottomSheet } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";

import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

/* ----------------------------------------------------------------
   1) The PulsatingStrip Code (inlined)
   - We keep your same logic for the animated strip
---------------------------------------------------------------- */
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

/* ----------------------------------------------------------------
   2) InfoModal Stub
---------------------------------------------------------------- */
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

/* ----------------------------------------------------------------
   3) The actual Sheet using react-spring-bottom-sheet
---------------------------------------------------------------- */
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
  // If you want to lock the entire page from scrolling:
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // For the Info button
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Snap points:
  // We want the sheet to have a minimal snap near the pulsating strip,
  // e.g. 120px so the user sees the strip and partial header.
  // Then a half screen, and 80% screen for near-full.
  const snapPoints = ({ maxHeight }: { maxHeight: number }) => [
    120, // Enough to show the strip & partial header
    0.5 * maxHeight,
    0.8 * maxHeight,
  ];

  // We'll default to half screen upon opening
  const defaultSnap = ({ maxHeight }: { maxHeight: number }) => 0.5 * maxHeight;

  // The library also automatically uses a backdrop. 
  // If the user drags below the smallest snap (120px), `onDismiss` is called => close.

  const SheetHeader = (
    <div className="pb-2 border-b border-border/30 bg-gray-900/90 text-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-200">{subtitle}</p>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-200">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setInfoModalOpen(true)}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
            aria-label="Show info"
          >
            <Info className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onToggle}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
            aria-label="Close sheet"
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
        onDismiss={onToggle} // If user drags below 120px or taps backdrop
        snapPoints={snapPoints}
        defaultSnap={defaultSnap}
        className={cn(
          // We set the sheet background to dark gray
          // The library's CSS classes are appended last, so use !important if needed.
          "rsbs-dark bg-gray-900 text-white",
          className
        )}
        header={SheetHeader}
        // This ensures the actual sheet container also has a dark background:
        // "style" sets inline CSS for the .rsbs-body
        style={{
          backgroundColor: "rgba(17,17,17,0.8)", // or #333, etc.
          color: "#fff",
        }}
        blocking={true} // if you want to block scrolling behind the sheet
      >
        {/* The content inside the bottom sheet (scrollable) */}
        <div className="relative px-4 pt-2 pb-6 bg-gray-900 text-white">
          {children}

          {/* optional bottom handle */}
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
