"use client"

import React, { useState } from "react"
import { useAppDispatch } from "@/store/store"
import { motion } from "framer-motion"
import { Crosshair } from "lucide-react"
import { toast } from "react-hot-toast"
import { setUserLocation, setSearchLocation } from "@/store/userSlice"

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
}

export default function LocateMeButton({ 
  onLocationFound,
  updateReduxState = true,
  animateToLocation = true,
  updateSearchLocation = false
}: LocateMeButtonProps) {
  const dispatch = useAppDispatch()
  const [isLocating, setIsLocating] = useState(false)
  const [locationFound, setLocationFound] = useState(false)

  const handleLocateMe = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.")
      return
    }
    if (isLocating) return

    setIsLocating(true)
    setLocationFound(false)

    const toastId = toast.loading("Finding your location...")

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        toast.dismiss(toastId)
        toast.success("Location found!")

        // Mark success state for 2s
        setLocationFound(true)
        setTimeout(() => setLocationFound(false), 2000)

        // Create location object
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        
        // First call the callback for UI updates
        // This should happen before Redux updates to prepare UI
        onLocationFound?.(loc)
        
        // Update Redux state if requested - this will trigger animations via the useCameraAnimation hook
        if (updateReduxState) {
          // Update user location - this is the primary location source
          dispatch(setUserLocation(loc))
          
          // Always update search location when requested
          // This ensures consistent station sorting
          if (updateSearchLocation) {
            // Update search location right away to ensure station list updates immediately
            dispatch(setSearchLocation(loc as google.maps.LatLngLiteral))
          }
        }
      },
      (err) => {
        console.error("Geolocation error:", err)
        setIsLocating(false)
        toast.dismiss(toastId)
        toast.error("Unable to retrieve location.")
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    )
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