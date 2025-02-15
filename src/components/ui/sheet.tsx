"use client";

import React, {
  ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  incrementOpenSheets,
  decrementOpenSheets,
} from "@/lib/scrollLockManager";

// The rest of your existing PulsatingStrip code remains the same...
// ...omitting for brevity

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  /** We now pass "Departure" or "Arrival" via `title` */
  title?: string;
  /**
   * We now pass "Pick up the car from this station"
   * or "Return the car at this station" via `countLabel`
   */
  countLabel?: string;
}

/**
 * Sheet component that:
 * - Disables page scroll when open.
 * - Displays a bottom sheet with a header + optional pulsating strip.
 */
const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  countLabel,
}: SheetProps) => {
  // Lock body scrolling if isOpen
  useLayoutEffect(() => {
    if (isOpen) incrementOpenSheets();
    return () => {
      if (isOpen) decrementOpenSheets();
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-card/95 backdrop-blur-sm rounded-t-lg",
        "overflow-hidden transition-[max-height] duration-500 ease-in-out",
        isOpen ? "max-h-[70vh]" : "max-h-0",
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div>
            {/* Title: e.g. "Departure" / "Arrival" */}
            {title && (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            )}

            {/* Subtext: e.g. "Pick up the car..." / "Return the car..." */}
            {countLabel && (
              <p className="text-sm text-muted-foreground">{countLabel}</p>
            )}
          </div>

          <div className="flex items-center">
            <button
              onClick={onToggle}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close sheet"
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Pulsating strip */}
        {/* If you want to keep it, it remains the same */}
        {/* <PulsatingStrip /> */}

        {/* Scrollable content area */}
        <div className="relative flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default Sheet;
