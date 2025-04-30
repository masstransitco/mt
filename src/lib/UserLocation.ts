// UserLocation.ts - Centralized location manager
import { setUserLocation, setSearchLocation } from "@/store/userSlice"
import { toast } from "react-hot-toast"
import { store } from "@/store/store"
import cameraAnimationManager from "@/lib/cameraAnimationManager"

// Custom event for notifying components of location updates
export const USER_LOCATION_UPDATED_EVENT = "user-location-updated"

// Event payload for location updates
export interface LocationUpdateEvent {
  location: google.maps.LatLngLiteral
  timestamp: number
  source?: string
}

// Simple cache to avoid excessive location requests
let locationCache: {
  position: google.maps.LatLngLiteral | null
  timestamp: number
} = {
  position: null,
  timestamp: 0
}

// Max cache age (30 seconds for button clicks)
const MAX_CACHE_AGE = 30 * 1000

/**
 * Main user location function - centralized single point of location handling
 * Handles all the redux updates and events in one place
 */
export async function locateUser(options: {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  animateCamera?: boolean
  source?: string
} = {}): Promise<google.maps.LatLngLiteral | null> {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 5000, // Short cache for locate button
    animateCamera = true, // Whether to animate the camera to the location
    source
  } = options

  try {
    // Check for recent cached position
    const now = Date.now()
    if (locationCache.position && (now - locationCache.timestamp < MAX_CACHE_AGE)) {
      const cachedPosition = locationCache.position
      return await processLocation(cachedPosition, animateCamera, source)
    }

    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser")
      return null
    }

    // Get current position from browser
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy, timeout, maximumAge }
      )
    })

    // Create location object
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    }

    // Update cache
    locationCache = {
      position: location,
      timestamp: now
    }

    return await processLocation(location, animateCamera, source)
  } catch (error) {
    handleLocationError(error)
    return null
  }
}

/**
 * Central function to process a location update
 * Handles all side effects of a location update
 */
async function processLocation(
  location: google.maps.LatLngLiteral, 
  animateCamera: boolean = true,
  source?: string
): Promise<google.maps.LatLngLiteral> {
  // 1. Update Redux state
  store.dispatch(setUserLocation(location))
  store.dispatch(setSearchLocation(location))
  
  // 2. Dispatch DOM event for components listening for location changes
  const event = new CustomEvent<LocationUpdateEvent>(USER_LOCATION_UPDATED_EVENT, {
    detail: { 
      location,
      timestamp: Date.now(),
      source
    }
  })
  
  // Use setTimeout to ensure event happens after state updates
  setTimeout(() => {
    window.dispatchEvent(event)
  }, 0)
  
  // Note: We don't animate the camera here.
  // Camera animations are triggered by the components that call locateUser (like LocateMeButton),
  // ensuring animation requests go through CameraAnimationManager.
  
  // 4. Return the location for direct use
  return location
}

/**
 * Handle location errors
 */
function handleLocationError(error: any) {
  console.error("Geolocation error:", error)
  
  const geoError = error as GeolocationPositionError
  
  switch (geoError?.code) {
    case 1: // PERMISSION_DENIED
      toast.error("Location access denied. Please enable location in your browser settings.")
      break
    case 2: // POSITION_UNAVAILABLE
      // Development fallback
      if (process.env.NODE_ENV === "development") {
        const fallbackLoc = { lat: 22.2988, lng: 114.1722 } // Hong Kong
        toast.success("Using default location for development")
        processLocation(fallbackLoc, true, "fallback")
      } else {
        toast.error("Unable to determine your location. Please try again or enter an address.")
      }
      break
    case 3: // TIMEOUT
      toast.error("Location request timed out. Please try again.")
      break
    default:
      toast.error("Unable to retrieve location.")
  }
}

// Legacy function has been removed in favor of locateUser