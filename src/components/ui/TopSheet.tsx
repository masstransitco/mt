"use client";

import React, { useRef, useEffect, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TopSheetProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  onDismiss?: () => void;
}

export default function TopSheet({
  isOpen,
  children,
  className,
  title,
  subtitle,
  onDismiss,
}: TopSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when opened (optional)
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Apple-like scale fade
  const variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", damping: 30, stiffness: 300 },
    },
    exit: { opacity: 0, scale: 0.95 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          {/* Centered container */}
          <motion.div
            className="
              relative 
              flex 
              flex-col 
              w-full 
              max-w-md 
              max-h-[90vh]  /* ensures it doesn't exceed screen height */
            "
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div
              className={cn(
                "bg-neutral-300 text-black border border-gray-400 rounded-md shadow-md overflow-hidden",
                className
              )}
            >
              {(title || subtitle) && (
                <div className="px-4 pt-3 pb-2 border-b border-gray-300">
                  {title && <h2 className="text-base font-semibold">{title}</h2>}
                  {subtitle && <p className="text-sm text-gray-800">{subtitle}</p>}
                </div>
              )}
              <div
                ref={contentRef}
                className="
                  px-4 
                  pt-3 
                  pb-6 
                  overflow-y-auto
                  max-h-[70vh] /* or 80vh, etc. so content scrolls if tall */
                "
              >
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
