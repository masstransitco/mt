"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ReactNode,
  Suspense,
  memo,
  lazy,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
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

// --- IMPORT YOUR BODY LOCK HOOK ---
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export interface SheetProps {
  /** Whether the sheet is open or closed. */
  isOpen: boolean;

  /** If the sheet is minimized or not. If not controlled externally, 
      the sheet will manage its own minimized state. */
  isMinimized?: boolean;

  /** The sheet's content. */
  children: ReactNode;
  className?: string;

  /** Optional title, subtitle, or custom header nodes. */
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;

  /** Optional count display in the header (e.g. "3 items"). */
  count?: number;
  countLabel?: string;

  /** Called when user drags down to minimize. */
  onMinimize?: () => void;

  /** Called when user drags up to expand from minimized. */
  onExpand?: () => void;

  /** If you want parent code to handle a full close, you can pass onDismiss. */
  onDismiss?: () => void;
}

/**
 * Exposed to parents via ref for programmatic close:
 *   sheetRef.current?.closeSheet();
 */
export interface SheetHandle {
  /**
   * Programmatically closes the sheet, returning a Promise that resolves
   * only after the exit animation has completed.
   */
  closeSheet: () => Promise<void>;
}

/** The sheet header, tapped to toggle expand/minimize. */
const SheetHeader = memo(function SheetHeader({
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
}) {
  return (
    <div
      onClick={toggleExpanded}
      className="cursor-grab active:cursor-grabbing relative w-full"
    >
      <div className="flex flex-col items-center justify-between">
        <div className="flex items-center justify-between w-full text-left">
          <div>
            {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
            {subtitle && <div className="text-sm text-gray-300">{subtitle}</div>}
            {typeof count === "number" && (
              <p className="text-sm text-gray-300">
                {count} {countLabel ?? "items"}
              </p>
            )}
          </div>
          <ChevronUp
            className={cn(
              "h-5 w-5 text-gray-400 transition-transform",
              isMinimized ? "rotate-180" : "rotate-0"
            )}
          />
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
  );
});

SheetHeader.displayName = "SheetHeader";

function SheetImpl(
  {
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
  }: SheetProps,
  ref: React.Ref<SheetHandle>
) {
  // If not externally controlled, track minimized internally
  const [internalMinimized, setInternalMinimized] = useState(false);
  // We treat externalMinimized as a "source of truth" if provided
  const isMinimized =
    externalMinimized !== undefined ? externalMinimized : internalMinimized;

  // Rerender key for the content area when we un-minimize
  const [contentKey, setContentKey] = useState(0);

  // Framer-motion controls
  const controls = useAnimation();
  const contentRef = useRef<HTMLDivElement>(null);

  // Let parent code call sheetRef.current?.closeSheet()
  const closePromiseResolverRef = useRef<(() => void) | null>(null);

  // If the sheet is open => lock body scroll
  // (You can refine this to lock only when fully expanded, if you like.)
  useBodyScrollLock(isOpen);

  /** The function GMap can call if they do sheetRef.current?.closeSheet() */
  const closeSheet = useCallback((): Promise<void> => {
    if (!isOpen) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      closePromiseResolverRef.current = resolve;
      // Let parent handle toggling isOpen => false
      if (onDismiss) {
        onDismiss();
      }
    });
  }, [isOpen, onDismiss]);

  useImperativeHandle(ref, () => ({ closeSheet }), [closeSheet]);

  // Constants for sizing
  const MINIMIZED_HEIGHT = 64;
  // Bump to near-full screen. 
  // If you want truly full screen, consider window.innerHeight or 100dvh
  const MAX_EXPANDED_HEIGHT =
    typeof window !== "undefined" ? window.innerHeight * 0.98 : 700;
  const MIN_EXPANDED_HEIGHT = 320;

  // The container ref for drag constraints
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Called once the exit animation completes
  const handleAnimationComplete = useCallback(() => {
    if (!isOpen && closePromiseResolverRef.current) {
      closePromiseResolverRef.current();
      closePromiseResolverRef.current = null;
    }
  }, [isOpen]);

  // Recalculate how tall we can expand when open
  useEffect(() => {
    const updateExpandedHeight = () => {
      if (!isMinimized && contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const newHeight = Math.min(
          Math.max(contentHeight + MINIMIZED_HEIGHT + 32, MIN_EXPANDED_HEIGHT),
          MAX_EXPANDED_HEIGHT
        );
        // This ensures the sheet can scroll internally if content is taller
        setExpandedHeight(newHeight);
      }
    };

    if (isOpen && !isMinimized) {
      const timer = setTimeout(updateExpandedHeight, 50);
      return () => clearTimeout(timer);
    }
  }, [
    isOpen,
    isMinimized,
    children,
    headerContent,
    MINIMIZED_HEIGHT,
    MIN_EXPANDED_HEIGHT,
    MAX_EXPANDED_HEIGHT,
  ]);

  // Animate up/down based on minimized state
  const [expandedHeight, setExpandedHeight] = useState(MIN_EXPANDED_HEIGHT);
  useEffect(() => {
    if (isOpen) {
      controls.start({
        y: isMinimized ? expandedHeight - MINIMIZED_HEIGHT : 0,
        transition: { type: "spring", stiffness: 300, damping: 30 },
      });
    }
  }, [isOpen, isMinimized, controls, expandedHeight, MINIMIZED_HEIGHT]);

  // If externalMinimized changes, sync it
  useEffect(() => {
    if (externalMinimized !== undefined) {
      setInternalMinimized(externalMinimized);
    }
  }, [externalMinimized]);

  // If we open the sheet, default to expanded
  useEffect(() => {
    if (isOpen) {
      setInternalMinimized(false);
    }
  }, [isOpen]);

  // Force a content re-render if we go from minimized => expanded
  useEffect(() => {
    if (!isMinimized) {
      setContentKey((prev) => prev + 1);
      if (onExpand) {
        onExpand();
      }
    }
  }, [isMinimized, onExpand]);

  /** Called when user finishes dragging the sheet. */
  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const threshold = expandedHeight / 3;
      const offset = info.offset.y;
      const wasMinimized = isMinimized;

      // If minimized => expand if user drags up enough
      // If expanded => minimize if user drags down enough
      const shouldMinimize = wasMinimized
        ? offset < -threshold
        : offset > threshold;

      setInternalMinimized(shouldMinimize);

      if (shouldMinimize && !wasMinimized && onMinimize) {
        onMinimize();
      } else if (!shouldMinimize && wasMinimized && onExpand) {
        onExpand();
      }
    },
    [isMinimized, expandedHeight, onMinimize, onExpand]
  );

  // Tapping the header toggles minimized
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
        <div
          className="fixed inset-0 z-[999] flex flex-col pointer-events-none"
          ref={constraintsRef}
        >
          {/* Non-interactive backdrop. We rely on GMap or parent to call .closeSheet() */}
          {!isMinimized && (
            <motion.div
              className="absolute inset-0 bg-black pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
            />
          )}

          {/* The actual sheet container at bottom */}
          <motion.div
            className="pointer-events-auto mt-auto w-full"
            style={{ height: expandedHeight }}
            initial={{ y: "100%" }}
            animate={controls}
            exit={{ y: "100%" }}
            onAnimationComplete={handleAnimationComplete}
            drag="y"
            dragConstraints={{
              top: 0,
              bottom: expandedHeight - MINIMIZED_HEIGHT,
            }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
          >
            <div
              className={cn(
                "relative bg-black text-white rounded-t-lg shadow-2xl border-t border-gray-800 h-full flex flex-col",
                className
              )}
            >
              {/* Sheet header */}
              <div
                className="px-4 pt-4 pb-2 flex-shrink-0"
                style={{ minHeight: MINIMIZED_HEIGHT }}
              >
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

              {/* Content area */}
              <div
                ref={contentRef}
                className="px-4 pt-4 pb-8 overflow-y-auto flex-grow transition-all duration-300"
                style={{
                  maxHeight: isMinimized
                    ? 0
                    : expandedHeight - MINIMIZED_HEIGHT,
                  opacity: isMinimized ? 0 : 1,
                  overflow: isMinimized ? "hidden" : "auto",
                  pointerEvents: isMinimized ? "none" : "auto",
                }}
              >
                {/* Re-mount content if un-minimized */}
                <div key={`content-${contentKey}`}>{children}</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Wrap in forwardRef so GMap can do sheetRef.current?.closeSheet() */
const Sheet = forwardRef(SheetImpl);
export default memo(Sheet);