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
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

// (Optional) scroll-lock utilities
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

/* ----------------------------------------------------------------
   1) PulsatingStrip (same as your snippet)
---------------------------------------------------------------- */
function PulsatingStrip({ className }: { className?: string }) {
  // ... unchanged ...
  return (
    <div className={cn("flex justify-center", className)}>
      <div /* your animated 1px strip code here */ />
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

/* ----------------------------------------------------------------
   3) SheetProps and bottom sheet using Framer Motion
---------------------------------------------------------------- */
export interface SheetProps {
  /** If true, the sheet is rendered open; if false, hidden. */
  isOpen: boolean;
  /** Content of the sheet */
  children: ReactNode;
  /** Additional class names for customization */
  className?: string;
  /** Header fields */
  title?: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  /**
   * Called when the user swipes down, drags down sufficiently,
   * or clicks the backdrop to dismiss.
   */
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
  // 1) (Optional) block scrolling behind the sheet
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  // 2) Info modal state
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // 3) Create a motion value for vertical drag
  const y = useMotionValue(0);

  // 4) If the sheet is closed, reset y to 0 so next open starts from bottom
  useEffect(() => {
    if (!isOpen) {
      y.set(0);
    }
  }, [isOpen, y]);

  // 5) Transform for opacity if you want a fade effect while dragging
  const sheetOpacity = useTransform(y, [0, 300], [1, 0.6], { clamp: false });

  // 6) onDragEnd => if dragged down >100px, dismiss
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: { offset: { x: number; y: number } }) => {
      if (info.offset.y > 100) {
        onDismiss?.();
      }
    },
    [onDismiss]
  );

  // 7) Sheet header
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
          <div className="fixed inset-0 z-[999] flex flex-col pointer-events-none">
            {/** 1) The backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onDismiss}
            />

            {/** 2) The sheet container */}
            <motion.div
              className="pointer-events-auto mt-auto w-full"
              style={{
                opacity: sheetOpacity,
                touchAction: "pan-y", // helps interpret vertical swipes
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={handleDragEnd}
              // Use the same motion value for better control if needed
              style={{ y, opacity: sheetOpacity, touchAction: "pan-y" }}
            >
              <div
                className={cn(
                  "relative bg-background rounded-t-xl shadow-xl",
                  className
                )}
              >
                {SheetHeader}

                {/** 3) Sheet Content with vertical scroll */}
                <div className="px-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto">
                  {children}

                  {/** Extra little handle at the bottom (optional) */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <div className="w-32 h-1 rounded-full bg-white/25" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/** Info modal if you want it */}
      <InfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
    </>
  );
}
