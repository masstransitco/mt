import { MapOverlay } from '@/lib/mapOverlayManager';

/**
 * Interface for walking route overlay configuration
 */
export interface WalkingRouteOptions {
  /**
   * Color of the walking route line
   */
  strokeColor?: string;
  
  /**
   * Opacity of the walking route line (0-1)
   */
  strokeOpacity?: number;
  
  /**
   * Width of the walking route line in pixels
   */
  strokeWeight?: number;
  
  /**
   * Z-index of the walking route
   */
  zIndex?: number;
  
  /**
   * Whether the route line should have dots
   */
  strokeDashArray?: string;
}

/**
 * Create a walking route overlay adapter that implements the MapOverlay interface
 * 
 * This overlay draws a walking route polyline on the map.
 * 
 * @param options Options for the walking route overlay
 * @returns MapOverlay implementation for walking routes
 */
export function createWalkingRouteOverlay(options: WalkingRouteOptions): MapOverlay {
  // Default options
  const defaultOptions: WalkingRouteOptions = {
    strokeColor: "#4CAF50",  // Green color for walking
    strokeOpacity: 0.8,
    strokeWeight: 4,
    zIndex: 5,               // Above circles but below markers
  };
  
  // Merge with default options
  const customOptions: WalkingRouteOptions = {
    ...defaultOptions,
    ...options
  };
  
  // Private state
  let routePolyline: google.maps.Polyline | null = null;
  let mapInstance: google.maps.Map | null = null;
  let isVisible = true;
  
  /**
   * Create a polyline on the map
   */
  function createPolyline(options: google.maps.PolylineOptions): google.maps.Polyline {
    const polyline = new google.maps.Polyline({
      map: isVisible ? mapInstance : null,
      ...options
    });
    
    return polyline;
  }
  
  /**
   * Initialize polyline with current options
   */
  function initializePolyline(): void {
    if (!mapInstance) return;
    
    // Create route polyline if it doesn't exist
    if (!routePolyline) {
      routePolyline = createPolyline({
        strokeColor: customOptions.strokeColor,
        strokeOpacity: customOptions.strokeOpacity,
        strokeWeight: customOptions.strokeWeight,
        zIndex: customOptions.zIndex,
        visible: isVisible
      });
      
      // Apply dash array if specified
      if (customOptions.strokeDashArray) {
        // @ts-ignore - strokeDashArray is not in types but is supported
        routePolyline.setOptions({ strokeDashArray: customOptions.strokeDashArray });
      }
    }
  }
  
  /**
   * Update the route path
   */
  function updateRoutePath(path: google.maps.LatLngLiteral[]): void {
    if (!routePolyline) return;
    
    // Set the polyline path
    routePolyline.setPath(path);
    
    // Make visible if we have a path
    routePolyline.setVisible(isVisible && path.length > 0);
  }
  
  /**
   * The MapOverlay implementation
   */
  return {
    type: 'walking',
    
    initialize(map: google.maps.Map) {
      console.log('[WalkingRouteOverlayAdapter] Initializing with map');
      mapInstance = map;
      initializePolyline();
    },
    
    update(newOptions: WalkingRouteOptions & { 
      path?: google.maps.LatLngLiteral[] 
    }) {
      console.log('[WalkingRouteOverlayAdapter] Updating with new options');
      
      // Update options
      Object.assign(customOptions, newOptions);
      
      // Initialize polyline if needed
      if (!routePolyline && mapInstance) {
        initializePolyline();
      }
      
      // Update polyline if it exists
      if (routePolyline) {
        // Update style options
        routePolyline.setOptions({
          strokeColor: customOptions.strokeColor,
          strokeOpacity: customOptions.strokeOpacity,
          strokeWeight: customOptions.strokeWeight,
          zIndex: customOptions.zIndex
        });
        
        // Apply dash array if specified
        if (customOptions.strokeDashArray) {
          // @ts-ignore - strokeDashArray is not in types but is supported
          routePolyline.setOptions({ strokeDashArray: customOptions.strokeDashArray });
        }
        
        // Update path if provided
        if (newOptions.path) {
          updateRoutePath(newOptions.path);
        }
      }
    },
    
    setVisible(visible: boolean) {
      console.log(`[WalkingRouteOverlayAdapter] Setting visibility: ${visible}`);
      isVisible = visible;
      
      // Update visibility of polyline
      if (routePolyline) {
        routePolyline.setVisible(isVisible && routePolyline.getPath().getLength() > 0);
      }
    },
    
    dispose() {
      console.log('[WalkingRouteOverlayAdapter] Disposing');
      
      // Clean up route polyline
      if (routePolyline) {
        routePolyline.setMap(null);
        routePolyline = null;
      }
      
      // Reset map reference
      mapInstance = null;
    }
  };
}