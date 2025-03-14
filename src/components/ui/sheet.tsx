"use client"

// Optimize imports by using named imports for React hooks
import type React from "react"
import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useRef,
  useImperativeHandle,
  forwardRef,
  memo,
  useMemo,
} from "react"
import { AnimatePresence, motion, useAnimation, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/lib/useBodyScrollLock"

// Default minimized height is auto (will adjust to header content)
const MINIMIZED_HEIGHT = "auto"
// Maximum height the sheet can expand to (90vh)
const MAX_EXPANDED_HEIGHT = "90vh"
// Drag threshold - extract as constant for easier tuning
const DRAG_THRESHOLD = 50

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
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  title?: string
  subtitle?: ReactNode
  headerContent?: ReactNode
  count?: number
  countLabel?: string
  isMinimized: boolean
  onToggle: () => void
  headerRef: React.RefObject<HTMLDivElement>
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}) {
  // Memoize the title/subtitle/count section to prevent re-renders
  const titleSection = useMemo(() => {
    if (!(title || subtitle || typeof count === "number")) return null

    return (
      <div className="w-full flex flex-col">
        {title && <h2 className="text-white font-semibold text-base leading-tight">{title}</h2>}
        {subtitle && <div className="text-sm text-gray-300 leading-tight">{subtitle}</div>}
        {typeof count === "number" && (
          <div className="text-sm text-gray-300 leading-tight">
            {count} {countLabel ?? "items"}
          </div>
        )}
      </div>
    )
  }, [title, subtitle, count, countLabel])

  // Memoize the header content section
  const headerContentSection = useMemo(() => {
    if (!headerContent) return null
    return <div className="mt-1">{headerContent}</div>
  }, [headerContent])

  return (
    <div
      ref={headerRef}
      className="cursor-pointer w-full"
      onClick={onToggle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Container with minimal top/bottom padding */}
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1">
        {/* Title / Subtitle / Count in a small vertical space */}
        {titleSection}

        {/* Insert your custom header content (PickupTime / DisplayFare / etc.) right below */}
        {headerContentSection}
      </div>

      {/* Visual divider to distinguish header from body */}
      <div className="w-4/5 h-0.5 bg-gray-800 mx-auto mt-1 mb-1 rounded-full" />
    </div>
  )
})

SheetHeader.displayName = "SheetHeader"

/**
 * The main sheet props
 */
export interface SheetProps {
  /** Whether the sheet is open or closed. */
  isOpen: boolean

  /** Optionally control whether it's minimized externally. */
  isMinimized?: boolean

  /** The main body content of the sheet. */
  children: ReactNode
  className?: string

  /** Title, subtitle, and custom header nodes. */
  title?: string
  subtitle?: ReactNode
  headerContent?: ReactNode

  /** Optional count & label for the header. */
  count?: number
  countLabel?: string

  /** Called when user toggles to minimized. */
  onMinimize?: () => void

  /** Called when user toggles to expanded. */
  onExpand?: () => void

  /** Parent can handle a full close by setting isOpen=false. */
  onDismiss?: () => void
}

/**
 * If parent wants to close the sheet programmatically:
 *   sheetRef.current?.closeSheet();
 */
export interface SheetHandle {
  closeSheet: () => Promise<void>
}

/**
 * A minimal two-position bottom sheet with:
 *  - No overlay blocking the underlying UI (we only render the sheet itself)
 *  - Toggling between expanded (dynamic height up to 90vh) or minimized (header height)
 *  - Tap header to toggle
 *  - Drag gestures to expand/minimize
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
  ref: React.Ref<SheetHandle>,
) {
  // If not externally controlled, manage minimized state locally
  const [internalMinimized, setInternalMinimized] = useState(false)
  const isMinimized = externalMinimized !== undefined ? externalMinimized : internalMinimized

  // Refs for measuring content
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track header height for minimized state - use ref for measurements to avoid re-renders
  const headerHeightRef = useRef<number | null>(null)
  const [headerHeight, setHeaderHeight] = useState<number | null>(null)

  // For tracking drag gestures - use refs to avoid re-renders during drag
  const dragStartYRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)

  // Framer Motion control for the sheet's Y offset
  const controls = useAnimation()

  // For parent's .closeSheet() calls
  const closePromiseResolverRef = useRef<(() => void) | null>(null)

  // Observer ref to properly clean up
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Lock body scroll only if open and not minimized
  // This prevents unwanted scroll locking when sheet is minimized
  useBodyScrollLock(isOpen && !isMinimized)

  // Measure header height when it changes - optimized with refs
  useEffect(() => {
    if (!headerRef.current) return

    const updateHeaderHeight = (height: number) => {
      if (headerHeightRef.current !== height) {
        headerHeightRef.current = height
        setHeaderHeight(height)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const height = entries[0].contentRect.height
      updateHeaderHeight(height)
    })

    resizeObserverRef.current = observer
    observer.observe(headerRef.current)

    // Initial measurement
    updateHeaderHeight(headerRef.current.offsetHeight)

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
    }
  }, [])

  // Handle drag start - optimized with refs
  const handleDragStart = useCallback((event: TouchEvent) => {
    dragStartYRef.current = event.touches[0].clientY
    isDraggingRef.current = true
  }, [])

  // Handle drag movement - optimized with refs and debounce
  const handleDragMove = useCallback(
    (event: TouchEvent) => {
      if (!isDraggingRef.current || dragStartYRef.current === null) return

      const currentY = event.touches[0].clientY
      const deltaY = currentY - dragStartYRef.current

      // If dragged up significantly and currently minimized
      if (deltaY < -DRAG_THRESHOLD && isMinimized) {
        isDraggingRef.current = false
        dragStartYRef.current = null
        // Expand the sheet
        setInternalMinimized(false)
        onExpand?.()
      }
      // If dragged down significantly and currently expanded
      else if (deltaY > DRAG_THRESHOLD && !isMinimized) {
        isDraggingRef.current = false
        dragStartYRef.current = null
        // Minimize the sheet
        setInternalMinimized(true)
        onMinimize?.()
      }
    },
    [isMinimized, onExpand, onMinimize],
  )

  // Handle drag end - optimized with refs
  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    dragStartYRef.current = null
  }, [])

  // Calculate Y position based on minimized state and header height - memoized
  const calculateYPosition = useMemo(() => {
    if (isMinimized) {
      // If we know the header height, use container height minus header height
      if (headerHeight && containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight
        return containerHeight - headerHeight
      }
      // Fallback to a default value
      return "calc(100% - var(--header-height, 64px))"
    }
    return 0
  }, [isMinimized, headerHeight])

  /** Let parent forcibly close the sheet. */
  const closeSheet = useCallback(() => {
    if (!isOpen) return Promise.resolve()
    return new Promise<void>((resolve) => {
      closePromiseResolverRef.current = resolve
      // Let parent handle toggling isOpen => false
      onDismiss?.()
    })
  }, [isOpen, onDismiss])

  useImperativeHandle(ref, () => ({ closeSheet }), [closeSheet])

  // After we animate out, if there's a pending closeSheet() promise, resolve it
  const handleAnimationComplete = useCallback(() => {
    if (!isOpen && closePromiseResolverRef.current) {
      closePromiseResolverRef.current()
      closePromiseResolverRef.current = null
    }
  }, [isOpen])

  // Animate to calculated Y position when expanded/minimized state changes
  useEffect(() => {
    if (!isOpen) return

    controls.start({
      y: calculateYPosition,
      transition: { duration: 0.2, ease: "easeInOut" },
    })
  }, [isOpen, isMinimized, headerHeight, controls, calculateYPosition])

  // If we open the sheet => default to expanded
  useEffect(() => {
    if (isOpen) {
      setInternalMinimized(false)
    }
  }, [isOpen])

  // Tapping the header toggles minimized
  const toggleMinimized = useCallback(() => {
    if (isMinimized) {
      // Was minimized => expand
      setInternalMinimized(false)
      onExpand?.()
    } else {
      // Was expanded => minimize
      setInternalMinimized(true)
      onMinimize?.()
    }
  }, [isMinimized, onExpand, onMinimize])

  // Memoize the drag handler to prevent recreating on every render
  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // If dragged up and currently minimized
      if (info.offset.y < -DRAG_THRESHOLD && isMinimized) {
        // Expand the sheet
        setInternalMinimized(false)
        onExpand?.()
      }
      // If dragged down and currently expanded
      else if (info.offset.y > DRAG_THRESHOLD && !isMinimized) {
        // Minimize the sheet
        setInternalMinimized(true)
        onMinimize?.()
      }

      // Always animate back to proper position after drag
      controls.start({
        y: calculateYPosition,
        transition: { duration: 0.2, ease: "easeInOut" },
      })
    },
    [isMinimized, onExpand, onMinimize, controls, calculateYPosition],
  )

  // Memoize the container style to prevent recreating on every render
  const containerStyle = useMemo(
    () => ({
      height: "auto",
      maxHeight: MAX_EXPANDED_HEIGHT,
      // Set CSS variable for the header height
      ...(headerHeight ? ({ "--header-height": `${headerHeight}px` } as React.CSSProperties) : {}),
    }),
    [headerHeight],
  )

  // Memoize the body style to prevent recreating on every render
  const bodyStyle = useMemo(
    () => ({
      opacity: isMinimized ? 0 : 1,
      pointerEvents: isMinimized ? ("none" as const) : ("auto" as const),
    }),
    [isMinimized],
  )

  // Only render when open
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[999] pointer-events-none"
        key="sheet-container"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onAnimationComplete={handleAnimationComplete}
        style={{ height: "auto" }}
      >
        {/* The sheet container - with pointer events enabled */}
        <motion.div
          ref={containerRef}
          className="w-full pointer-events-auto"
          style={containerStyle}
          animate={controls}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          dragMomentum={false} // Disable momentum for more precise control
        >
          <div
            className={cn(
              "relative bg-black text-white rounded-t-lg border-t border-gray-800 shadow-xl flex flex-col h-full",
              className,
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
              onTouchStart={(e) => handleDragStart(e.nativeEvent as unknown as TouchEvent)}
              onTouchMove={(e) => handleDragMove(e.nativeEvent as unknown as TouchEvent)}
              onTouchEnd={handleTouchEnd}
            />

            {/* Body content - only draggable in the header */}
            <div
              ref={bodyRef}
              className="flex-grow overflow-y-auto transition-all duration-200 px-3 pt-2 pb-3"
              style={bodyStyle}
            >
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Use React.memo to prevent unnecessary re-renders of the entire component
export default memo(forwardRef(SheetImpl))

