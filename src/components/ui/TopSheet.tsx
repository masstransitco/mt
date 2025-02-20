import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, useDragControls } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------
   Local PulsatingStrip Component
--------------------------------------- */
function PulsatingStrip({ className }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback((currentTime: number) => {
    if (!startTimeRef.current) startTimeRef.current = currentTime;
    if (!stripRef.current) return;

    const elapsed = currentTime - startTimeRef.current;
    const progress = (elapsed % 1400) / 1400;

    let scale = 0.95;
    let color = "#2171ec";
    let opacity = 1;
    let shadowIntensity = 0.3;

    if (progress < 0.1) {
      scale = 1.05;
      color = "#4a9fe8";
      shadowIntensity = 0.6;
    } else if (progress < 0.2) {
      scale = 0.97;
      color = "#4a9fe8";
      opacity = 0.9;
      shadowIntensity = 0.4;
    } else if (progress < 0.3) {
      scale = 1.02;
      color = "#6abff0";
      opacity = 0.95;
      shadowIntensity = 0.5;
    } else if (progress < 0.4) {
      scale = 0.95;
      color = "#4a9fe8";
      opacity = 0.85;
      shadowIntensity = 0.4;
    } else if (progress < 0.7) {
      scale = 0.95;
      color = "#2171ec";
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
          height: "1px",
          borderRadius: "1px",
          backgroundColor: "#2171ec",
          willChange: "transform, opacity, boxShadow",
          transition: "transform 0.05s ease-out",
          transformOrigin: "center",
        }}
      />
    </div>
  );
}

/* ---------------------------------------
   TopSheet Component with Dragging from Bottom to Close
--------------------------------------- */
export interface TopSheetProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  onDismiss?: () => void;
}

export default function TopSheet({
  isOpen,
  children,
  className,
  title,
  subtitle,
  count,
  countLabel,
  onDismiss,
}: TopSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) y.set(0);
  }, [isOpen, y]);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      if (info.offset.y < -100) {
        onDismiss?.();
      }
    },
    [onDismiss]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragControls.start(e);
  };

  // Header content
  const SheetHeader = (
    <div
      onPointerDown={handlePointerDown}
      className="cursor-grab active:cursor-grabbing px-4 pt-4"
    >
      {/* Title/subtitle/count */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-300">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>

        {/* Info button */}
        <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <Info className="w-5 h-5" />
        </button>
      </div>

      <PulsatingStrip className="mt-2 mx-auto" />
    </div>
  );

  const combinedStyle = {
    ...{ y, opacity: sheetOpacity },
    touchAction: "pan-y",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col pointer-events-none">
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
            style={combinedStyle}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false} // only drag from header
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
          >
            <div className={cn("relative bg-background rounded-t-xl shadow-xl", className)}>
              <div ref={contentRef} className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto">
                {children}
              </div>
              {SheetHeader} {/* Header moved to bottom */}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
