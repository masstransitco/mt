import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, useDragControls } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulsatingStrip } from "./PulsatingStrip"; // Import the PulsatingStrip component

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
  const [isInfoOpen, setIsInfoOpen] = useState(false); // State to control InfoBox visibility
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

  // InfoBox content
  const InfoBox = (
    <div className="absolute top-0 right-0 bg-white p-4 shadow-md rounded-lg">
      <p className="text-sm text-gray-700">
        {count} {countLabel ?? "items"} available
      </p>
    </div>
  );

  // Header content with button to dismiss
  const SheetHeader = (
    <div
      onPointerDown={handlePointerDown}
      className="cursor-grab active:cursor-grabbing px-4 pt-4 flex items-center justify-between"
    >
      {/* Dispatch car button and info icon in the same row */}
      <button
        className="flex-grow text-left text-lg font-semibold"
        onClick={onDismiss}
      >
        Dispatch a car
      </button>

      {/* Info button */}
      <button
        className="p-2 rounded-full hover:bg-white/10 transition-colors"
        onClick={() => setIsInfoOpen(!isInfoOpen)} // Toggle the info box visibility
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Display InfoBox if visible */}
      {isInfoOpen && InfoBox}

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
              {/* Body content */}
              <div ref={contentRef} className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto">
                {children}
              </div>

              {/* Pulsating Strip Divider */}
              <PulsatingStrip className="mt-4" />

              {/* Header content moved below */}
              {SheetHeader}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
