"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Crosshair } from "lucide-react"
import { toast } from "react-hot-toast"
import { getUserLocation, USER_LOCATION_UPDATED_EVENT } from "@/lib/UserLocation"

// Add props with clear separation of concerns
interface LocateMeButtonProps {
  // Callback when location is found - for UI updates without animation
  onLocationFound?: (loc: google.maps.LatLngLiteral) => void
  // Whether to update userLocation in Redux - for animation and state
  updateReduxState?: boolean
  // Whether to trigger animation directly - to prevent racing animations
  animateToLocation?: boolean
  // Whether to also update search location - to ensure consistent station sorting
  updateSearchLocation?: boolean
  // Direct reference to camera animation function - for explicit animation triggering
  onAnimateToLocation?: (loc: google.maps.LatLngLiteral, zoom?: number) => void
}

export default function LocateMeButton({ 
  onLocationFound,
  updateReduxState = true,
  animateToLocation = true,
  updateSearchLocation = false,
  onAnimateToLocation
}: LocateMeButtonProps) {
  const [isLocating, setIsLocating] = useState(false)
  const [locationFound, setLocationFound] = useState(false)

  const handleLocateMe = async () => {
    if (isLocating) return

    setIsLocating(true)
    setLocationFound(false)

    const toastId = toast.loading("Finding your location...")

    try {
      // IMPORTANT: Log that this is a user-initiated locate-me action
      console.log("[LocateMeButton] User clicked locate-me, requesting location")
      
      // Use centralized location service to get position
      const location = await getUserLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000, // Shorter cache time for button clicks (5 seconds)
        updateSearchLocation: true, // Always update search location in Redux for consistent behavior
        forceAnimation: true, // Always force animation when locate-me button is clicked
        onLocationFound: (loc) => {
          console.log("[LocateMeButton] Location found:", loc)
          
          // IMPORTANT: Call the callback to ensure GMap gets notified DIRECTLY
          onLocationFound?.(loc)
        }
      })

      if (location) {
        toast.dismiss(toastId)
        toast.success("Location found!")
        
        // Directly trigger camera animation for a smoother experience
        if (onAnimateToLocation) {
          console.log("[LocateMeButton] Triggering camera animation to location")
          onAnimateToLocation(location, 15) // Zoom level 15 matches the default
        }
        
        // Show success state for 2s
        setLocationFound(true)
        setTimeout(() => setLocationFound(false), 2000)
      } else {
        // If no location returned, the error was already handled
        toast.dismiss(toastId)
      }
    } catch (error) {
      console.error("Unexpected error getting location:", error)
      toast.dismiss(toastId)
      toast.error("Unexpected error getting location")
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <motion.button
      onClick={handleLocateMe}
      whileTap={{ scale: 0.95 }}
      disabled={isLocating}
      className={`
        relative flex items-center gap-1.5 
        text-xs text-white px-2.5 py-1 bg-[#2a2a2a] rounded-lg 
        hover:bg-[#333333] transition-colors z-10
      `}
      type="button"
    >
      <Crosshair className="w-3 h-3" />
      <span>Locate me</span>

      {/* Ripple effect while locating */}
      {isLocating && (
        <>
          <motion.span
            className="absolute inset-0 rounded-lg border-2 border-[#10a37f]"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 1.2,
              transition: {
                repeat: Infinity,
                duration: 1.5,
                ease: "easeOut"
              }
            }}
          />
          <motion.span
            className="absolute inset-0 rounded-lg border-2 border-[#10a37f]"
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: 0,
              scale: 1.2,
              transition: {
                repeat: Infinity,
                duration: 1.5,
                delay: 0.5,
                ease: "easeOut"
              }
            }}
          />
        </>
      )}

      {/* Brief success highlight */}
      {locationFound && (
        <motion.span
          className="absolute inset-0 rounded-lg bg-[#10a37f]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  )
}