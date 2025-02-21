import React, { useState, useRef, useEffect, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// (Remove import of PulsatingStrip and any references to it)

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

/* -----------------------------------------------------------
   InfoBox Subcomponent
----------------------------------------------------------- */
const InfoBox = ({ count, countLabel }: { count: number; countLabel?: string }) => (
  <div className="absolute top-0 right-0 bg-white p-4 shadow-md rounded-lg">
    <p className="text-sm text-gray-700">
      {count} {countLabel ?? "items"} available
    </p>
  </div>
);

/* -----------------------------------------------------------
   TopSheet Component
----------------------------------------------------------- */
export default function TopSheet({
  isOpen,
  children,
  className,
  title,
  subtitle,
  count = 0,
  countLabel,
  onDismiss,
}: TopSheetProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // You can keep this scrollable content area if desired
  useEffect(() => {
    // If you had any logic for overflow, you can remove it or leave it out.
  }, [children]);

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

          {/* Slide-in TopSheet (no drag) */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            initial={{ y: -20 }}
            animate={{ y: -40 }}
            exit={{ y: -50 }}
            transition={{ type: "spring", damping: 50, stiffness: 200 }}
          >
            <div
              className={cn(
                "relative bg-background rounded-2xl shadow-xl overflow-hidden",
                className
              )}
              style={{ fontFamily: "Helvetica Neue" }}
            >
              {/* Gradient shadow overlay */}
              <div className="absolute inset-x-0 bottom-0 h-10 z-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

              {/* Scrollable body content */}
              <div
                ref={contentRef}
                className="px-4 pt-4 pb-6 max-h-[70vh] overflow-y-auto"
              >
                {children}
              </div>

              {/* Bottom row: Info & Dispatch button. 
                  Dispatch button flexes to fill remaining space. */}
              <div className="relative flex items-center px-4 pb-4 gap-2">
                {/* Info Button */}
                <button
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  onClick={() => setIsInfoOpen(!isInfoOpen)}
                >
                  <Info className="w-5 h-5" />
                </button>

                {/* Dispatch Car Button (takes full width until the icon) */}
                <button
                  className="flex-1 bg-gray-300 text-black py-2 px-4 rounded-md text-lg font-medium hover:bg-gray-400 transition-colors"
                  onClick={onDismiss}
                >
                  Dispatch for pick-up
                </button>

                {/* InfoBox (absolute) */}
                {isInfoOpen && <InfoBox count={count} countLabel={countLabel} />}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
