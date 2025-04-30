// lib/googleMaps.ts
import { throttle } from 'lodash';

/**
 * Improved utility for safely loading and using Google Maps services
 */

// Track the loading state
let isGoogleMapsLoaded = false;
let loadPromise: Promise<void> | null = null;
let waitingResolvers: Array<{resolve: () => void; reject: (err: Error) => void}> = [];

/**
 * Ensures the Google Maps API is fully loaded and its services are available
 * @returns Promise that resolves when Google Maps is ready
 */
export const ensureGoogleMapsLoaded = (): Promise<void> => {
  // If already confirmed as loaded, return immediately
  if (isGoogleMapsLoaded && window.google?.maps?.DirectionsService) {
    return Promise.resolve();
  }
  
  // Return existing promise if already in the process of loading
  if (loadPromise) {
    // Add a new resolver to the waiting list
    return new Promise<void>((resolve, reject) => {
      waitingResolvers.push({ resolve, reject });
    });
  }
  
  // Start loading
  loadPromise = new Promise<void>((resolve, reject) => {
    // Also add this initial resolver to the waiting list
    waitingResolvers.push({ resolve, reject });
    
    // Define a maximum wait time
    const maxWaitTime = 15000; // 15 seconds
    
    // Set timeout for the entire operation
    const timeoutId = setTimeout(() => {
      const error = new Error("Google Maps API load timeout after 15 seconds");
      isGoogleMapsLoaded = false;
      loadPromise = null;
      
      // Reject all waiting promises
      waitingResolvers.forEach(({reject}) => reject(error));
      waitingResolvers = [];
    }, maxWaitTime);
    
    /**
     * Helper function to check if Maps API is fully loaded
     * with all required services
     */
    const isFullyLoaded = () => {
      return window.google?.maps?.DirectionsService &&
        window.google?.maps?.Geocoder &&
        window.google?.maps?.places?.AutocompleteService &&
        window.google?.maps?.geometry?.spherical &&
        window.google?.maps?.geometry?.encoding;
    };
    
    /**
     * Function that runs when Maps is fully loaded
     */
    const onFullyLoaded = () => {
      console.log("Google Maps API fully loaded with all required services");
      clearTimeout(timeoutId);
      isGoogleMapsLoaded = true;
      loadPromise = null;
      
      // Resolve all waiting promises
      waitingResolvers.forEach(({resolve}) => resolve());
      waitingResolvers = [];
    };
    
    /**
     * Recursive polling function
     */
    const checkLoaded = (attemptCount = 0) => {
      // If fully loaded, resolve
      if (isFullyLoaded()) {
        onFullyLoaded();
        return;
      }
      
      // Check for Maps script tag
      const hasScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      
      // After 40 attempts (10 seconds) with script present but not loaded, give up
      if (hasScript && attemptCount > 40) {
        clearTimeout(timeoutId);
        const error = new Error("Google Maps API failed to initialize after multiple attempts");
        loadPromise = null;
        isGoogleMapsLoaded = false;
        
        // Reject all waiting promises
        waitingResolvers.forEach(({reject}) => reject(error));
        waitingResolvers = [];
        return;
      }
      
      // Continue checking if script exists but services aren't loaded yet
      if (hasScript) {
        setTimeout(() => checkLoaded(attemptCount + 1), 250);
      } else {
        // If script doesn't exist after a reasonable wait, give up
        if (attemptCount > 20) {
          clearTimeout(timeoutId);
          const error = new Error("Google Maps API script not found after 5 seconds");
          loadPromise = null;
          isGoogleMapsLoaded = false;
          
          // Reject all waiting promises
          waitingResolvers.forEach(({reject}) => reject(error));
          waitingResolvers = [];
          return;
        }
        
        // Continue checking for script
        setTimeout(() => checkLoaded(attemptCount + 1), 250);
      }
    };
    
    // Start checking
    checkLoaded();
  });
  
  return loadPromise;
};

/**
 * Handles errors from Google Maps operations with comprehensive retry logic
 * @param operation The operation function to perform
 * @param maxRetries Maximum number of retry attempts
 * @returns Promise resolving to the operation result
 */
export async function withMapsErrorHandling<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let retryCount = 0;
  
  while (true) {
    try {
      await ensureGoogleMapsLoaded();
      return await operation();
    } catch (error) {
      retryCount++;
      console.error(`Google Maps operation failed (attempt ${retryCount}):`, error);
      
      if (retryCount >= maxRetries) {
        throw error;
      }
      
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retryCount)));
      
      // Reset Google Maps loaded state for next retry
      isGoogleMapsLoaded = false;
      loadPromise = null;
    }
  }
}

/**
 * Creates a DirectionsService safely, ensuring the API is loaded first
 * @returns Promise resolving to a new DirectionsService
 */
export const createDirectionsService = async (): Promise<google.maps.DirectionsService> => {
  await ensureGoogleMapsLoaded();
  return new window.google.maps.DirectionsService();
};

/**
 * Creates a DirectionsRenderer safely, ensuring the API is loaded first
 * @param options DirectionsRendererOptions
 * @returns Promise resolving to a new DirectionsRenderer
 */
export const createDirectionsRenderer = async (
  options?: google.maps.DirectionsRendererOptions
): Promise<google.maps.DirectionsRenderer> => {
  await ensureGoogleMapsLoaded();
  return new window.google.maps.DirectionsRenderer(options);
};

/**
 * Creates a Geocoder safely, ensuring the API is loaded first
 * @returns Promise resolving to a new Geocoder
 */
export const createGeocoder = async (): Promise<google.maps.Geocoder> => {
  await ensureGoogleMapsLoaded();
  return new window.google.maps.Geocoder();
};

/**
 * Creates an AutocompleteService safely, ensuring the API is loaded first
 * @returns Promise resolving to a new AutocompleteService
 */
export const createAutocompleteService = async (): Promise<google.maps.places.AutocompleteService> => {
  await ensureGoogleMapsLoaded();
  return new window.google.maps.places.AutocompleteService();
};

/**
 * Safely route between two points with Google Maps DirectionsService
 * @param origin Starting location
 * @param destination Ending location
 * @param options Additional routing options
 * @returns Promise with directions result
 */
export const getDirections = async (
  origin: google.maps.LatLngLiteral | string,
  destination: google.maps.LatLngLiteral | string,
  options: Partial<google.maps.DirectionsRequest> = {}
): Promise<google.maps.DirectionsResult> => {
  return withMapsErrorHandling(async () => {
    const directionsService = await createDirectionsService();
    
    return new Promise((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          ...options,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        }
      );
    });
  });
};

/**
 * Safely get walking directions between two points
 * @param origin Starting location
 * @param destination Ending location
 * @param options Additional routing options
 * @returns Promise with walking directions result
 */
export const getWalkingDirections = async (
  origin: google.maps.LatLngLiteral | string,
  destination: google.maps.LatLngLiteral | string,
  options: Partial<google.maps.DirectionsRequest> = {}
): Promise<google.maps.DirectionsResult> => {
  return withMapsErrorHandling(async () => {
    const directionsService = await createDirectionsService();
    
    return new Promise((resolve, reject) => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.WALKING,
          ...options,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Walking directions request failed: ${status}`));
          }
        }
      );
    });
  });
};

/**
 * Throttled function to calculate distance between two points
 * Only executes at most once every 100ms to prevent excessive calculations
 */
export const calculateDistanceThrottled = throttle(
  (origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral): number => {
    if (!window.google?.maps?.geometry?.spherical) {
      return 0;
    }
    
    return window.google.maps.geometry.spherical.computeDistanceBetween(
      new window.google.maps.LatLng(origin.lat, origin.lng),
      new window.google.maps.LatLng(destination.lat, destination.lng)
    );
  },
  100, // Run at most once every 100ms
  { leading: true, trailing: true }
);
