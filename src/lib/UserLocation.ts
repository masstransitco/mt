// UserLocation.ts - Centralized location manager
import { setUserLocation, setSearchLocation } from "@/store/userSlice";
import { toast } from "react-hot-toast";
import { store } from "@/store/store";

// Custom event for notifying components of location updates
export const USER_LOCATION_UPDATED_EVENT = "user-location-updated";

// Event payload for location updates
export interface LocationUpdateEvent {
  location: google.maps.LatLngLiteral;
  source: "locate-me-button" | "system" | "fallback" | "button-click";
  forceAnimation?: boolean;
  timestamp?: number;
}

interface UserLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  updateSearchLocation?: boolean;
  forceAnimation?: boolean;  // Add parameter to force animation even if location hasn't changed
  onLocationFound?: (loc: google.maps.LatLngLiteral) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
}

// Simple cache to avoid excessive location requests
let locationCache: {
  position: google.maps.LatLngLiteral | null;
  timestamp: number;
} = {
  position: null,
  timestamp: 0
};

// Max cache age (5 minutes)
const MAX_CACHE_AGE = 5 * 60 * 1000; 

/**
 * Get user location and dispatch a custom event
 */
export async function getUserLocation(options: UserLocationOptions = {}): Promise<google.maps.LatLngLiteral | null> {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 30000,
    updateSearchLocation = false,
    onLocationFound,
    onLocationError
  } = options;

  // Check for recent cached position
  const now = Date.now();
  if (locationCache.position && (now - locationCache.timestamp < MAX_CACHE_AGE)) {
    const cachedPosition = locationCache.position;
    
    // Update Redux store
    store.dispatch(setUserLocation(cachedPosition));
    if (updateSearchLocation) {
      store.dispatch(setSearchLocation(cachedPosition));
    }
    
    // Determine the correct source to simulate behavior
    // If we explicitly want to force animation (from locate-me button),
    // use locate-me-button as source even for cached positions
    const source = options.forceAnimation ? "locate-me-button" : "system";
    
    // Dispatch custom event with appropriate source
    dispatchLocationEvent(cachedPosition, source, options.forceAnimation);
    
    // Call callback
    onLocationFound?.(cachedPosition);
    
    return cachedPosition;
  }

  if (!navigator.geolocation) {
    toast.error("Geolocation not supported by your browser.");
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy, timeout, maximumAge }
      );
    });

    // Create location object
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    // Update cache
    locationCache = {
      position: location,
      timestamp: now
    };

    // Update Redux state
    store.dispatch(setUserLocation(location));
    if (updateSearchLocation) {
      store.dispatch(setSearchLocation(location));
    }
    
    // Dispatch custom event with locate-me source and animation flag
    dispatchLocationEvent(location, "locate-me-button", options.forceAnimation);

    // Call success callback
    onLocationFound?.(location);

    return location;
  } catch (error) {
    // Handle geolocation errors
    const geoError = error as GeolocationPositionError;
    handleLocationError(geoError, updateSearchLocation, onLocationError);
    return null;
  }
}

/**
 * Dispatch a custom DOM event for location updates
 */
function dispatchLocationEvent(
  location: google.maps.LatLngLiteral,
  source: LocationUpdateEvent["source"],
  forceAnimation?: boolean
) {
  // Check current booking step to determine if animation should be allowed
  // This aligns with the fix in useCameraAnimation
  const state = store.getState();
  const bookingStep = state.booking?.step || 1;
  const arrivalId = state.booking?.arrivalStationId || null;
  
  // Animation is only allowed in step 1 or step 3 without arrival station selected
  // unless we explicitly force animation (from locate-me button)
  const shouldAnimate = forceAnimation || bookingStep === 1 || (bookingStep === 3 && !arrivalId);
  
  console.log(`[UserLocation] Location event with step=${bookingStep}, arrivalId=${arrivalId}, shouldAnimate=${shouldAnimate}`);
  
  // Include timestamp to help components detect unique location updates
  const event = new CustomEvent<LocationUpdateEvent>(USER_LOCATION_UPDATED_EVENT, {
    detail: { 
      location, 
      source, 
      // Only allow forceAnimation if we determined it should animate based on step
      forceAnimation: shouldAnimate ? forceAnimation : false,
      timestamp: Date.now() // Add timestamp for uniqueness tracking
    }
  });
  
  console.log(`[UserLocation] Dispatching location event: source=${source}, forceAnimation=${shouldAnimate && forceAnimation}`);
  
  // Use setTimeout to ensure event happens after state updates
  setTimeout(() => {
    window.dispatchEvent(event);
  }, 0);
}

/**
 * Handle location errors
 */
function handleLocationError(
  error: GeolocationPositionError,
  updateSearchLocation = false,
  errorCallback?: (error: GeolocationPositionError) => void
) {
  console.error("Geolocation error:", error);
  
  // Call error callback if provided
  if (errorCallback) {
    errorCallback(error);
    return;
  }
  
  // Default error handling
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      toast.error("Location access denied. Please enable location in your browser settings.");
      break;
    case 2: // POSITION_UNAVAILABLE
      // In development, use fallback Hong Kong location
      if (process.env.NODE_ENV === "development") {
        const fallbackLoc = { lat: 22.2988, lng: 114.1722 };
        
        toast.success("Using default location for development");
        
        // Update Redux state with fallback
        store.dispatch(setUserLocation(fallbackLoc));
        if (updateSearchLocation) {
          store.dispatch(setSearchLocation(fallbackLoc));
        }
        
        // Dispatch with fallback source
        dispatchLocationEvent(fallbackLoc, "fallback");
      } else {
        toast.error("Unable to determine your location. Please try again or enter an address.");
      }
      break;
    case 3: // TIMEOUT
      toast.error("Location request timed out. Please try again.");
      break;
    default:
      toast.error("Unable to retrieve location.");
  }
}