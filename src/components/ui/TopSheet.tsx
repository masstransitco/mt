import React, { useState, useRef, useEffect, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  <div className="absolute top-0 right-0 bg-neutral-100 border border-gray-300 shadow-md p-3 rounded-md">
    <p className="text-sm text-black font-medium">
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

  // If you have any scroll-related logic, keep or remove as needed
  useEffect(() => {
    // Example: scroll to top when opened
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col pointer-events-none">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          {/* Slide-in TopSheet */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            exit={{ y: -50 }}
            transition={{ type: "spring", damping: 40, stiffness: 200 }}
          >
            <div
              className={cn(
                // Matches StationSelector style: bg-neutral-300, border, etc.
                "relative bg-neutral-300 text-black border border-gray-400 rounded-md shadow-md overflow-hidden",
                "mx-4 mb-4", // Some margin from edges
                className
              )}
            >
              {/* Optional Title & Subtitle (Header) */}
              {(title || subtitle) && (
                <div className="px-4 pt-3 pb-2 space-y-1 border-b border-gray-300">
                  {title && <h2 className="text-base font-semibold">{title}</h2>}
                  {subtitle && <p className="text-sm text-gray-800">{subtitle}</p>}
                </div>
              )}

              {/* Scrollable body content */}
              <div ref={contentRef} className="px-4 pt-3 pb-6 max-h-[60vh] overflow-y-auto">
                {children}
              </div>

              {/* Bottom row: Info & Dispatch button */}
              <div className="relative flex items-center px-4 pb-4 gap-2">
                {/* Info Button */}
                <button
                  className="
                    p-2 
                    rounded-full 
                    hover:bg-black/10 
                    transition-colors
                  "
                  onClick={() => setIsInfoOpen(!isInfoOpen)}
                  aria-label="Toggle info"
                >
                  <Info className="w-5 h-5 text-black" />
                </button>

                {/* Dispatch Car Button (takes full width minus the icon) */}
                <button
                  className="
                    flex-1 
                    bg-white 
                    text-black
                    border border-gray-300
                    py-2 px-4 
                    rounded-md 
                    text-base 
                    font-medium 
                    hover:bg-gray-100 
                    transition-colors
                  "
                  onClick={onDismiss}
                >
                  Choose a pick-up station
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
