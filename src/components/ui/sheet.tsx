"use client";

import React, { useState, useEffect, useCallback, ReactNode, Suspense, memo, lazy, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useAnimation,
  PanInfo,
} from "framer-motion";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Dynamically import PulsatingStrip
const PulsatingStrip = lazy(() => import("@/components/ui/PulsatingStrip"));

// Loading fallback for the PulsatingStrip
const StripFallback = () => (
  <div className="flex justify-center">
    <div
      style={{
        width: "110%",
        height: "2px",
        borderRadius: "1px",
        backgroundColor: "#2171ec",
      }}
    />
  </div>
);

export interface SheetProps {
  isOpen: boolean;
  isMinimized?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
  count?: number;
  countLabel?: string;
  onMinimize?: () => void;
  onExpand?: () => void;  // New prop
  onDismiss?: () => void;
}

const SheetHeader = memo(({
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  isMinimized,
  toggleExpanded,
}: {
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
  count?: number;
  countLabel?: string;
  isMinimized: boolean;
  toggleExpanded: () => void;
}) => (
  <div
    onClick={toggleExpanded}
    className="cursor-grab active:cursor-grabbing relative w-full"
  >
    <div className="flex flex-col items-center justify-between">
      <div className="text-left w-full flex items-center justify-between">
        <div>
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
          {subtitle && <div className="text-sm text-gray-300">{subtitle}</div>}
          {typeof count === "number" && (
            <p className="text-sm text-gray-300">
              {count} {countLabel ?? "items"}
            </p>
          )}
        </div>
        <ChevronUp className={cn(
          "h-5 w-5 text-gray-400 transition-transform",
          isMinimized ? "rotate-180" : "rotate-0"
        )} />
      </div>
      
      {headerContent && (
        <div className="w-full mt-2">
          {headerContent}
        </div>
      )}
    </div>
    <Suspense fallback={<StripFallback />}>
      <PulsatingStrip className="mt-3 mx-auto" />
    </Suspense>
  </div>
));

SheetHeader.displayName = 'SheetHeader';

function Sheet({
  isOpen,
  isMinimized: externalMinimized,
  children,
  className,
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  onMinimize,
  onExpand,
  onDismiss,
}: SheetProps) {
  // Use internal state with external override
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized = externalMinimized !== undefined ? externalMinimized : internalMinimized;
  
  // For keying content to force remount when expanded
  const [contentKey, setContentKey] = useState(0);
  
  // Animation controls
  const controls = useAnimation();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Constants - define heights
  const MINIMIZED_HEIGHT = 64; // Header height
  const MAX_EXPANDED_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600; // 85% of screen height maximum
  const MIN_EXPANDED_HEIGHT = 320; // Minimum height when expanded
  const [expandedHeight, setExpandedHeight] = useState(MIN_EXPANDED_HEIGHT);
  const constraintsRef = useRef(null);

  // Safe backdrop click handler to prevent early returns
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof onMinimize === 'function') {
      onMinimize();
    }
    setInternalMinimized(true);
  }, [onMinimize]);

  // Calculate dynamic height based on content
  useEffect(() => {
    const updateExpandedHeight = () => {
      if (!isMinimized && contentRef.current) {
        // Get content height and add header height
        const contentHeight = contentRef.current.scrollHeight;
        const headerHeight = MINIMIZED_HEIGHT;
        const padding = 32; // Extra padding
        
        // Set height based on content, but clamped between min and max
        const calculatedHeight = Math.min(
          Math.max(contentHeight + headerHeight + padding, MIN_EXPANDED_HEIGHT),
          MAX_EXPANDED_HEIGHT
        );
        
        setExpandedHeight(calculatedHeight);
      }
    };

    // Update height when content changes or when expanded
    if (isOpen && !isMinimized) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(updateExpandedHeight, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMinimized, children, headerContent]);

  // Update position based on minimized state with fixed offset
  useEffect(() => {
    if (isOpen) {
      controls.start({
        y: isMinimized ? expandedHeight - MINIMIZED_HEIGHT : 0,
        transition: { type: "spring", stiffness: 300, damping: 30 },
      });
    }
  }, [isMinimized, isOpen, controls, expandedHeight, MINIMIZED_HEIGHT]);

  // Sync with external minimized state
  useEffect(() => {
    if (externalMinimized !== undefined) {
      setInternalMinimized(externalMinimized);
    }
  }, [externalMinimized]);

  // Reset when sheet opens
  useEffect(() => {
    if (isOpen) {
      setInternalMinimized(false);
    }
  }, [isOpen]);

  // Handle content key change when minimized state changes
  useEffect(() => {
    // When transitioning from minimized to expanded
    if (!isMinimized) {
      // Increment the content key to force a remount
      setContentKey(prev => prev + 1);
      
      // Call onExpand if provided
      if (onExpand) {
        onExpand();
      }
    }
  }, [isMinimized, onExpand]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Update max height
      const newMaxHeight = window.innerHeight * 0.85;
      if (newMaxHeight !== MAX_EXPANDED_HEIGHT) {
        // If current expanded height exceeds new max, update it
        setExpandedHeight(prev => Math.min(prev, newMaxHeight));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use consistent drag thresholds based on fixed height
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = expandedHeight / 3; // Use 1/3 of height as threshold
    const offset = info.offset.y;
    
    // Current minimized state
    const wasMinimized = isMinimized;
    
    // Determine new state based on drag
    const shouldMinimize = wasMinimized 
      ? offset < -threshold  // Expand if minimized and dragged up beyond threshold
      : offset > threshold;  // Minimize if expanded and dragged down beyond threshold
    
    // Update state and notify parent
    setInternalMinimized(shouldMinimize);
    
    if (shouldMinimize && !wasMinimized && onMinimize) {
      onMinimize();
    } else if (!shouldMinimize && wasMinimized && onExpand) {
      onExpand();
    }
  }, [isMinimized, onMinimize, onExpand, expandedHeight]);

  const toggleExpanded = useCallback(() => {
    const wasMinimized = isMinimized;
    const newMinimized = !wasMinimized;
    
    setInternalMinimized(newMinimized);
    
    if (newMinimized && !wasMinimized && onMinimize) {
      onMinimize();
    } else if (!newMinimized && wasMinimized && onExpand) {
      onExpand();
    }
  }, [isMinimized, onMinimize, onExpand]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col pointer-events-none" ref={constraintsRef}>
          {/* Backdrop - only visible when expanded */}
          {!isMinimized && (
            <motion.div
              className="absolute inset-0 bg-black pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
            />
          )}

          {/* Sheet container - with dynamic height */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            style={{ height: expandedHeight }}
            initial={{ y: "100%" }}
            animate={controls}
            exit={{ y: "100%" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: expandedHeight - MINIMIZED_HEIGHT }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            <div
              className={cn(
                "relative bg-black text-white rounded-t-lg shadow-2xl border-t border-gray-800 h-full flex flex-col",
                className
              )}
            >
              {/* Header - always visible */}
              <div className="px-4 pt-4 pb-2 flex-shrink-0" style={{ minHeight: MINIMIZED_HEIGHT }}>
                <SheetHeader 
                  title={title}
                  subtitle={subtitle}
                  headerContent={headerContent}
                  count={count}
                  countLabel={countLabel}
                  isMinimized={isMinimized}
                  toggleExpanded={toggleExpanded}
                />
              </div>

              {/* Content area - kept mounted but visually hidden when minimized */}
              <div
                ref={contentRef}
                className="px-4 pt-4 pb-8 overflow-y-auto flex-grow transition-all duration-300"
                style={{ 
                  maxHeight: isMinimized ? 0 : (MAX_EXPANDED_HEIGHT - MINIMIZED_HEIGHT),
                  opacity: isMinimized ? 0 : 1,
                  overflow: isMinimized ? 'hidden' : 'auto',
                  pointerEvents: isMinimized ? 'none' : 'auto',
                  // Removed visibility: hidden to prevent rendering issues
                }}
              >
                {/* Wrap children in a keyed div to force remount when expanded */}
                <div key={`content-${contentKey}`}>
                  {children}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default memo(Sheet);