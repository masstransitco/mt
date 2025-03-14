"use client"

import { useEffect, useRef } from "react"

export const useBodyScrollLock = (locked: boolean) => {
  // Store the original overflow style to restore it correctly
  const originalStyleRef = useRef<string>("")

  useEffect(() => {
    // Store original only once when the hook mounts
    if (originalStyleRef.current === "") {
      originalStyleRef.current = window.getComputedStyle(document.body).overflow
    }

    if (locked) {
      // Save current scroll position
      const scrollY = window.scrollY

      // Apply lock
      document.body.style.overflow = "hidden"
      document.body.style.position = "fixed"
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = "100%"
    } else {
      // Get the scroll position from the body's top property
      const scrollY = document.body.style.top ? Number.parseInt(document.body.style.top || "0", 10) * -1 : 0

      // Restore original styles
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.width = ""

      // Restore scroll position
      window.scrollTo(0, scrollY)
    }

    // Cleanup function to ensure body scroll is always restored
    return () => {
      const scrollY = document.body.style.top ? Number.parseInt(document.body.style.top || "0", 10) * -1 : 0

      document.body.style.overflow = originalStyleRef.current
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.width = ""

      window.scrollTo(0, scrollY)
    }
  }, [locked])
}

