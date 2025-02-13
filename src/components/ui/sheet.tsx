"use client";

import React, { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  count?: number;
  countLabel?: string;
}

const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  count,
}: SheetProps) => {
  // Disable page scrolling whenever `isOpen` is true
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      // Restore normal overflow
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm",
        // ↑ Overflow hidden so we can animate the max-height smoothly
        "overflow-hidden",
        // ↓ Animate only the max-height property, over 0.5s with an ease-in-out curve
        "transition-[max-height] duration-500 ease-in-out",
        // If open => max-height is 50vh; if closed => max-height is 0
        isOpen ? "max-h-[50vh]" : "max-h-0",
        className
      )}
    >
      <div className="flex flex-col min-h-0">
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 border-b border-border/20">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {typeof count === "number" && (
              <p className="text-sm text-muted-foreground">
                {count} {countLabel ?? "stations found"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Example "Sort by" button */}
            <button className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              Sort by
            </button>

            {/* X button to close */}
            <button
              onClick={onToggle}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Close sheet"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Scrollable content inside the sheet */}
        <div className="overflow-y-auto">{children}</div>

        {/* Optional bottom handle */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
};

export default Sheet;
