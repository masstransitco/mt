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
  const [isAtTop, setIsAtTop] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const isClosing = useRef(false);
  const childOnDismissRef = useRef<(() => void) | null>(null);

  // Helper function to find any StationDetail child components and get their onDismiss handler
  useEffect(() => {
    if (!contentRef.current) return;

    // Reset our ref
    childOnDismissRef.current = null;

    // Function to traverse the React component tree and find StationDetail components
    const findStationDetailComponent = (element: any) => {
      if (!element) return null;

      // Check if this is a StationDetail component (verify by checking its props)
      if (
        element.type?.name === 'StationDetailComponent' || 
        element.type?.displayName === 'memo(StationDetailComponent)'
      ) {
        // If it has a handleSafeDismiss method, save it
        return element.props?.onDismiss || null;
      }

      // If this element has children, check them
      if (element.props?.children) {
        if (Array.isArray(element.props.children)) {
          for (const child of element.props.children) {
            const result = findStationDetailComponent(child);
            if (result) return result;
          }
        } else {
          return findStationDetailComponent(element.props.children);
        }
      }

      return null;
    };

    // Try to find the component
    if (children) {
      childOnDismissRef.current = findStationDetailComponent(children);
    }
  }, [children, isOpen]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      isClosing.current = false; // Reset closing state when sheet opens
      return () => {
        document.body.style.overflow = originalOverflow;
      };
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
    }
  }, [isOpen, y]);

  // Handle dismiss with debouncing to prevent multiple calls
  const handleDismiss = useCallback(() => {
    if (isClosing.current) return;
    
    isClosing.current = true;

    // First check for child onDismiss handlers (StationDetail)
    if (childOnDismissRef.current) {
      try {
        childOnDismissRef.current();
      } catch (e) {
        console.error("Error calling child dismiss:", e);
      }
    }
    
    // Small delay to allow state to stabilize
    setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, 100); // Increased delay to ensure child components have time to process
  }, [onDismiss]);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      if (info.offset.y > 100) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only dismiss if clicking directly on the backdrop element
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  }, [handleDismiss]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragControls.start(e);
  };

  // Sheet Header content: no mention of "Trip Details" now
  const SheetHeader = (
    <div
      onPointerDown={handlePointerDown}
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
        {onDismiss && (
          <button
            className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-gray-700/50 transition-colors"
            onClick={handleDismiss} // Using debounced dismiss handler
          >
            <X className="w-5 h-5 text-gray-300" />
            <span className="sr-only">Close</span>
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
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick} // Using safer backdrop click handler
          />
          {/* Draggable sheet */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            style={combinedStyle}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
          >
            <div
              className={cn(
                "relative bg-black text-white rounded-t-lg shadow-2xl border-t border-gray-800",
                className
              )}
            >
              {SheetHeader}
              <div
                ref={contentRef}
                className="px-4 pt-3 pb-8 max-h-[80vh] overflow-y-auto"
              >
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
