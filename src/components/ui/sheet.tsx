"use client";

import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
} from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   ANIMATION CONSTANTS & HELPER
   PulsatingStrip repeatedly scales and changes color/opacity.
   ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------
   PULSATING STRIP
   ------------------------------------------------------------------ */
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [animate]);

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        ref={stripRef}
        style={{
          width: "110%",
          height: "2px",
          borderRadius: "1px",
          backgroundColor: ANIMATION_PARAMS.colors.primary,
          willChange: "transform, opacity, boxShadow",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   SHEET PROPS
   - title, subtitle, etc.
   ------------------------------------------------------------------ */
export interface SheetProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: ReactNode; // You can pass React elements or strings
  count?: number;
  countLabel?: string;
  onDismiss?: () => void;
  onClearSelection?: () => void; // For X button to clear station
}

/* ------------------------------------------------------------------
   SHEET COMPONENT (DRAGGABLE BOTTOM-SHEET)
   ------------------------------------------------------------------ */
export default function Sheet({
  isOpen,
  children,
  className,
  title,
  subtitle,
  count,
  countLabel,
  onDismiss,
  onClearSelection,
}: SheetProps) {
  const [isAtTop, setIsAtTop] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const isClosing = useRef(false);
  const minimizedPosition = useRef(0);

  // Measure header height for minimized state
  useEffect(() => {
    if (headerRef.current) {
      const headerHeight = headerRef.current.offsetHeight + 16; // Add some buffer
      minimizedPosition.current = window.innerHeight - headerHeight;
    }
  }, [isOpen, title, subtitle, count]);

  // Lock body scroll when sheet is open and not minimized
  useEffect(() => {
    if (isOpen && !isMinimized) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMinimized]);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      isClosing.current = false;
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Keep track if user scrolled the sheet
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

  // Framer Motion: handle drag
  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    } else if (isMinimized && minimizedPosition.current > 0) {
      y.set(minimizedPosition.current);
    } else {
      y.set(0);
    }
  }, [isOpen, isMinimized, y]);

  // Handle X button click (clear selection)
  const handleClear = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;

    if (onClearSelection) {
      onClearSelection();
    }
    
    setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, 50);
  }, [onClearSelection, onDismiss]);

  // Handle backdrop click to minimize sheet
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsMinimized(true);
      if (minimizedPosition.current > 0) {
        y.set(minimizedPosition.current);
      }
    }
  }, [y]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      const dragDistance = info.offset.y;
      
      // If dragged up significantly, expand the sheet
      if (dragDistance < -20 && isMinimized) {
        setIsMinimized(false);
        y.set(0);
        return;
      }
      
      // If dragged down significantly, minimize or close
      if (dragDistance > 100) {
        if (isMinimized) {
          // If already minimized and dragged down further, close
          if (onDismiss) {
            onDismiss();
          }
        } else {
          // If expanded and dragged down, minimize
          setIsMinimized(true);
          if (minimizedPosition.current > 0) {
            y.set(minimizedPosition.current);
          }
        }
        return;
      }
      
      // If not dragged far enough, snap to nearest position
      if (isMinimized) {
        y.set(minimizedPosition.current);
      } else {
        y.set(0);
      }
    },
    [isMinimized, y, onDismiss]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragControls.start(e);
  };

  // Toggle minimized state on header click
  const handleHeaderClick = useCallback(() => {
    setIsMinimized(!isMinimized);
    if (!isMinimized && minimizedPosition.current > 0) {
      y.set(minimizedPosition.current);
    } else {
      y.set(0);
    }
  }, [isMinimized, y]);

  // Sheet Header content
  const SheetHeader = (
    <div
      ref={headerRef}
      onPointerDown={handlePointerDown}
      onClick={handleHeaderClick}
      className="cursor-grab active:cursor-grabbing px-4 pt-4 relative"
    >
      <div className="flex items-center justify-between">
        <div className="text-left">
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
          {subtitle && <div className="text-sm text-gray-300">{subtitle}</div>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-300">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>
        {onClearSelection && (
          <button
            className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-gray-700/50 transition-colors"
            onClick={handleClear}
          >
            <X className="w-5 h-5 text-gray-300" />
            <span className="sr-only">Clear</span>
          </button>
        )}
      </div>
      <PulsatingStrip className="mt-3 mx-auto" />
    </div>
  );

  const combinedStyle = { y, opacity: sheetOpacity, touchAction: "pan-y" };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col pointer-events-none">
          {/* Backdrop - only blocks interaction when NOT minimized */}
          <motion.div
            className={`absolute inset-0 bg-black/60 ${isMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: isMinimized ? 0.3 : 0.6 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
          />
          {/* Draggable sheet */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            style={combinedStyle}
            initial={{ y: "100%" }}
            animate={{ y: isMinimized ? minimizedPosition.current : 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            onDragEnd={handleDragEnd}
          >
            <div
              className={cn(
                "relative bg-black text-white rounded-t-lg shadow-2xl border-t border-gray-800",
                className
              )}
            >
              {SheetHeader}
              <motion.div
                ref={contentRef}
                animate={{ 
                  maxHeight: isMinimized ? "0px" : "80vh",
                  opacity: isMinimized ? 0 : 1
                }}
                transition={{ duration: 0.3 }}
                className="px-4 pt-3 pb-8 overflow-y-auto"
                style={{ 
                  display: isMinimized ? "none" : "block",
                  visibility: isMinimized ? "hidden" : "visible"
                }}
              >
                {children}
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
