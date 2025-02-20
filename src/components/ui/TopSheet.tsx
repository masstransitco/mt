"use client";

import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useTransform, useDragControls } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulsatingStrip } from "./Sheet"; // Import the PulsatingStrip from the Sheet component

/* ---------------------------------------
   1) TopSheet Component with Dragging from Top
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
  const [isAtTop, setIsAtTop] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Lock scroll on the <body> behind the sheet
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Check if user has scrolled the sheet body
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

  // Framer Motion for vertical drag
  const y = useMotionValue(0);
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });
  const dragControls = useDragControls();

  // Reset y when isOpen changes
  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    }
  }, [isOpen, y]);

  // If user drags the sheet downward >100px, dismiss
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      if (info.offset.y > 100) {
        onDismiss?.();
      }
    },
    [onDismiss]
  );

  // Only start drag from the header
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

        {/* Example Info button */}
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
          {/* Backdrop - clicking it dismisses the sheet */}
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
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false} // only drag from header
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleDragEnd}
          >
            <div className={cn("relative bg-background rounded-b-xl shadow-xl", className)}>
              {SheetHeader}
              <div ref={contentRef} className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
