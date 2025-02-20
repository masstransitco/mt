import React, { useState, useEffect, useRef, useCallback, ReactNode, useMemo } from "react";
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

const InfoBox = ({ count, countLabel }: { count: number; countLabel?: string }) => (
  <div className="absolute top-0 right-0 bg-white p-4 shadow-md rounded-lg">
    <p className="text-sm text-gray-700">
      {count} {countLabel ?? "items"} available
    </p>
  </div>
);

const SheetHeader = ({
  onDismiss,
  setIsInfoOpen,
  isInfoOpen,
  handlePointerDown,  // <-- Added handlePointerDown prop here
}: {
  onDismiss?: () => void;
  setIsInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isInfoOpen: boolean;
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void; // <-- Added type for the function
}) => (
  <div
    onPointerDown={handlePointerDown}  // <-- Use the handlePointerDown passed as a prop
    className="cursor-grab active:cursor-grabbing px-4 pt-4 flex items-center justify-between"
  >
    {/* Dispatch car button and info icon in the same row */}
    <button
      className="bg-gray-300 text-black text-center py-2 px-4 rounded-md text-lg font-medium hover:bg-gray-400 transition-colors"
      onClick={onDismiss}
    >
      Dispatch car
    </button>

    {/* Info button */}
    <button className="p-2 rounded-full hover:bg-white/10 transition-colors" onClick={() => setIsInfoOpen(!isInfoOpen)}>
      <Info className="w-5 h-5" />
    </button>

    {/* Display InfoBox if visible */}
    {isInfoOpen && <InfoBox count={count} countLabel={countLabel} />}
    
    <PulsatingStrip className="mt-2 mx-auto" />
  </div>
);

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

  const y = useMotionValue(-100); // Start the sheet above the viewport
  const sheetOpacity = useTransform(y, [-300, 0], [1, 0.6], { clamp: false }); // Animate opacity based on the y position
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) y.set(-100); // Reset position when closed
  }, [isOpen, y]);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { y: number } }) => {
      if (info.offset.y > 100) {
        onDismiss?.();
      }
    },
    [onDismiss]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragControls.start(e);
  };

  const combinedStyle = useMemo(
    () => ({
      ...{ y, opacity: sheetOpacity },
      touchAction: "pan-y",
    }),
    [y, sheetOpacity]
  );

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
            <div className={cn("relative bg-background rounded-xl shadow-xl", className)}>
              {/* Body content */}
              <div ref={contentRef} className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto">
                {children}
              </div>

              {/* Pulsating Strip Divider */}
              <PulsatingStrip className="mt-4" />

              {/* Header content moved below */}
              <SheetHeader
                onDismiss={onDismiss}
                setIsInfoOpen={setIsInfoOpen}
                isInfoOpen={isInfoOpen}
                handlePointerDown={handlePointerDown}  // <-- Pass handlePointerDown here
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
