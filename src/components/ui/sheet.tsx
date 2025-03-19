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
  headerRef,
  onDragStart,
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

  const headerContentSection = useMemo(() => {
    if (!headerContent) return null
    return <div className="mt-1">{headerContent}</div>
  }, [headerContent])

  const handlePointerDown = (e: React.PointerEvent) => {
    startDrag(e)
    if (onDragStart) onDragStart()
  }

  return (
    <div
      ref={headerRef}
      className="cursor-grab active:cursor-grabbing w-full"
      onPointerDown={handlePointerDown}
      onClick={(e) => e.preventDefault()}
    >
      <div className="px-3 pt-2 pb-1 flex flex-col gap-1">
        {titleSection}
        {headerContentSection}
      </div>
      <div className="w-4/5 h-0.5 bg-gray-800 mx-auto mt-1 mb-1 rounded-full" />
    </div>
  )
})

SheetHeader.displayName = "SheetHeader"

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

export interface SheetHandle {
  closeSheet: () => Promise<void>
}

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
  const [internalMinimized, setInternalMinimized] = useState(false)
  const isMinimized = externalMinimized !== undefined ? externalMinimized : internalMinimized

  // All hooks run unconditionally
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const headerHeightRef = useRef<number | null>(null)
  const [headerHeight, setHeaderHeight] = useState<number | null>(null)
  const isDraggingRef = useRef(false)
  const controls = useAnimation()
  const dragControls = useDragControls()
  const closePromiseResolverRef = useRef<(() => void) | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [windowWidth, setWindowWidth] = useState<number>(0)
  const scrollYRef = useRef<number>(0)

  useEffect(() => {
    if (!isOpen) return
    if (!isMinimized) {
      scrollYRef.current = window.scrollY
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      const originalStyles = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      }
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      return () => {
        document.body.style.overflow = originalStyles.overflow
        document.body.style.paddingRight = originalStyles.paddingRight
      }
    }
  }, [isOpen, isMinimized])

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
    updateHeaderHeight(headerRef.current.offsetHeight)
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
  }, [])

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      dragControls.start(e)
    },
    [dragControls],
  )

  const calculateYPosition = useMemo(() => {
    if (isMinimized) {
      if (headerHeight) {
        return `calc(100% - ${headerHeight}px - env(safe-area-inset-bottom, 0px))`;
      }
      return `calc(100% - var(--header-height, 64px) - env(safe-area-inset-bottom, 0px))`;
    }
    return 0;
  }, [isMinimized, headerHeight]);

  const closeSheet = useCallback(() => {
    if (!isOpen) return Promise.resolve()
    return new Promise<void>((resolve) => {
      closePromiseResolverRef.current = resolve
      onDismiss?.()
    })
  }, [isOpen, onDismiss])

  useImperativeHandle(ref, () => ({ closeSheet }), [closeSheet]);

  const handleAnimationComplete = useCallback(() => {
    if (!isOpen && closePromiseResolverRef.current) {
      closePromiseResolverRef.current()
      closePromiseResolverRef.current = null
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return
    controls.start({
      y: calculateYPosition,
      transition: { duration: 0.2, ease: "easeInOut" },
    })
  }, [isOpen, isMinimized, headerHeight, controls, calculateYPosition]);

  useEffect(() => {
    if (isOpen) {
      setInternalMinimized(false)
    }
  }, [isOpen]);

  const toggleMinimized = useCallback(() => {
    // No-op; we rely on drag gestures
  }, []);

  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      isDraggingRef.current = false;
      if (info.offset.y < -DRAG_THRESHOLD && isMinimized) {
        setInternalMinimized(false);
        onExpand?.();
      } else if (info.offset.y > DRAG_THRESHOLD && !isMinimized) {
        setInternalMinimized(true);
        onMinimize?.();
      }
      controls.start({
        y: calculateYPosition,
        transition: { duration: 0.2, ease: "easeInOut" },
      });
    },
    [isMinimized, onExpand, onMinimize, controls, calculateYPosition]
  );

  const containerStyle = useMemo(
    () => ({
      height: "auto",
      maxHeight: MAX_EXPANDED_HEIGHT,
      ...(headerHeight ? ({ "--header-height": `${headerHeight}px` } as React.CSSProperties) : {}),
    }),
    [headerHeight]
  );

  const bodyStyle = useMemo(
    () => ({
      opacity: isMinimized ? 0 : 1,
      pointerEvents: isMinimized ? ("none" as const) : ("auto" as const),
    }),
    [isMinimized]
  );

  const handleBodyTouchMove = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    const isAtTop = scrollTop <= 0;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 1;
    const touch = e.touches[0];
    const touchStartY = target.dataset.touchStartY ? parseFloat(target.dataset.touchStartY) : touch.clientY;
    const isScrollingUp = touch.clientY > touchStartY;
    const isScrollingDown = touch.clientY < touchStartY;
    target.dataset.touchStartY = touch.clientY.toString();
    if ((isAtTop && isScrollingUp) || (isAtBottom && isScrollingDown)) {
      e.preventDefault();
    }
  }, []);

  const handleBodyTouchEnd = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    delete target.dataset.touchStartY;
  }, []);


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
        style={{ width: "100%", maxHeight: "100%" }}
      >
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
              "select-none",
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
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              startDrag={startDrag}
            />
            <div
              ref={bodyRef}
              className="flex-grow overflow-y-auto overscroll-contain transition-all duration-200 px-3 pt-2 pb-3"
              style={bodyStyle}
              onTouchStart={(e) => {
                const target = e.currentTarget as HTMLDivElement;
                target.dataset.touchStartY = e.touches[0].clientY.toString();
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
  );
}

export default memo(forwardRef(SheetImpl));
