"use client"

import type React from "react"
import { useCallback, useRef, useState, useEffect, type ReactNode, forwardRef } from "react"
import { AnimatePresence, motion, useDragControls, type PanInfo, type Variants } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useBodyScrollLock } from "@/lib/useBodyScrollLock"

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
  /** Whether to disable minimizing the sheet. */
  disableMinimize?: boolean
  /** Additional CSS classes for the sheet container. */
  className?: string
  /** The main body contents rendered inside the sheet. */
  children: ReactNode
}

// Enhanced spring physics for the sheet's motion variants
const sheetVariants: Variants = {
  hidden: {
    y: "100%",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  minimized: {
    y: "85%",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  expanded: {
    y: "0%",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
}

// Content animation variants
const contentVariants: Variants = {
  hidden: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.25,
      delay: 0.05,
    },
  },
}

/**
 * Trigger haptic feedback on iOS devices
 */
const triggerHapticFeedback = () => {
  // Check if device supports vibration
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10) // Short vibration
  } else if (typeof window !== "undefined" && window.navigator && "vibrate" in window.navigator) {
    // @ts-ignore - Some browsers have vibrate on window.navigator
    window.navigator.vibrate(10)
  }
}

/**
 * A Sheet (bottom drawer) with open/close/minimize states managed via Framer Motion.
 */
const Sheet = forwardRef<HTMLDivElement, SheetProps>(function Sheet(
  {
    isOpen,
    isMinimized,
    onMinimize,
    onExpand,
    onDismiss,
    highPriority = false,
    disableMinimize = false,
    className,
    children,
  }: SheetProps,
  ref
) {
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

  // Track previous minimized state for animations
  const [prevMinimized, setPrevMinimized] = useState(isMinimized)
  const [contentVisible, setContentVisible] = useState(!isMinimized)

  // Update content visibility based on minimized state changes
  useEffect(() => {
    if (prevMinimized !== isMinimized) {
      if (isMinimized) {
        // When minimizing, start fading out content
        setContentVisible(false)
      } else {
        // When expanding, make content visible
        setContentVisible(true)
      }
      setPrevMinimized(isMinimized)
    }
  }, [isMinimized, prevMinimized])

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
   * or in a 3D interactive element
   */
  const isInScrollableContent = useCallback((target: HTMLElement | null): boolean => {
    if (!target) return false

    // Check if the target is inside a 3D viewer
    if (target.closest(".three-d-scene")) {
      return true // Always prevent sheet drag for 3D interactions
    }

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
        // Trigger haptic feedback when crossing threshold
        triggerHapticFeedback()
        onMinimize?.()
        return
      }

      // If minimized and user drags up > 50px => expand
      if (isMinimized && info.offset.y < -50) {
        // Trigger haptic feedback when crossing threshold
        triggerHapticFeedback()
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

      // Prevent dragging if in a 3D scene or scrollable content
      if (isInScrollableContent(target) || target.closest(".three-d-scene")) {
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
          className={cn("fixed bottom-0 left-0 right-0 motion-div-sheet sheet-container", zIndexClass)}
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
            ref={ref}
            className={cn(
              "relative bg-black/90 backdrop-blur-md text-white rounded-t-xl shadow-xl border border-white/10 flex flex-col select-none",
              className,
            )}
            style={{
              pointerEvents: "auto",
              boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.25), 0 -2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Top area with centered drag handle that serves as the minimize button */}
            <div
              ref={headerRef}
              className="relative flex items-center justify-center pt-3 pb-2 cursor-pointer w-full"
              onClick={() => {
                if (!disableMinimize) {
                  if (isMinimized) {
                    triggerHapticFeedback()
                    onExpand?.()
                  } else {
                    triggerHapticFeedback()
                    onMinimize?.()
                  }
                }
              }}
              onPointerDown={handleHeaderPointerDown}
            >
              <div
                className={cn(
                  "w-12 h-1.5 rounded-full transition-all duration-200",
                  isMinimized 
                    ? "bg-gradient-to-r from-[#3a3a3a] via-[#4c4c4c] to-[#3a3a3a]" 
                    : "bg-gradient-to-r from-[#333333] via-[#444444] to-[#333333]"
                )}
                style={{
                  boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1)",
                }}
              ></div>
            </div>

            {/* Body area with fade animation */}
            <motion.div
              ref={bodyRef}
              className={cn(
                "flex-grow overflow-y-auto overscroll-contain transition-all duration-200 sheet-body sheet-content-area",
                // Let individual components control their own padding
              )}
              style={{
                WebkitOverflowScrolling: "touch",
                pointerEvents: isMinimized ? "none" : "auto",
                touchAction: "pan-y",
              }}
              onTouchStart={handleBodyTouchStart}
              variants={contentVariants}
              initial="hidden"
              animate={contentVisible ? "visible" : "hidden"}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
});

export default Sheet;