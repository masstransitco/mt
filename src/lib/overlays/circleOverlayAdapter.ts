import { MapOverlay } from '@/lib/mapOverlayManager';

/**
 * Interface for circle overlay configuration
 */
export interface CircleOptions {
  /**
   * Color for the user location circle
   */
  userCircleColor?: string;
  
  /**
   * Radius of the user location circle in meters
   */
  userCircleRadius?: number;
  
  /**
   * Opacity of the user location circle (0-1)
   */
  userCircleOpacity?: number;
  
  /**
   * Color for the search location circle
   */
  searchCircleColor?: string;
  
  /**
   * Radius of the search location circle in meters
   */
  searchCircleRadius?: number;
  
  /**
   * Opacity of the search location circle (0-1)
   */
  searchCircleOpacity?: number;
}

/**
 * Create a circle overlay adapter that implements the MapOverlay interface
 * 
 * This overlay manages the user location and search location circles on the map.
 * 
 * @param options Options for the circle overlay
 * @returns MapOverlay implementation for circles
 */
export function createCircleOverlay(options: CircleOptions): MapOverlay {
  // Default options
  const defaultOptions: CircleOptions = {
    userCircleColor: "#10A37F",      // Green color for user location
    userCircleRadius: 80,            // 80 meters
    userCircleOpacity: 0.15,         // 15% opacity
    searchCircleColor: "#276EF1",    // Blue color for search location
    searchCircleRadius: 120,         // 120 meters
    searchCircleOpacity: 0.12,       // 12% opacity
  };
  
  // Merge with default options
  const customOptions: CircleOptions = {
    ...defaultOptions,
    ...options
  };
  
  // Private state
  let userCircle: google.maps.Circle | null = null;
  let searchCircle: google.maps.Circle | null = null;
  let mapInstance: google.maps.Map | null = null;
  let isVisible = true;
  
  /**
   * Create a circle on the map
   */
  function createCircle(options: google.maps.CircleOptions): google.maps.Circle {
    const circle = new google.maps.Circle({
      map: isVisible ? mapInstance : null,
      ...options
    });
    
    return circle;
  }
  
  /**
   * Initialize circles with current options
   */
  function initializeCircles(): void {
    if (!mapInstance) return;
    
    // Create user location circle if it doesn't exist
    if (!userCircle) {
      userCircle = createCircle({
        strokeColor: customOptions.userCircleColor || "#10A37F",
        strokeOpacity: 0.2,
        strokeWeight: 1,
        fillColor: customOptions.userCircleColor || "#10A37F",
        fillOpacity: customOptions.userCircleOpacity || 0.15,
        radius: customOptions.userCircleRadius || 80,
        zIndex: 3,
        clickable: false,
        visible: isVisible
      });
    }
    
    // Create search location circle if it doesn't exist
    if (!searchCircle) {
      searchCircle = createCircle({
        strokeColor: customOptions.searchCircleColor || "#276EF1",
        strokeOpacity: 0.2,
        strokeWeight: 1,
        fillColor: customOptions.searchCircleColor || "#276EF1",
        fillOpacity: customOptions.searchCircleOpacity || 0.12,
        radius: customOptions.searchCircleRadius || 120,
        zIndex: 2,
        clickable: false,
        visible: isVisible
      });
    }
  }
  
  /**
   * The MapOverlay implementation
   */
  return {
    type: 'circle',
    
    initialize(map: google.maps.Map) {
      console.log('[CircleOverlayAdapter] Initializing with map');
      mapInstance = map;
      initializeCircles();
    },
    
    update(newOptions: CircleOptions & { 
      userLocation?: google.maps.LatLngLiteral, 
      searchLocation?: google.maps.LatLngLiteral 
    }) {
      console.log('[CircleOverlayAdapter] Updating with new options');
      
      // Update options
      Object.assign(customOptions, newOptions);
      
      // Update user circle if it exists
      if (userCircle) {
        // Update position if provided
        if (newOptions.userLocation) {
          userCircle.setCenter(newOptions.userLocation);
          userCircle.setVisible(true); // Show when we have a location
        }
        
        // Update style options
        if (newOptions.userCircleColor) {
          userCircle.setOptions({
            strokeColor: newOptions.userCircleColor,
            fillColor: newOptions.userCircleColor
          });
        }
        
        if (newOptions.userCircleOpacity !== undefined) {
          userCircle.setOptions({
            fillOpacity: newOptions.userCircleOpacity
          });
        }
        
        if (newOptions.userCircleRadius !== undefined) {
          userCircle.setRadius(newOptions.userCircleRadius);
        }
      }
      
      // Update search circle if it exists
      if (searchCircle) {
        // Update position if provided
        if (newOptions.searchLocation) {
          searchCircle.setCenter(newOptions.searchLocation);
          searchCircle.setVisible(true); // Show when we have a location
        }
        
        // Update style options
        if (newOptions.searchCircleColor) {
          searchCircle.setOptions({
            strokeColor: newOptions.searchCircleColor,
            fillColor: newOptions.searchCircleColor
          });
        }
        
        if (newOptions.searchCircleOpacity !== undefined) {
          searchCircle.setOptions({
            fillOpacity: newOptions.searchCircleOpacity
          });
        }
        
        if (newOptions.searchCircleRadius !== undefined) {
          searchCircle.setRadius(newOptions.searchCircleRadius);
        }
      }
    },
    
    setVisible(visible: boolean) {
      console.log(`[CircleOverlayAdapter] Setting visibility: ${visible}`);
      isVisible = visible;
      
      // Update visibility of circles
      if (userCircle) {
        userCircle.setVisible(isVisible);
      }
      
      if (searchCircle) {
        searchCircle.setVisible(isVisible);
      }
    },
    
    dispose() {
      console.log('[CircleOverlayAdapter] Disposing');
      
      // Clean up user circle
      if (userCircle) {
        userCircle.setMap(null);
        userCircle = null;
      }
      
      // Clean up search circle
      if (searchCircle) {
        searchCircle.setMap(null);
        searchCircle = null;
      }
      
      // Reset map reference
      mapInstance = null;
    }
  };
}