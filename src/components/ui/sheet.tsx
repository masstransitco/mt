"use client";

import React, { ReactNode, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { incrementOpenSheets, decrementOpenSheets } from "@/lib/scrollLockManager";

// Define the keyframe animation
const styles = `
  @keyframes doubleHeartbeat {
    0% {
      transform: scale(0.95);
      background-color: #2171ec;
      box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.3);
      opacity: 1;
    }
    10% {
      transform: scale(1.05);
      background-color: #4a9fe8;
      box-shadow: 0 4px 14px rgba(33,113,236, 0.6);
      opacity: 1;
    }
    20% {
      transform: scale(0.97);
      background-color: #4a9fe8;
      box-shadow: 0 4px 12px rgba(33,113,236, 0.4);
      opacity: 0.9;
    }
    30% {
      transform: scale(1.02);
      background-color: #6abff0;
      box-shadow: 0 4px 16px rgba(33,113,236, 0.5);
      opacity: 0.95;
    }
    40% {
      transform: scale(0.96);
      background-color: #4a9fe8;
      box-shadow: 0 4px 10px rgba(33,113,236, 0.4);
      opacity: 0.85;
    }
    70% {
      transform: scale(0.95);
      background-color: #2171ec;
      box-shadow: 0 4px 8px rgba(0,0,0, 0.3);
      opacity: 0.8;
    }
    100% {
      transform: scale(0.95);
      background-color: #2171ec;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulsating-strip {
      animation: none;
    }
  }

  .pulsating-strip {
    width: 99%;
    height: 3.2px;
    border-radius: 1.5px;
    background-color: #2171ec;
    will-change: transform, opacity, box-shadow;
    animation: doubleHeartbeat 1.4s ease-in-out infinite;
    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.3);
  }
`;

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
  countLabel,
}: SheetProps) => {
  useLayoutEffect(() => {
    if (isOpen) {
      incrementOpenSheets();
    }
    return () => {
      if (isOpen) {
        decrementOpenSheets();
      }
    };
  }, [isOpen]);

  return (
    <>
      <style>{styles}</style>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm",
          "overflow-hidden",
          "transition-[max-height] duration-500 ease-in-out",
          isOpen ? "max-h-[50vh]" : "max-h-0",
          className
        )}
      >
        <div className="flex flex-col min-h-0">
          {/* Header Section */}
          <div className="flex items-center justify-between p-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {typeof count === "number" && (
                <p className="text-sm text-muted-foreground">
                  {count} {countLabel ?? "stations found"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
                Sort by
              </button>
              <button
                onClick={onToggle}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="Close sheet"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Pulsating Strip */}
          <div className="flex justify-center">
            <div className="pulsating-strip" />
          </div>

          {/* Content Section */}
          <div className="overflow-y-auto">{children}</div>

          {/* Bottom Handle */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
            <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sheet;
