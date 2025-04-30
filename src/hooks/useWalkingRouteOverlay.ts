import { useCallback, useEffect, useRef, useMemo } from "react";
import { useAppSelector } from "@/store/store";
import { selectWalkingRoute } from "@/store/userSlice";

/**
 * Custom hook to manage walking route polyline on the map
 * Simplified without animations for better performance and disposal
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
  // Get walking route from Redux
  const walkingRoute = useAppSelector(selectWalkingRoute);
  
  // Store reference to polyline object
  const walkingRouteRef = useRef<google.maps.Polyline | null>(null);
  
  // Store animation frame for cleanup
  const animationFrameRef = useRef<number | null>(null);
  
  // Merge default options with user-provided options
  const polylineOptions = useMemo(
    () => ({
      strokeColor: options.strokeColor || "#4CAF50",
      strokeOpacity: options.strokeOpacity || 0.8,
      strokeWeight: options.strokeWeight || 4,
      zIndex: options.zIndex || 5,
      geodesic: options.geodesic !== undefined ? options.geodesic : true,
    }),
    [
      options.strokeColor,
      options.strokeOpacity,
      options.strokeWeight,
      options.zIndex,
      options.geodesic,
    ]
  );

  // Update polyline when walking route changes
  useEffect(() => {
    if (!googleMap) return;

    try {
      if (walkingRoute) {
        // Create path from encoded polyline
        let path: google.maps.LatLngLiteral[] = [];
        
        try {
          // Check if we have a polyline string directly (our structure)
          if (walkingRoute.polyline) {
            if (window.google?.maps?.geometry?.encoding) {
              path = window.google.maps.geometry.encoding
                .decodePath(walkingRoute.polyline)
                .map((latLng: google.maps.LatLng) => latLng.toJSON());
            }
          } 
          // Fallback check for Google API format (handle as any for compatibility)
          else if ((walkingRoute as any).routes?.[0]?.overview_polyline?.points) {
            const encoded = (walkingRoute as any).routes[0].overview_polyline.points;
            
            if (window.google?.maps?.geometry?.encoding) {
              path = window.google.maps.geometry.encoding
                .decodePath(encoded)
                .map((latLng: google.maps.LatLng) => latLng.toJSON());
            }
          }
        } catch (error) {
          console.error("Error decoding polyline:", error);
        }
        
        // Debug
        console.log("Walking route path length:", path.length);
        
        if (path.length > 0) {
          // Create polyline if it doesn't exist
          if (!walkingRouteRef.current) {
            walkingRouteRef.current = new google.maps.Polyline({
              ...polylineOptions,
              path,
              map: googleMap,
            });
            console.log("Created new walking route polyline");
          } else {
            // Update existing polyline
            walkingRouteRef.current.setPath(path);
            walkingRouteRef.current.setOptions(polylineOptions);
            
            // Make sure it's visible on the map
            if (walkingRouteRef.current.getMap() !== googleMap) {
              walkingRouteRef.current.setMap(googleMap);
              console.log("Updated existing walking route polyline");
            }
          }
        } else {
          console.log("No valid path found in walking route");
        }
      } else {
        // Hide polyline if no route
        if (walkingRouteRef.current && walkingRouteRef.current.getMap()) {
          walkingRouteRef.current.setMap(null);
          console.log("Removed walking route polyline (no route)");
        }
      }
    } catch (error) {
      console.error("Error updating walking route:", error);
    }
  }, [googleMap, walkingRoute, polylineOptions]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any active animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Remove polyline
      if (walkingRouteRef.current) {
        walkingRouteRef.current.setMap(null);
        walkingRouteRef.current = null;
      }
    };
  }, []);
  
  // Provide a way to manually dispose the polyline
  const dispose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (walkingRouteRef.current) {
      walkingRouteRef.current.setMap(null);
      walkingRouteRef.current = null;
    }
  }, []);
  
  return {
    walkingRouteRef,
    dispose
  };
}