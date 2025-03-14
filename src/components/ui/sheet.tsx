"use client"

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
import { AnimatePresence, motion, useAnimation, useDragControls, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"

// Constants
const MINIMIZED_HEIGHT = "auto"
const MAX_EXPANDED_HEIGHT = "90vh"
const DRAG_THRESHOLD = 50

/**
 * The sheet header component
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
  onDragStart,
  onDragEnd,
  startDrag,
}: {
  title?: string
  subtitle?: ReactNode
  headerContent?: ReactNode
  count?: number
  countLabel?: string
  isMinimized: boolean
  onToggle: () => void
  headerRef: React.RefObject<HTMLDivElement>
  onDragStart?: () => void
  onDragEnd?: (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void
  startDrag: (e: React.PointerEvent) => void
}) {
  // Memoize the title/subtitle/count section
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

  // Handle pointer down to start drag
  const handlePointerDown = (e: React.PointerEvent) => {
    startDrag(e)
    if (onDragStart) onDragStart()
  }

  return (
    <div
      ref={headerRef}
      className="cursor-grab active:cursor-grabbing w-full"
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        // Prevent click events from toggling the sheet
        e.preventDefault()
      }}
    >
      {/* Container with minimal top/bottom padding */}
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1">
        {titleSection}
        {headerContentSection}
      </div>

      {/* Visual divider */}
      <div className="w-4/5 h-0.5 bg-gray-800 mx-auto mt-1 mb-1 rounded-full" />
    </div>
  )
})

SheetHeader.displayName = "SheetHeader"

/**
 * Sheet props interface
 */
export interface SheetProps {
  isOpen: boolean
  isMinimized?: boolean
  children: ReactNode
  className?: string
  title?: string
  subtitle?: ReactNode
  headerContent?: ReactNode
  count?: number
  countLabel?: string
  onMinimize?: () => void
  onExpand?: () => void
  onDismiss?: () => void
}

/**
 * Sheet handle interface for imperative control
 */
export interface SheetHandle {
  closeSheet: () => Promise<void>
}

/**
 * Sheet implementation with proper scroll behavior that doesn't cause layout shifts
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
  const sheetRef = useRef<HTMLDivElement>(null)

  // Track header height for minimized state
  const headerHeightRef = useRef<number | null>(null)
  const [headerHeight, setHeaderHeight] = useState<number | null>(null)

  // For tracking drag gestures
  const isDraggingRef = useRef(false)

  // Framer Motion control for the sheet's Y offset
  const controls = useAnimation()

  // Create drag controls
  const dragControls = useDragControls()

  // For parent's .closeSheet() calls
  const closePromiseResolverRef = useRef<(() => void) | null>(null)

  // Observer ref to properly clean up
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Get window width for calculations
  const [windowWidth, setWindowWidth] = useState<number>(0)
  
  // Track scroll position
  const scrollYRef = useRef<number>(0)

  // Use effect for body scroll lock - FIXED VERSION
  useEffect(() => {
    if (!isOpen) return

    // Only lock scroll when sheet is open and expanded (not minimized)
    if (!isMinimized) {
      // Save current scroll position
      scrollYRef.current = window.scrollY
      
      // Calculate scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      // Save original styles
      const originalStyles = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      }
      
      // Apply scroll lock
      document.body.style.overflow = 'hidden'
      
      // Add padding to prevent layout shift when scrollbar disappears
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalStyles.overflow
        document.body.style.paddingRight = originalStyles.paddingRight
      }
    }
  }, [isOpen, isMinimized])

  // Measure header height when it changes
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

  // Update window width on resize for layout calculations
  useEffect(() => {
    // Initial width
    setWindowWidth(window.innerWidth)
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Handle drag start
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  // Function to start drag - passed to header
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      dragControls.start(e)
    },
    [dragControls],
  )

  // Calculate Y position based on minimized state and header height
  const calculateYPosition = useMemo(() => {
    if (isMinimized) {
      // If we know the header height, use container height minus header height
      if (headerHeight && containerRef.current) {
        const containerHeight = containerRef.current.offsetHeight
        return containerHeight - headerHeight
      }
      // Fallback
      return "calc(100% - var(--header-height, 64px))"
    }
    return 0
  }, [isMinimized, headerHeight])

  // Let parent forcibly close the sheet
  const closeSheet = useCallback(() => {
    if (!isOpen) return Promise.resolve()
    return new Promise<void>((resolve) => {
      closePromiseResolverRef.current = resolve
      onDismiss?.()
    })
  }, [isOpen, onDismiss])

  useImperativeHandle(ref, () => ({ closeSheet }), [closeSheet])

  // After animation, resolve promise if needed
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

  // Placeholder function - we rely solely on drag gestures
  const toggleMinimized = useCallback(() => {
    // No-op
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      isDraggingRef.current = false

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

  // Container style
  const containerStyle = useMemo(
    () => ({
      height: "auto",
      maxHeight: MAX_EXPANDED_HEIGHT,
      // Set CSS variable for the header height
      ...(headerHeight ? ({ "--header-height": `${headerHeight}px` } as React.CSSProperties) : {}),
    }),
    [headerHeight],
  )

  // Body style
  const bodyStyle = useMemo(
    () => ({
      opacity: isMinimized ? 0 : 1,
      pointerEvents: isMinimized ? ("none" as const) : ("auto" as const),
    }),
    [isMinimized],
  )

  // Handle touch in body to prevent unwanted scrolling behavior
  const handleBodyTouchMove = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight
    
    // Check if we're at the boundaries
    const isAtTop = scrollTop <= 0
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 1
    
    // Get touch direction
    const touch = e.touches[0]
    const touchStartY = target.dataset.touchStartY ? 
      parseFloat(target.dataset.touchStartY) : 
      touch.clientY
    
    // Determine scroll direction
    const isScrollingUp = touch.clientY > touchStartY
    const isScrollingDown = touch.clientY < touchStartY
    
    // Store current touch position for next comparison
    target.dataset.touchStartY = touch.clientY.toString()
    
    // Prevent default only when trying to scroll beyond boundaries
    if ((isAtTop && isScrollingUp) || (isAtBottom && isScrollingDown)) {
      e.preventDefault()
    }
  }, [])
  
  // Reset touch tracking on touch end
  const handleBodyTouchEnd = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement
    delete target.dataset.touchStartY
  }, [])

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
        style={{ width: '100%' }}
      >
        {/* The sheet container - with pointer events enabled */}
        <motion.div
          ref={containerRef}
          className="w-full pointer-events-auto"
          style={containerStyle}
          animate={controls}
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          dragMomentum={false}
        >
          <div
            ref={sheetRef}
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
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              startDrag={startDrag}
            />

            {/* Body content - not draggable */}
            <div
              ref={bodyRef}
              className="flex-grow overflow-y-auto overscroll-contain transition-all duration-200 px-3 pt-2 pb-3"
              style={bodyStyle}
              onTouchStart={(e) => {
                // Store initial touch position
                const target = e.currentTarget as HTMLDivElement
                target.dataset.touchStartY = e.touches[0].clientY.toString()
              }}
              onTouchMove={handleBodyTouchMove}
              onTouchEnd={handleBodyTouchEnd}
            >
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Use React.memo to prevent unnecessary re-renders
export default memo(forwardRef(SheetImpl))
