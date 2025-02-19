"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------
   1) Animation constants for our PulsatingStrip
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

/* ----------------------------------------------------------------
   2) PulsatingStrip component
---------------------------------------------------------------- */
function PulsatingStrip({ className }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback((currentTime: number) => {
    if (!startTimeRef.current) startTimeRef.current = currentTime;
    if (!stripRef.current) return;

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

    if (stripRef.current) {
      stripRef.current.style.transform = `scale(${scale})`;
      stripRef.current.style.backgroundColor = color;
      stripRef.current.style.opacity = opacity.toString();
      stripRef.current.style.boxShadow = `0px 4px 10px rgba(0,0,0,${shadowIntensity})`;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    startTimeRef.current = undefined;
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
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
   3) Optional InfoModal component
---------------------------------------------------------------- */
function InfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded shadow-md">
        <p>Information about this sheet!</p>
        <button onClick={onClose} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded">
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ----------------------------------------------------------------
   4) SheetProps interface
---------------------------------------------------------------- */
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

/* ----------------------------------------------------------------
   5) Simplified Sheet component
---------------------------------------------------------------- */
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
  // Simple background scroll lock: lock the page when sheet is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Track if the sheet's content is scrolled to the top.
  const [isAtTop, setIsAtTop] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleScroll = useCallback(() => {
    if (contentRef.current) {
      setIsAtTop(contentRef.current.scrollTop <= 0);
    }
  }, []);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Framer Motion values for vertical drag
  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });

  // Reset vertical offset when the sheet is closed
  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    }
  }, [isOpen, y]);

  // When dragged down >100px, call onDismiss
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      if (info.offset.y > 100) {
        onDismiss?.();
      }
    },
    [onDismiss]
  );

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
        <button
          onClick={() => {}}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>
      <PulsatingStrip className="mt-2 mx-4" />
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[999] flex flex-col pointer-events-none">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onDismiss}
            />
            {/* Draggable sheet container */}
            <motion.div
              className="pointer-events-auto mt-auto w-full"
              style={{ y, opacity: sheetOpacity, touchAction: "pan-y" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag={isAtTop ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
            >
              <div className={cn("relative bg-background rounded-t-xl shadow-xl", className)}>
                {SheetHeader}
                {/* Content area with vertical scrolling */}
                <div
                  ref={contentRef}
                  className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto"
                >
                  {children}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}