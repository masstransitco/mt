"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
} from "react";
import { AnimatePresence, motion, useAnimation, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

// Default minimized height is auto (will adjust to header content)
const MINIMIZED_HEIGHT = "auto";
// Maximum height the sheet can expand to (90vh)
const MAX_EXPANDED_HEIGHT = "90vh";

/** 
 * The sheet header, which can include:
 *   - A title, subtitle, or count
 *   - custom `headerContent` (like <PickupTime /> or <DisplayFare />)
 */
const SheetHeader = memo(function SheetHeader({
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  isMinimized,
  onToggle,
  headerRef,
}: {
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
  count?: number;
  countLabel?: string;
  isMinimized: boolean;
  onToggle: () => void;
  headerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={headerRef}
      className="cursor-pointer w-full"
      onClick={onToggle}
    >
      {/* Container with minimal top/bottom padding */}
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1">
        {/* Title / Subtitle / Count in a small vertical space */}
        {(title || subtitle || typeof count === "number") && (
          <div className="w-full flex flex-col">
            {title && <h2 className="text-white font-semibold text-base leading-tight">{title}</h2>}
            {subtitle && (
              <div className="text-sm text-gray-300 leading-tight">{subtitle}</div>
            )}
            {typeof count === "number" && (
              <div className="text-sm text-gray-300 leading-tight">
                {count} {countLabel ?? "items"}
              </div>
            )}
          </div>
        )}

        {/* Insert your custom header content (PickupTime / DisplayFare / etc.) right below */}
        {headerContent && (
          <div className="mt-1">
            {headerContent}
          </div>
        )}
      </div>

      {/* Visual divider to distinguish header from body */}
      <div className="w-4/5 h-0.5 bg-gray-800 mx-auto mt-1 mb-1 rounded-full" />
    </div>
  );
});

SheetHeader.displayName = "SheetHeader";

/** 
 * The main sheet props
 */
export interface SheetProps {
  /** Whether the sheet is open or closed. */
  isOpen: boolean;

  /** Optionally control whether it's minimized externally. */
  isMinimized?: boolean;

  /** The main body content of the sheet. */
  children: ReactNode;
  className?: string;

  /** Title, subtitle, and custom header nodes. */
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;

  /** Optional count & label for the header. */
  count?: number;
  countLabel?: string;

  /** Called when user toggles to minimized. */
  onMinimize?: () => void;

  /** Called when user toggles to expanded. */
  onExpand?: () => void;

  /** Parent can handle a full close by setting isOpen=false. */
  onDismiss?: () => void;
}

/** 
 * If parent wants to close the sheet programmatically:
 *   sheetRef.current?.closeSheet();
 */
export interface SheetHandle {
  closeSheet: () => Promise<void>;
}

/**
 * A minimal two-position bottom sheet with:
 *  - No overlay blocking the underlying UI (we only render the sheet itself)
 *  - Toggling between expanded (dynamic height up to 90vh) or minimized (header height)
 *  - Tap header to toggle
 *  - Very little padding for a sleek design
 */
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
  // If not externally controlled, manage minimized state locally
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized =
    externalMinimized !== undefined ? externalMinimized : internalMinimized;

  // Refs for measuring content
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track header height for minimized state
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  
  // Framer Motion control for the sheet's Y offset
  const controls = useAnimation();

  // For parent's .closeSheet() calls
  const closePromiseResolverRef = useRef<(() => void) | null>(null);

  // Lock body scroll only if open and not minimized
  // This prevents unwanted scroll locking when sheet is minimized
  useBodyScrollLock(isOpen && !isMinimized);

  // Measure header height when it changes
  useEffect(() => {
    if (headerRef.current) {
      const observer = new ResizeObserver((entries) => {
        const height = entries[0].contentRect.height;
        setHeaderHeight(height);
      });
      
      observer.observe(headerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Calculate Y position based on minimized state and header height
  const calculateYPosition = useCallback(() => {
    if (isMinimized) {
      // If we know the header height, use container height minus header height
      if (headerHeight && containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight;
        return containerHeight - headerHeight;
      }
      // Fallback to a default value
      return "calc(100% - var(--header-height, 64px))";
    }
    return 0;
  }, [isMinimized, headerHeight]);

  /** Let parent forcibly close the sheet. */
  const closeSheet = useCallback(() => {
    if (!isOpen) return Promise.resolve();
    return new Promise<void>((resolve) => {
      closePromiseResolverRef.current = resolve;
      // Let parent handle toggling isOpen => false
      onDismiss?.();
    });
  }, [isOpen, onDismiss]);

  useImperativeHandle(ref, () => ({ closeSheet }), [closeSheet]);

  // After we animate out, if there's a pending closeSheet() promise, resolve it
  const handleAnimationComplete = useCallback(() => {
    if (!isOpen && closePromiseResolverRef.current) {
      closePromiseResolverRef.current();
      closePromiseResolverRef.current = null;
    }
  }, [isOpen]);

  // Animate to calculated Y position when expanded/minimized state changes
  useEffect(() => {
    if (!isOpen) return;
    
    const targetY = calculateYPosition();
    controls.start({
      y: targetY,
      transition: { duration: 0.2, ease: "easeInOut" },
    });
  }, [isOpen, isMinimized, headerHeight, controls, calculateYPosition]);

  // If we open the sheet => default to expanded
  useEffect(() => {
    if (isOpen) {
      setInternalMinimized(false);
    }
  }, [isOpen]);

  // Tapping the header toggles minimized
  const toggleMinimized = useCallback(() => {
    if (isMinimized) {
      // Was minimized => expand
      setInternalMinimized(false);
      onExpand?.();
    } else {
      // Was expanded => minimize
      setInternalMinimized(true);
      onMinimize?.();
    }
  }, [isMinimized, onExpand, onMinimize]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed bottom-0 left-0 right-0 z-[999] pointer-events-none" 
          key="sheet-container"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          onAnimationComplete={handleAnimationComplete}
          style={{ height: 'auto' }}
        >
          {/* The sheet container - with pointer events enabled */}
          <motion.div
            ref={containerRef}
            className="w-full pointer-events-auto"
            style={{ 
              height: "auto", 
              maxHeight: MAX_EXPANDED_HEIGHT,
              // Set CSS variable for the header height
              ...(headerHeight ? { '--header-height': `${headerHeight}px` } as React.CSSProperties : {})
            }}
            animate={controls}
          >
            <div
              className={cn(
                "relative bg-black text-white rounded-t-lg border-t border-gray-800 shadow-xl flex flex-col h-full",
                className
              )}
            >
              <SheetHeader
                title={title}
                subtitle={subtitle}
                headerContent={headerContent}
                count={count}
                countLabel={countLabel}
                isMinimized={isMinimized}
                onToggle={toggleMinimized}
                headerRef={headerRef}
              />

              {/* Body content - only draggable in the header */}
              <div
                ref={bodyRef}
                className="flex-grow overflow-y-auto transition-all duration-200 px-3 pt-2 pb-3"
                style={{
                  opacity: isMinimized ? 0 : 1,
                  pointerEvents: isMinimized ? "none" : "auto",
                }}
              >
                {children}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(forwardRef(SheetImpl));
