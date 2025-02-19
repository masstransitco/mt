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
import { BottomSheet, BottomSheetRef } from "react-spring-bottom-sheet";
import "react-spring-bottom-sheet/dist/style.css";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { incrementOpenSheets, decrementOpenSheets } from "@/lib/scrollLockManager";

// A local type for the spring event from react-spring-bottom-sheet
type SpringEvent = {
  current?: number;
  type: string;
};

/* ----------------------------------------------------------------
   1) PulsatingStrip Code (1px height)
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

    stripRef.current!.style.transform = `scale(${scale})`;
    stripRef.current!.style.backgroundColor = color;
    stripRef.current!.style.opacity = opacity.toString();
    stripRef.current!.style.boxShadow = `0px 4px 10px rgba(0,0,0,${shadowIntensity})`;

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
      height: "1px",
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
   2) Simple InfoModal
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
   3) The Sheet with dynamic snap points
   - Waits for content to be loaded before rendering
---------------------------------------------------------------- */
interface SheetProps {
  isOpen: boolean; // signals when we want the sheet open
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  onDismiss?: () => void;
}

export default function Sheet({
  isOpen,
  children,
  className,
  title,
  subtitle,
  count,
  countLabel,
  onDismiss,
}: SheetProps) {
  // 1) We'll track whether our content is fully loaded
  //   (this is a trivial 0.5s delay as a demonstration)
  const [isContentReady, setIsContentReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsContentReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // If content not ready, don't render the sheet at all
  if (!isContentReady) {
    return null;
  }

  // 2) Once content is ready, proceed:

  // Increase scrollLock count when open
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // Simple info modal trigger
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Measure the sheet's content for dynamic snap
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  // Reference to BottomSheet for programmatic snapping
  const sheetRef = useRef<BottomSheetRef>(null);

  // Two snap points (collapsed & expanded)
  const snapPoints = useCallback(
    ({ maxHeight }: { maxHeight: number }) => {
      const collapsed = 120; // px from bottom
      const expanded = Math.min(contentHeight + 60, maxHeight * 0.9);
      return [collapsed, expanded];
    },
    [contentHeight]
  );

  // Default to expanded
  const defaultSnap = useCallback(
    ({ maxHeight }: { maxHeight: number }) => {
      const expanded = Math.min(contentHeight + 60, maxHeight * 0.9);
      return expanded;
    },
    [contentHeight]
  );

  // Imperatively snap to expanded whenever isOpen changes to true
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.snapTo(({ maxHeight }) => {
        const expanded = Math.min(contentHeight + 60, maxHeight * 0.9);
        return expanded;
      });
    }
  }, [isOpen, contentHeight]);

  // Prevent dragging below collapsed snap
  const handleSpringEnd = useCallback(
    (event: SpringEvent) => {
      if ("current" in event && typeof event.current === "number") {
        const collapsed = 120; // Must match the lower snap point
        if (event.current < collapsed) {
          // Force sheet back to the collapsed position
          sheetRef.current?.snapTo(() => collapsed);
        }
      }
    },
    []
  );

  // Header markup (no chevron icon/button)
  const SheetHeader = (
    <div>
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-left">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-300">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setInfoModalOpen(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>
      <PulsatingStrip className="mt-2 mx-4" />
    </div>
  );

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        open={isOpen}
        onDismiss={onDismiss}
        header={SheetHeader}
        className={cn("custom-sheet", className)}
        blocking={false}
        onDismiss={() => {
          /* no-op: prevents the sheet from dismissing */
        }}
        snapPoints={snapPoints}
        defaultSnap={defaultSnap}
        expandOnContentDrag={false}
        onSpringEnd={handleSpringEnd}
      >
        <div
          ref={contentRef}
          className="relative px-4 pt-2 pb-6"
          style={{ maxHeight: "100vh", overflow: "hidden" }}
        >
          {children}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <div className="w-32 h-1 rounded-full bg-white/25" />
          </div>
        </div>
      </BottomSheet>

      <InfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
      />
    </>
  );
}
