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
  const sheetRef = useRef<HTMLDivElement>(null);
  const isClosing = useRef(false);
  const minimizedPosition = useRef(0);
  const windowHeight = useRef(0);
  const isTransitioning = useRef(false);

  // Track window dimensions for proper positioning
  useEffect(() => {
    const updateDimensions = () => {
      windowHeight.current = window.innerHeight;
      if (headerRef.current) {
        const headerHeight = headerRef.current.offsetHeight + 4; // Add a small buffer
        minimizedPosition.current = windowHeight.current - headerHeight;
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Ensure header height calculation happens after render
  useEffect(() => {
    if (isOpen && headerRef.current) {
      const headerHeight = headerRef.current.offsetHeight + 4;
      minimizedPosition.current = window.innerHeight - headerHeight;
    }
  }, [isOpen, title, subtitle, count]);

  // Handle body scroll lock with better cleanup
  useEffect(() => {
    let originalOverflow = '';
    let originalPosition = '';
    let originalHeight = '';
    let originalTop = '';
    
    if (isOpen && !isMinimized) {
      originalOverflow = document.body.style.overflow;
      originalPosition = document.body.style.position;
      originalHeight = document.body.style.height;
      originalTop = document.body.style.top;
      
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.height = '100%';
      document.body.style.width = '100%';
    }
    
    return () => {
      if (originalOverflow || originalPosition || originalHeight || originalTop) {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.height = originalHeight;
        
        if (originalTop) {
          const scrollY = parseInt(originalTop.replace('-', '').replace('px', ''));
          document.body.style.top = originalTop;
          window.scrollTo(0, scrollY);
        }
      }
    };
  }, [isOpen, isMinimized]);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      isClosing.current = false;
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Track content scroll
  const handleScroll = useCallback(() => {
    if (contentRef.current) {
      setIsAtTop(contentRef.current.scrollTop <= 0);
    }
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Motion control for dragging
  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });
  const dragControls = useDragControls();

  // Position update effect
  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    } else if (isMinimized && minimizedPosition.current > 0) {
      y.set(minimizedPosition.current);
    } else {
      y.set(0);
    }
  }, [isOpen, isMinimized, y]);

  // Handle clear selection button (X)
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to header click
    
    if (isClosing.current) return;
    isClosing.current = true;

    if (onClearSelection) {
      onClearSelection();
    }
    
    // Small delay to ensure state updates before dismissal
    setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
    }, 50);
  }, [onClearSelection, onDismiss]);

  // Handle backdrop click to minimize sheet
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking directly on the backdrop
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      
      if (isTransitioning.current) return;
      isTransitioning.current = true;
      
      setIsMinimized(true);
      if (minimizedPosition.current > 0) {
        y.set(minimizedPosition.current);
      }
      
      // Reset transitioning state after animation completes
      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    }
  }, [y]);

  // Handle drag end with better thresholds
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number }, velocity: { y: number } }) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;
      
      const dragDistance = info.offset.y;
      const dragVelocity = info.velocity.y;
      
      // Use velocity for more natural interactions
      const isQuickDrag = Math.abs(dragVelocity) > 500;
      
      // If dragged up quickly or significantly, expand sheet
      if ((dragDistance < -20 || (dragVelocity < -300)) && isMinimized) {
        setIsMinimized(false);
        y.set(0);
      } 
      // If dragged down quickly or significantly when minimized, close sheet
      else if ((dragDistance > 100 || (dragVelocity > 300 && dragDistance > 30)) && isMinimized) {
        if (onDismiss) {
          onDismiss();
        }
      }
      // If dragged down quickly or significantly when expanded, minimize sheet
      else if ((dragDistance > 100 || (dragVelocity > 300 && dragDistance > 30)) && !isMinimized) {
        setIsMinimized(true);
        if (minimizedPosition.current > 0) {
          y.set(minimizedPosition.current);
        }
      }
      // If not dragged far or fast enough, snap to nearest position
      else {
        if (isMinimized) {
          y.set(minimizedPosition.current);
        } else {
          y.set(0);
        }
      }
      
      // Reset transitioning state after animation completes
      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    },
    [isMinimized, y, onDismiss]
  );

  // Start drag operation
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dragControls.start(e);
  }, [dragControls]);

  // Toggle minimized state on header click
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    
    setIsMinimized(!isMinimized);
    if (!isMinimized && minimizedPosition.current > 0) {
      y.set(minimizedPosition.current);
    } else {
      y.set(0);
    }
    
    // Reset transitioning state after animation completes
    setTimeout(() => {
      isTransitioning.current = false;
    }, 300);
  }, [isMinimized, y]);

  // Sheet Header content
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
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-200", 
              isMinimized ? "pointer-events-none opacity-30" : "pointer-events-auto opacity-60"
            )}
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
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 300, 
              restDelta: 0.5 
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1} // Reduced elasticity for more precise dragging
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
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
                  overflow: isMinimized ? "hidden" : "auto"
                }}
                transition={{ duration: 0.2 }}
                className="px-4 pt-3 pb-8 overflow-y-auto"
                style={{ 
                  maxHeight: "80vh",
                  pointerEvents: isMinimized ? "none" : "auto"
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
