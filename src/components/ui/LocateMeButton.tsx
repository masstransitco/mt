"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Crosshair } from "lucide-react"
import { toast } from "react-hot-toast"
import { locateUser } from "@/lib/UserLocation"
import { cn } from "@/lib/utils"

export type LocateMePosition = "sheet" | "bottom" | "inline"

interface LocateMeButtonProps {
  // Position variant for styling/placement
  position?: LocateMePosition
  // Optional callback for component-specific behavior
  onSuccess?: (loc: google.maps.LatLngLiteral) => void
}

export default function LocateMeButton({
  position = "inline",
  onSuccess,
}: LocateMeButtonProps) {
  const [isLocating, setIsLocating] = useState(false)
  const [locationFound, setLocationFound] = useState(false)

  const handleLocateMe = async () => {
    if (isLocating) return

    setIsLocating(true)
    setLocationFound(false)

    const toastId = toast.loading("Finding your location...")

    try {
      console.log("[LocateMeButton] User clicked locate-me")
      
      // Single call to centralized locate function with source
      const location = await locateUser({
        source: "locate-me-button"
      })
      
      if (location) {
        toast.dismiss(toastId)
        toast.success("Location found!")
        
        // Call optional success callback for component-specific behavior
        onSuccess?.(location)
        
        // Show success state briefly
        setLocationFound(true)
        setTimeout(() => setLocationFound(false), 2000)
      } else {
        toast.dismiss(toastId)
      }
    } catch (error) {
      console.error("Error getting location:", error)
      toast.dismiss(toastId)
      toast.error("Unable to get your location")
    } finally {
      setIsLocating(false)
    }
  }

  // Position-based styling
  const buttonStyles = {
    sheet: "px-3 py-1.5 h-[30px] w-full", // Full width with reduced height
    bottom: "px-3 py-1.5 h-[30px] w-auto",
    inline: "px-3 py-1.5 h-[30px] w-auto"
  }

  return (
    <motion.button
      onClick={handleLocateMe}
      whileTap={{ scale: 0.95 }}
      disabled={isLocating}
      className={cn(`
        relative flex items-center justify-center gap-2
        text-xs text-white font-medium
        border border-white/10 rounded-xl
        bg-black/90 backdrop-blur-md
        hover:bg-black hover:border-white/20
        transition-all duration-200 shadow-lg z-10
      `, buttonStyles[position])}
      type="button"
    >
      <Crosshair className="w-3.5 h-3.5" />
      <span>Locate me</span>

      {/* Ripple effect while locating */}
      {isLocating && (
        <>
          <motion.span
            className="absolute inset-0 rounded-xl border-2 border-[#10a37f]"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 1.2,
              transition: {
                repeat: Number.POSITIVE_INFINITY,
                duration: 1.5,
                ease: "easeOut",
              },
            }}
          />
          <motion.span
            className="absolute inset-0 rounded-xl border-2 border-[#10a37f]"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 1.2,
              transition: {
                repeat: Number.POSITIVE_INFINITY,
                duration: 1.5,
                delay: 0.5,
                ease: "easeOut",
              },
            }}
          />
        </>
      )}

      {/* Success highlight */}
      {locationFound && (
        <motion.span
          className="absolute inset-0 rounded-xl bg-[#10a37f]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  )
}