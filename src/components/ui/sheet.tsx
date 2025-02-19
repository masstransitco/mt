"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  ReactNode,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

// (Optional) scroll-lock utilities
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

/* ----------------------------------------------------------------
   1) PulsatingStrip Code (same as your snippet)
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

function lerp(start: number, end: number, progress: number) {
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

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        ref={stripRef}
        style={{
          width: "110%",
          height: "1px",
          borderRadius: "1px",
          backgroundColor: ANIMATION_PARAMS.colors.primary,
          willChange: "transform, opacity, boxShadow",
          transition: "transform 0.05s ease-out",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------
   2) InfoModal (optional, same as your snippet)
---------------------------------------------------------------- */
function InfoModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded shadow-md">
        <p>Information about this sheet!</p>
        <button
          onClick={onClose}
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------
   3) SheetProps and the bottom sheet (Framer Motion)
------------------------------------------------------------ */
export interface SheetProps {
  isOpen: boolean;
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
  // 1) (Optional) Lock body scroll when sheet is open
  useLayoutEffect(() => {
    if (isOpen) {
      incrementOpenSheets();
      // If you want to fully lock scrolling behind the sheet:
      document.body.style.overflow = "hidden";
    } else {
      decrementOpenSheets();
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
      decrementOpenSheets();
    };
  }, [isOpen]);

  // 2) Info modal state
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // 3) Remove vertical drag so we don’t interfere with horizontal swipes
  //    If you still want to allow drag->dismiss, you can keep it, but it
  //    can conflict with horizontal scroll gestures on mobile.
  const handleDragEnd = useCallback(() => {
    /* no-op if removing vertical drag altogether */
  }, []);

  // 4) Sheet header
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
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[999] flex flex-col pointer-events-none"
            // We remove vertical/horizontal scroll from the sheet container
          >
            {/* 5) Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onDismiss}
            />

            {/* 6) The sheet container (NO vertical drag) */}
            <motion.div
              className="pointer-events-auto mt-auto w-full"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              // Remove drag props to avoid capturing vertical swipes
              onDragEnd={handleDragEnd}
            >
              <div className={cn("relative bg-background rounded-t-xl shadow-xl", className)}>
                {SheetHeader}

                {/* 
                  7) The main content
                  Remove 'overflow-y-auto' & 'max-h-[80vh]' so the
                  sheet itself is not scrollable. 
                  Instead, your child component can handle scrolling 
                  (horizontal or otherwise).
                */}
                <div className="px-4 pt-2 pb-6 overflow-hidden">
                  {children}

                  {/* Optional handle at bottom */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <div className="w-32 h-1 rounded-full bg-white/25" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Info modal if you want it */}
      <InfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </>
  );
}
