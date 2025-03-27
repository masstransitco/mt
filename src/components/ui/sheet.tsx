"use client"

import type React from "react"
import { memo, useMemo, useCallback, useRef, useState, useEffect, type ReactNode } from "react"
import { AnimatePresence, motion, useDragControls, type PanInfo, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/lib/useBodyScrollLock"

interface SheetHeaderProps {
  title?: string
  subtitle?: ReactNode
  headerContent?: ReactNode
  count?: number
  countLabel?: string
  disableMinimize?: boolean
  headerRef: React.RefObject<HTMLDivElement>
  onPointerDown: (e: React.PointerEvent) => void
}

/**
 * A sub-component for rendering the Sheet's header area.
 */
const SheetHeader = memo(function SheetHeader({
  title,
  subtitle,
  headerContent,
  count,
  countLabel,
  headerRef,
  onPointerDown,
}: SheetHeaderProps) {
  const titleSection = useMemo(() => {
    if (!(title || subtitle || typeof count === "number")) return null
    return (
      <div className="w-full flex flex-col">
        {title && <h2 className="text-white font-medium text-base leading-tight">{title}</h2>}
        {subtitle && <div className="text-sm text-gray-400 leading-tight">{subtitle}</div>}
        {typeof count === "number" && (
          <div className="text-sm text-gray-400 leading-tight">
            {count} {countLabel ?? "items"}
          </div>
        )}
      </div>
    )
  }, [title, subtitle, count, countLabel])

  const headerContentSection = useMemo(() => {
    if (!headerContent) return null
    return <div className="mt-1">{headerContent}</div>
  }, [headerContent])

  // Keep pointer events active on the header so user can click/drag even if the rest is disabled
  return (
    <div
      ref={headerRef}
      className="cursor-grab active:cursor-grabbing w-full pointer-events-auto"
      style={{ pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
      onClick={(e) => e.preventDefault()}
    >
      <div className="px-4 pt-3 pb-2 flex flex-col gap-1">
        {titleSection}
        {headerContentSection}
      </div>
      <div className="w-12 h-1 bg-[#2a2a2a] mx-auto mt-1 mb-2 rounded-full" />
    </div>
  )
})

SheetHeader.displayName = "SheetHeader"

/** The props for the Sheet component. */
export interface SheetProps {
  /** Whether the sheet is visible/open. */
  isOpen: boolean
  /** Whether the sheet is minimized (only the header is visible). */
  isMinimized: boolean
  /** Callback when the sheet should become minimized (e.g. user drags down). */
  onMinimize?: () => void
  /** Callback when the sheet should expand (e.g. user drags up). */
  onExpand?: () => void
  /** Called after the exit animation completes if `isOpen` goes false. */
  onDismiss?: () => void
  /** Optional higher z-index if needed. */
  highPriority?: boolean
  /** Title text shown in the header. */
  title?: string
  /** Subtitle or small text below the title in the header. */
  subtitle?: ReactNode
  /** Additional header content (e.g. status indicators). */
  headerContent?: ReactNode
  /** Optional item count display. */
  count?: number
  /** Label to show alongside `count`. */
  countLabel?: string
  /** Whether to disable minimizing the sheet. */
  disableMinimize?: boolean
  /** Additional CSS classes for the sheet container. */
  className?: string
  /** The main body contents rendered inside the sheet. */
  children: ReactNode
}

// Variants for the sheet's main motion.div
// "hidden": sheet is off-screen at the bottom
// "minimized": sheet is partially visible (85% down the screen)
// "expanded": sheet is fully visible
const sheetVariants: Variants = {
  hidden: {
    y: "100%",
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  minimized: {
    y: "85%",
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  expanded: {
    y: "0%",
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
}

/**
 * A Sheet (bottom drawer) with open/close/minimize states managed via Framer Motion.
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
  disableMinimize = false,
  className,
  children,
}: SheetProps) {
  // 1) Lock body scroll only if sheet is open & expanded.
  useBodyScrollLock(isOpen && !isMinimized)

  const zIndexClass = highPriority ? "z-[1000]" : "z-[999]"
  const dragControls = useDragControls()

  // Refs for the header/body if we need to measure or handle overscroll.
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Track if we're in a scrolling container
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const [preventDrag, setPreventDrag] = useState(false)

  // We'll measure the header's height, though we might not do much with it.
  const [headerHeight, setHeaderHeight] = useState(64)

  useEffect(() => {
    if (!headerRef.current) return
    const measuredHeight = headerRef.current.getBoundingClientRect().height
    setHeaderHeight(Math.max(64, Math.ceil(measuredHeight)))
  }, [title, subtitle, headerContent, count, countLabel])

  /**
   * Start drag when pointer is down on the header,
   * but only if the sheet is not minimized.
   */
  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isMinimized) {
        e.preventDefault()
        return
      }
      isDraggingRef.current = true
      startYRef.current = e.clientY
      dragControls.start(e)
    },
    [dragControls, isMinimized],
  )

  /**
   * Check if we're in a scrollable area that's not at the top
   */
  const isInScrollableContent = useCallback((target: HTMLElement | null): boolean => {
    if (!target) return false

    // Find closest scrollable parent
    const scrollableParent = target.closest(".overflow-y-auto, .overflow-auto")
    if (!scrollableParent) return false

    // Check if we're not at the top of the scroll
    return scrollableParent.scrollTop > 0
  }, [])

  /**
   * If the user drags enough to pass thresholds, we call onMinimize.
   */
  const handleDragEnd = useCallback(
    (e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      // Reset dragging state
      isDraggingRef.current = false
      setPreventDrag(false)

      // Get the target element
      const target = e.target as HTMLElement

      // Don't minimize the sheet if we're in a scrollable area that's not at the top
      if (isInScrollableContent(target) && info.offset.y > 0) {
        return
      }

      if (disableMinimize) {
        return
      }

      if (isMinimized && info.offset.y > 0) {
        // If already minimized, dragging down further does nothing
        return
      }

      // If expanded (not minimized) and user drags down > 50px => minimize
      if (!isMinimized && info.offset.y > 50) {
        onMinimize?.()
        return
      }

      // If minimized and user drags up > 50px => expand
      if (isMinimized && info.offset.y < -50) {
        onExpand?.()
        return
      }
    },
    [isMinimized, disableMinimize, onMinimize, onExpand, isInScrollableContent],
  )

  /**
   * Handle initial touchstart on the body to determine if we should allow dragging
   */
  const handleBodyTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const target = e.target as HTMLElement

      // If we're in a scrollable area that's not at the top,
      // prevent dragging the sheet initially
      if (isInScrollableContent(target)) {
        setPreventDrag(true)
      } else {
        setPreventDrag(false)
      }
    },
    [isInScrollableContent],
  )

  return (
    <AnimatePresence onExitComplete={onDismiss} initial={false}>
      {isOpen && (
        <motion.div
          style={{
            touchAction: isMinimized ? "none" : "auto",
          }}
          className={cn("fixed bottom-0 left-0 right-0", zIndexClass)}
          key="sheet-container"
          variants={sheetVariants}
          initial={"hidden"}
          animate={isOpen ? (isMinimized ? "minimized" : "expanded") : "hidden"}
          exit="hidden"
          drag={isMinimized || preventDrag ? false : "y"}
          dragConstraints={{
            top: 0, // can drag up (top) as far as you want
            bottom: isMinimized ? 0 : 300, // if minimized, bottom=0 so you cannot drag down
          }}
          dragListener={!isMinimized && !preventDrag}
          dragControls={dragControls}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          dragMomentum={false}
        >
          <div
            className={cn(
              "relative bg-[#1a1a1a] text-white rounded-t-xl shadow-xl flex flex-col select-none",
              className,
            )}
            style={{
              // We'll rely on the motion variants for y positioning.
              pointerEvents: "auto",
            }}
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

            {/* Body area: always enable pointer events but handle scrolling properly */}
            <div
              ref={bodyRef}
              className={cn(
                "flex-grow overflow-y-auto overscroll-contain px-4 pt-2 pb-6 transition-all duration-200 sheet-body",
                isMinimized ? "opacity-50" : "opacity-100",
              )}
              style={{
                WebkitOverflowScrolling: "touch",
                pointerEvents: isMinimized ? "none" : "auto",
                touchAction: "pan-y",
              }}
              onTouchStart={handleBodyTouchStart}
            >
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

