// lib/googleMaps.ts

/**
 * Utility for safely loading and using Google Maps services
 */

// Track the loading state
let isGoogleMapsLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Ensures the Google Maps API is fully loaded before using its services
 * @returns Promise that resolves when Google Maps is ready
 */
export const ensureGoogleMapsLoaded = (): Promise<void> => {
  // Return existing promise if already loading
  if (loadPromise) return loadPromise;
  
  // If already loaded, return resolved promise
  if (isGoogleMapsLoaded && window.google?.maps) {
    return Promise.resolve();
  }
  
  // Start loading
  loadPromise = new Promise<void>((resolve, reject) => {
    // Check if API is already loaded
    if (window.google?.maps?.DirectionsService) {
      isGoogleMapsLoaded = true;
      resolve();
      return;
    }

    // Define a timeout for load failures
    const timeoutId = setTimeout(() => {
      reject(new Error("Google Maps API load timeout"));
    }, 10000);

    // Check for Maps loading at intervals
    const checkLoaded = () => {
      if (window.google?.maps?.DirectionsService) {
        clearTimeout(timeoutId);
        isGoogleMapsLoaded = true;
        resolve();
      } else if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        // Script exists but not loaded yet, wait a bit more
        setTimeout(checkLoaded, 100);
      } else {
        // Script doesn't exist at all
        clearTimeout(timeoutId);
        reject(new Error("Google Maps API script not found"));
      }
    };

    // Start checking
    checkLoaded();
  });
  
  return loadPromise;
};

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
};
