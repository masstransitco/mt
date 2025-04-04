// UserLocation.ts - Centralized location manager
import { setUserLocation, setSearchLocation } from "@/store/userSlice";
import { toast } from "react-hot-toast";
import { store } from "@/store/store";

// Custom event for notifying components of location updates
export const USER_LOCATION_UPDATED_EVENT = "user-location-updated";

// Event payload for location updates
export interface LocationUpdateEvent {
  location: google.maps.LatLngLiteral;
  source: "locate-me-button" | "system" | "fallback";
}

interface UserLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  updateSearchLocation?: boolean;
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
    
    // Dispatch custom event (with cache source)
    dispatchLocationEvent(cachedPosition, "system");
    
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
    
    // Dispatch custom event with locate-me source
    dispatchLocationEvent(location, "locate-me-button");

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
  source: LocationUpdateEvent["source"]
) {
  const event = new CustomEvent<LocationUpdateEvent>(USER_LOCATION_UPDATED_EVENT, {
    detail: { location, source }
  });
  window.dispatchEvent(event);
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