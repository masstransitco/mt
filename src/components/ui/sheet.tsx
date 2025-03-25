"use client";

import React, {
  memo,
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimation,
  useDragControls,
  type PanInfo,
} from "framer-motion";
import { cn } from "@/lib/utils";

// The pixel distance the user must drag to trigger minimize/expand.
const DRAG_THRESHOLD = 50;

// Maximum height for the sheet in expanded mode.
const MAX_EXPANDED_HEIGHT = "90vh";

/**
 * A sub-component for rendering the Sheet's header area.
 * This includes an optional title, subtitle, count, and extra content.
 * The entire header can handle pointer events to initiate dragging.
 */
const SheetHeader = memo(function SheetHeader({
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  headerRef,
  onPointerDown,
}: {
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
  count?: number;
  countLabel?: string;
  headerRef: React.RefObject<HTMLDivElement>;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const titleSection = useMemo(() => {
    if (!(title || subtitle || typeof count === "number")) return null;
    return (
      <div className="w-full flex flex-col">
        {title && (
          <h2 className="text-white font-semibold text-base leading-tight">
            {title}
          </h2>
        )}
        {subtitle && (
          <div className="text-sm text-gray-300 leading-tight">{subtitle}</div>
        )}
        {typeof count === "number" && (
          <div className="text-sm text-gray-300 leading-tight">
            {count} {countLabel ?? "items"}
          </div>
        )}
      </div>
    );
  }, [title, subtitle, count, countLabel]);

  const headerContentSection = useMemo(() => {
    if (!headerContent) return null;
    return <div className="mt-1">{headerContent}</div>;
  }, [headerContent]);

  // Prevent accidental text selection by calling `preventDefault` on click.
  return (
    <div
      ref={headerRef}
      className="cursor-grab active:cursor-grabbing w-full pointer-events-auto"
      onPointerDown={onPointerDown}
      onClick={(e) => e.preventDefault()}
    >
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1">
        {titleSection}
        {headerContentSection}
      </div>
      <div className="w-4/5 h-0.5 bg-gray-800 mx-auto mt-1 mb-1 rounded-full" />
    </div>
  );
});

SheetHeader.displayName = "SheetHeader";

/** The props for the Sheet component. */
export interface SheetProps {
  /** Whether the sheet is visible/open. */
  isOpen: boolean;
  /** Whether the sheet is minimized (only the header is visible). */
  isMinimized: boolean;
  /** Callback when the sheet should become minimized (e.g. user drags down). */
  onMinimize?: () => void;
  /** Callback when the sheet should expand (e.g. user drags up). */
  onExpand?: () => void;
  /** Called after the exit animation completes if `isOpen` goes false. */
  onDismiss?: () => void;
  /** Optional higher z-index if needed. */
  highPriority?: boolean;
  /** Title text shown in the header. */
  title?: string;
  /** Subtitle or small text below the title in the header. */
  subtitle?: ReactNode;
  /** Additional header content (e.g. status indicators). */
  headerContent?: ReactNode;
  /** Optional item count display. */
  count?: number;
  /** Label to show alongside `count`. */
  countLabel?: string;
  /** Additional CSS classes for the sheet container. */
  className?: string;
  /** The main body contents rendered inside the sheet. */
  children: ReactNode;
}

/**
 * A "dumb" Sheet component:
 *   - uses AnimatePresence to animate open/close via the `isOpen` prop,
 *   - uses a vertical offset to represent minimized vs. expanded (`isMinimized`),
 *   - triggers onMinimize/onExpand callbacks upon drag gestures,
 *   - calls onDismiss once fully closed (after exit animation).
 *
 * The parent is the single source of truth for open/closed and minimized/expanded states.
 */
export default function Sheet({
  isOpen,
  isMinimized,
  onMinimize,
  onExpand,
  onDismiss,
  highPriority = false,
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  className,
  children,
}: SheetProps) {
  const zIndexClass = highPriority ? "z-[1000]" : "z-[999]";
  const controls = useAnimation();
  const dragControls = useDragControls();

  // Refs for the header/body if we need to measure or handle overscroll.
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // We'll measure the header's height to adjust the minimized offset.
  const [headerHeight, setHeaderHeight] = useState(64);

  // measure again whenever these relevant props change
  useEffect(() => {
    if (!headerRef.current) return;
    const measuredHeight = headerRef.current.getBoundingClientRect().height;
    // ensure at least 64px
    setHeaderHeight(Math.max(64, Math.ceil(measuredHeight)));
  }, [title, subtitle, headerContent, count, countLabel]);

  // We do not forcibly shrink the sheet container in minimized mode.
  // Instead, we simply offset it so that only ~the header remains visible.
  // A single maxHeight can keep it from overfilling the screen.
  const containerStyle: React.CSSProperties = {
    height: "auto",
    maxHeight: MAX_EXPANDED_HEIGHT,
  };

  // The offset for minimized mode, revealing just the measured header height.
  const minimizedY = `calc(100% - ${headerHeight}px - env(safe-area-inset-bottom, 0px))`;

  // 0 when expanded, minimizedY when minimized.
  const finalY = isMinimized ? minimizedY : "0";

  /**
   * Start drag when pointer is down on the header (via dragControls).
   */
  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragControls.start(e);
    },
    [dragControls]
  );

  /**
   * Handle the end of a drag gesture to decide whether to minimize or expand.
   */
  const handleDragEnd = useCallback(
    (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      // If user drags down beyond threshold => minimize
      if (info.offset.y > DRAG_THRESHOLD && !isMinimized) {
        onMinimize?.();
      }
      // If user drags up beyond threshold => expand
      if (info.offset.y < -DRAG_THRESHOLD && isMinimized) {
        onExpand?.();
      }
      // Animate back to final position
      controls.start({
        y: 0,
        transition: { duration: 0.2, ease: "easeInOut" },
      });
    },
    [isMinimized, onMinimize, onExpand, controls]
  );

  /**
   * Prevent iOS overscroll bounce in the body content.
   */
  const handleBodyTouchMove = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    const isAtTop = scrollTop <= 0;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 1;

    const touch = e.touches[0];
    const touchStartY = target.dataset.touchStartY
      ? parseFloat(target.dataset.touchStartY)
      : touch.clientY;

    const isScrollingUp = touch.clientY > touchStartY;
    const isScrollingDown = touch.clientY < touchStartY;

    // Update the stored pointer position
    target.dataset.touchStartY = touch.clientY.toString();

    // If scrolling up at top, or scrolling down at bottom, prevent default to avoid bounce
    if ((isAtTop && isScrollingUp) || (isAtBottom && isScrollingDown)) {
      e.preventDefault();
    }
  }, []);

  const handleBodyTouchEnd = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    delete target.dataset.touchStartY;
  }, []);

  return (
    <AnimatePresence onExitComplete={onDismiss} initial={false}>
      {isOpen && (
        <motion.div
          className={cn(
            "fixed bottom-0 left-0 right-0 pointer-events-none",
            zIndexClass
          )}
          key="sheet-container"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{ width: "100%", maxHeight: "100%" }}
        >
          <motion.div
            className="w-full pointer-events-auto"
            style={containerStyle}
            animate={{ y: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            dragMomentum={false}
          >
            <motion.div
              className={cn(
                "relative bg-black text-white rounded-t-lg border-t border-gray-800 shadow-xl flex flex-col",
                "select-none",
                className
              )}
              style={{ y: finalY }}
              animate={{ y: finalY }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <SheetHeader
                title={title}
                subtitle={subtitle}
                headerContent={headerContent}
                count={count}
                countLabel={countLabel}
                headerRef={headerRef}
                onPointerDown={handleHeaderPointerDown}
              />
              {/* Body content */}
              <div
                ref={bodyRef}
                className="flex-grow overflow-y-auto overscroll-contain touchaction-none transition-all duration-200 px-3 pt-2 pb-3"
                onTouchStart={(e) => {
                  const target = e.currentTarget as HTMLDivElement;
                  target.dataset.touchStartY = e.touches[0].clientY.toString();
                }}
                onTouchMove={handleBodyTouchMove}
                onTouchEnd={handleBodyTouchEnd}
              >
                {children}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}