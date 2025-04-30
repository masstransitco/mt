// src/lib/useBodyScrollLock.ts

import { useEffect } from 'react'

/**
 * A simplified hook that locks the body scroll when active
 * without causing layout shifts to other components.
 * 
 * @param isActive Whether the scroll lock should be active
 */
export function useBodyScrollLock(isActive: boolean = true) {
  useEffect(() => {
    if (isActive) {
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight
      
      // Apply scroll lock
      document.body.style.overflow = 'hidden'
      
      // Add padding to prevent layout shift when scrollbar disappears
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      
      // Clean up when the effect is re-run or the component unmounts
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isActive])
}
