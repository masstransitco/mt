import { useCallback, useEffect, useRef, useMemo } from "react";
import { useAppSelector } from "@/store/store";
import { selectWalkingRoute } from "@/store/userSlice";

/**
 * Custom hook to manage walking route polyline on the map
 * Optimized to prevent unnecessary renders and style updates
 */
export function useWalkingRouteOverlay(
  googleMap: google.maps.Map | null,
  options: {
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    zIndex?: number;
    geodesic?: boolean;
  } = {}
) {
  // Default options with sensible values for a walking route
  const {
    strokeColor = "#4285F4", // Google blue
    strokeOpacity = 0.8,
    strokeWeight = 4,
    zIndex = 5,
    geodesic = true,
  } = options;

  // Get walking route from Redux
  const walkingRoute = useAppSelector(selectWalkingRoute);
  
  // Cache the polyline string for comparison
  const prevPolylineRef = useRef<string | null>(null);
  
  // Polyline reference
  const walkingRouteRef = useRef<google.maps.Polyline | null>(null);
  
  // Define type for polyline options
  interface PolylineOptions {
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    zIndex: number;
    geodesic: boolean;
  }

  // Previous options reference to avoid unnecessary style updates
  const prevOptionsRef = useRef<PolylineOptions>({
    strokeColor: "",
    strokeOpacity: 0,
    strokeWeight: 0,
    zIndex: 0,
    geodesic: false,
  });
  
  // Memoize style options to prevent unnecessary updates
  const polylineOptions = useMemo<PolylineOptions>(() => ({
    strokeColor,
    strokeOpacity,
    strokeWeight,
    zIndex,
    geodesic,
  }), [strokeColor, strokeOpacity, strokeWeight, zIndex, geodesic]);

  /**
   * Update the walking route polyline - optimized to minimize redraws
   */
  const updateWalkingRoutePolyline = useCallback(() => {
    if (!googleMap || !window.google?.maps?.geometry?.encoding) return;

    const hasRoute = walkingRoute && walkingRoute.polyline;
    const currentPolyline = hasRoute ? walkingRoute.polyline : null;
    
    // Quick return if polyline hasn't changed and we already have a route reference
    if (
      currentPolyline === prevPolylineRef.current && 
      walkingRouteRef.current?.getMap() === googleMap
    ) {
      // Only update options if they've changed
      const hasStyleChanged = Object.keys(polylineOptions).some(
        (key) => {
          const typedKey = key as keyof PolylineOptions;
          return prevOptionsRef.current[typedKey] !== polylineOptions[typedKey];
        }
      );
      
      if (hasStyleChanged && walkingRouteRef.current) {
        walkingRouteRef.current.setOptions(polylineOptions);
        prevOptionsRef.current = {...polylineOptions};
      }
      
      return;
    }
    
    // Update the stored polyline reference
    prevPolylineRef.current = currentPolyline;

    if (hasRoute && currentPolyline) {
      try {
        // Decode the polyline to get path
        const path = window.google.maps.geometry.encoding.decodePath(currentPolyline);
        
        if (path.length === 0) return;
        
        if (!walkingRouteRef.current) {
          // Create new polyline - combine path and options into one constructor call
          walkingRouteRef.current = new google.maps.Polyline({
            path,
            map: googleMap,
            ...polylineOptions
          });
          
          // Store initial options for future comparison
          prevOptionsRef.current = {...polylineOptions};
        } else {
          // Update existing polyline
          walkingRouteRef.current.setPath(path);
          
          // Only update style options if they've changed
          const hasStyleChanged = Object.keys(polylineOptions).some(
            (key) => {
              const typedKey = key as keyof PolylineOptions;
              return prevOptionsRef.current[typedKey] !== polylineOptions[typedKey];
            }
          );
          
          if (hasStyleChanged) {
            walkingRouteRef.current.setOptions(polylineOptions);
            prevOptionsRef.current = {...polylineOptions};
          }
          
          // Make sure it's visible on the map
          if (walkingRouteRef.current.getMap() !== googleMap) {
            walkingRouteRef.current.setMap(googleMap);
          }
        }
      } catch (error) {
        console.error("Error updating walking route:", error);
      }
    } else {
      // Hide polyline if no route
      if (walkingRouteRef.current && walkingRouteRef.current.getMap()) {
        walkingRouteRef.current.setMap(null);
      }
    }
  }, [googleMap, walkingRoute, polylineOptions]);

  // Single unified effect for all dependency changes
  useEffect(() => {
    if (!googleMap) return;
    
    updateWalkingRoutePolyline();
    
    // Cleanup function
    return () => {
      if (walkingRouteRef.current) {
        walkingRouteRef.current.setMap(null);
        walkingRouteRef.current = null;
      }
      prevPolylineRef.current = null;
      prevOptionsRef.current = {
        strokeColor: "",
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 0,
        geodesic: false
      };
    };
  }, [googleMap, walkingRoute, updateWalkingRoutePolyline]);

  return {
    walkingRouteRef,
    updateWalkingRoutePolyline,
  };
}