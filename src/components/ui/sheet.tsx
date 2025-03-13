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

// Adjust these as desired
const MINIMIZED_HEIGHT = 64;   // Height when minimized
const EXPANDED_HEIGHT = 560;  // Fixed expanded height for crisp toggling

/** 
 * The sheet header, which can include:
 *   - A title, subtitle, or count
 *   - custom `headerContent` (like <PickupTime /> or <DisplayFare />)
 * 
 * For minimal spacing at the top, we reduce or remove extra paddings.
 */
const SheetHeader = memo(function SheetHeader({
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  isMinimized,
  onToggle,
}: {
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
  count?: number;
  countLabel?: string;
  isMinimized: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="cursor-pointer w-full"
      style={{ minHeight: MINIMIZED_HEIGHT }}
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
 *  - Toggling between expanded (fixed ~560px) or minimized (~64px)
 *  - Tap header to toggle, or drag >80px to snap states
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

  // Framer Motion control for the sheet's Y offset
  const controls = useAnimation();

  // For parent's .closeSheet() calls
  const closePromiseResolverRef = useRef<(() => void) | null>(null);

  // Lock body scroll only if open and not minimized
  // This prevents unwanted scroll locking when sheet is minimized
  useBodyScrollLock(isOpen && !isMinimized);

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

  // Snap to y=0 if expanded, or y=(EXPANDED_HEIGHT - MINIMIZED_HEIGHT) if minimized
  useEffect(() => {
    if (!isOpen) return;
    const targetY = isMinimized ? EXPANDED_HEIGHT - MINIMIZED_HEIGHT : 0;
    controls.start({
      y: targetY,
      transition: { duration: 0.2, ease: "easeInOut" },
    });
  }, [isOpen, isMinimized, controls]);

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

  // If user drags up/down more than ~80px => toggle
  const handleDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      const threshold = 80;
      const dragDistance = info.offset.y;
      if (isMinimized) {
        // If minimized => user must drag up enough to expand
        if (dragDistance < -threshold) {
          setInternalMinimized(false);
          onExpand?.();
        }
      } else {
        // If expanded => user must drag down enough to minimize
        if (dragDistance > threshold) {
          setInternalMinimized(true);
          onMinimize?.();
        }
      }
    },
    [isMinimized, onExpand, onMinimize]
  );

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
          {/* The draggable sheet itself - with pointer events enabled */}
          <motion.div
            className="w-full pointer-events-auto"
            style={{ height: EXPANDED_HEIGHT }}
            drag="y"
            dragConstraints={{ top: 0, bottom: EXPANDED_HEIGHT - MINIMIZED_HEIGHT }}
            dragElastic={0}
            onDragEnd={handleDragEnd}
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
              />

              {/* If minimized, we fade out or hide the content area */}
              <div
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