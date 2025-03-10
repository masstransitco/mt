"use client";

import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
} from "framer-motion";
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
   SHEET PROPS (no onClearSelection)
   ------------------------------------------------------------------ */
export interface SheetProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: ReactNode; // You can pass React elements or strings
  count?: number;
  countLabel?: string;
  /** 
   * If you want to remove the sheet from DOM on full close, 
   * your parent can pass `onDismiss`, but the logic in this component 
   * never triggers "close" except the parent toggles `isOpen`.
   */
  onDismiss?: () => void;
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
}: SheetProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const minimizedPosition = useRef(0);
  const windowHeight = useRef(0);
  const isTransitioning = useRef(false);
  const dragStartY = useRef(0);

  // Track window dimensions for proper positioning
  useEffect(() => {
    const updateDimensions = () => {
      windowHeight.current = window.innerHeight;
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight + 4;
        minimizedPosition.current = windowHeight.current - headerHeight;
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Recalc position each time we open
  useEffect(() => {
    if (isOpen && headerRef.current) {
      const headerHeight = headerRef.current.offsetHeight + 4;
      minimizedPosition.current = window.innerHeight - headerHeight;
    }
  }, [isOpen, title, subtitle, count]);

  // Lock scroll only when fully open (not minimized)
  useEffect(() => {
    let originalOverflow = "";
    let originalPosition = "";
    let originalHeight = "";
    let originalTop = "";

    if (isOpen && !isMinimized) {
      originalOverflow = document.body.style.overflow;
      originalPosition = document.body.style.position;
      originalHeight = document.body.style.height;
      originalTop = document.body.style.top;

      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.height = "100%";
      document.body.style.width = "100%";
    }

    return () => {
      if (originalOverflow || originalPosition || originalHeight || originalTop) {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.height = originalHeight;

        if (originalTop) {
          const scrollY = parseInt(originalTop.replace("-", "").replace("px", ""), 10);
          document.body.style.top = originalTop;
          window.scrollTo(0, scrollY);
        }
      }
    };
  }, [isOpen, isMinimized]);

  // Reset the sheet state each time it opens
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Framer Motion controls
  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });
  const dragControls = useDragControls();

  // Re-sync minimized state with y
  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    } else if (isMinimized && minimizedPosition.current > 0) {
      y.set(minimizedPosition.current);
    } else {
      y.set(0);
    }
  }, [isOpen, isMinimized, y]);

  /* ----------------------------------------------------------------
     BACKDROP CLICK => only minimize if expanded
  ---------------------------------------------------------------- */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        e.stopPropagation();

        if (isTransitioning.current) return;
        isTransitioning.current = true;

        // If not minimized => minimize
        if (!isMinimized && minimizedPosition.current > 0) {
          setIsMinimized(true);
          y.set(minimizedPosition.current);
        }

        setTimeout(() => {
          isTransitioning.current = false;
        }, 300);
      }
    },
    [isMinimized, y]
  );

  /* ----------------------------------------------------------------
     DRAG START => store initial y position
  ---------------------------------------------------------------- */
  const handleDragStart = useCallback(() => {
    dragStartY.current = y.get();
  }, [y]);

  /* ----------------------------------------------------------------
     DRAG END => expand or minimize only, never close
  ---------------------------------------------------------------- */
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      const dragDistance = info.offset.y;
      const dragVelocity = info.velocity.y;
      const currentPos = y.get();

      const draggedUpward = currentPos < dragStartY.current;
      const draggedDownward = currentPos > dragStartY.current;

      // If starting from expanded
      if (dragStartY.current < 50) {
        // If dragged down significantly => minimize
        if (draggedDownward && (dragDistance > 100 || dragVelocity > 300)) {
          setIsMinimized(true);
          y.set(minimizedPosition.current);
        } else {
          // remain expanded
          setIsMinimized(false);
          y.set(0);
        }
      }
      // If starting from minimized
      else if (Math.abs(dragStartY.current - minimizedPosition.current) < 50) {
        // If dragged up significantly => expand
        if (draggedUpward && (dragDistance < -20 || dragVelocity < -300)) {
          setIsMinimized(false);
          y.set(0);
        } else {
          // remain minimized
          setIsMinimized(true);
          y.set(minimizedPosition.current);
        }
      }
      // Otherwise, snap to whichever is closer
      else {
        const halfwayPoint = minimizedPosition.current / 2;
        if (currentPos < halfwayPoint) {
          setIsMinimized(false);
          y.set(0);
        } else {
          setIsMinimized(true);
          y.set(minimizedPosition.current);
        }
      }

      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    },
    [y]
  );

  /* ----------------------------------------------------------------
     HEADER CLICK => just toggle minimized/expanded
  ---------------------------------------------------------------- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      dragControls.start(e);
    },
    [dragControls]
  );

  const handleHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      setIsMinimized(!isMinimized);
      if (!isMinimized && minimizedPosition.current > 0) {
        y.set(minimizedPosition.current);
      } else {
        y.set(0);
      }

      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    },
    [isMinimized, y]
  );

  // Sheet header
  const SheetHeader = (
    <div
      ref={headerRef}
      onPointerDown={handlePointerDown}
      onClick={handleHeaderClick}
      className="cursor-grab active:cursor-grabbing px-4 pt-4 pb-2 relative"
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
        {/* No X button here */}
      </div>
      <PulsatingStrip className="mt-3 mx-auto" />
    </div>
  );

  // Combine transforms for the draggable motion
  const combinedStyle = {
    y,
    opacity: sheetOpacity,
    touchAction: "pan-y",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col pointer-events-none">
          {/* Only show a clickable backdrop if expanded */}
          {!isMinimized && (
            <motion.div
              className="absolute inset-0 bg-black pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
            />
          )}

          {/* Draggable sheet */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            style={combinedStyle}
            initial={{ y: "100%" }}
            animate={{ y: isMinimized ? minimizedPosition.current : 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              restDelta: 0.5,
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: minimizedPosition.current }}
            dragElastic={0.1}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={sheetRef}
              className={cn(
                "relative bg-black text-white rounded-t-lg shadow-2xl border-t border-gray-800",
                className
              )}
            >
              {SheetHeader}

              {/* Content area */}
              <motion.div
                ref={contentRef}
                initial={false}
                animate={{
                  height: isMinimized ? 0 : "auto",
                  opacity: isMinimized ? 0 : 1,
                  overflow: isMinimized ? "hidden" : "auto",
                }}
                transition={{ duration: 0.2 }}
                className="px-4 pt-3 pb-8 overflow-y-auto"
                style={{
                  maxHeight: "80vh",
                  pointerEvents: isMinimized ? "none" : "auto",
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
