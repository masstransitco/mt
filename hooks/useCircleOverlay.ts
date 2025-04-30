import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/store/store";
import { selectUserLocation, selectSearchLocation } from "@/store/userSlice";

type GoogleCircle = google.maps.Circle;

interface UseCircleOverlayOptions {
  userCircleColor?: string;
  userCircleOpacity?: number;
  userCircleRadius?: number;
  searchCircleColor?: string;
  searchCircleOpacity?: number;
  searchCircleRadius?: number;
  onUserCircleClick?: () => void;
  onSearchCircleClick?: () => void;
  animateAppearance?: boolean;
}

/**
 * Custom hook to manage a single circle location indicator
 * Simplified implementation with proper cleanup
 */
export function useCircleOverlay(
  googleMap: google.maps.Map | null,
  options: UseCircleOverlayOptions = {}
) {
  // Default options with sensible values
  const {
    userCircleColor = "#FFFFFF", // White color for location circle
    userCircleOpacity = 0.2,
    userCircleRadius = 100, // 100 meters
    searchCircleColor = "#FFFFFF", // Also white for search location
    searchCircleOpacity = 0.15,
    searchCircleRadius = 150, // 150 meters
    onUserCircleClick,
    onSearchCircleClick,
    animateAppearance = false, // Default to no animation for better performance
  } = options;

  // Redux location states
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  // Circle references
  const userCircleRef = useRef<GoogleCircle | null>(null);
  const searchCircleRef = useRef<GoogleCircle | null>(null);

  // Animation cleanup refs
  const userCircleAnimationFrameRef = useRef<number | null>(null);
  const searchCircleAnimationFrameRef = useRef<number | null>(null);

  /**
   * Create or update a location circle without animations
   */
  const updateLocationCircle = useCallback(
    (options: {
      circleRef: React.MutableRefObject<GoogleCircle | null>;
      location: google.maps.LatLngLiteral | null;
      circleColor: string;
      circleOpacity: number;
      circleRadius: number;
      onCircleClick?: () => void;
      zIndex: number;
    }) => {
      const {
        circleRef,
        location,
        circleColor,
        circleOpacity,
        circleRadius,
        onCircleClick,
        zIndex
      } = options;
      
      if (!googleMap) return;

      // Check if location is valid
      const hasValidLocation =
        location &&
        typeof location.lat === "number" &&
        typeof location.lng === "number";

      if (hasValidLocation) {
        // Location is valid, create or update circle
        if (!circleRef.current) {
          // Create new circle
          circleRef.current = new google.maps.Circle({
            strokeColor: circleColor,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: circleColor,
            fillOpacity: circleOpacity,
            map: googleMap,
            center: location,
            radius: circleRadius,
            clickable: !!onCircleClick,
            zIndex, 
          });

          // Add click handler if provided
          if (onCircleClick) {
            circleRef.current.addListener("click", onCircleClick);
          }
        } else {
          // Update existing circle
          circleRef.current.setCenter(location);
          
          // Make sure circle is visible
          if (circleRef.current.getMap() !== googleMap) {
            circleRef.current.setMap(googleMap);
          }
        }
      } else {
        // Hide circle if no valid location
        if (circleRef.current && circleRef.current.getMap()) {
          circleRef.current.setMap(null);
        }
      }
    },
    [googleMap]
  );

  /**
   * Update user location circle
   */
  const updateUserLocationCircle = useCallback(() => {
    updateLocationCircle({
      circleRef: userCircleRef,
      location: userLocation,
      circleColor: userCircleColor,
      circleOpacity: userCircleOpacity,
      circleRadius: userCircleRadius,
      onCircleClick: onUserCircleClick,
      zIndex: 1
    });
  }, [
    updateLocationCircle,
    userLocation,
    userCircleColor,
    userCircleOpacity,
    userCircleRadius,
    onUserCircleClick,
  ]);

  /**
   * Update search location circle
   */
  const updateSearchLocationCircle = useCallback(() => {
    updateLocationCircle({
      circleRef: searchCircleRef,
      location: searchLocation,
      circleColor: searchCircleColor,
      circleOpacity: searchCircleOpacity,
      circleRadius: searchCircleRadius,
      onCircleClick: onSearchCircleClick,
      zIndex: 2
    });
  }, [
    updateLocationCircle,
    searchLocation,
    searchCircleColor,
    searchCircleOpacity,
    searchCircleRadius,
    onSearchCircleClick,
  ]);

  // Initialize and update circles when map or options change
  useEffect(() => {
    if (!googleMap) return;

    // Update circles with current locations
    updateUserLocationCircle();
    updateSearchLocationCircle();

    // Cleanup function
    return () => {
      // Cancel any animations (in case they were running)
      if (userCircleAnimationFrameRef.current) {
        cancelAnimationFrame(userCircleAnimationFrameRef.current);
        userCircleAnimationFrameRef.current = null;
      }
      
      if (searchCircleAnimationFrameRef.current) {
        cancelAnimationFrame(searchCircleAnimationFrameRef.current);
        searchCircleAnimationFrameRef.current = null;
      }
      
      // Properly dispose circles
      if (userCircleRef.current) {
        google.maps.event.clearInstanceListeners(userCircleRef.current);
        userCircleRef.current.setMap(null);
        userCircleRef.current = null;
      }

      if (searchCircleRef.current) {
        google.maps.event.clearInstanceListeners(searchCircleRef.current);
        searchCircleRef.current.setMap(null);
        searchCircleRef.current = null;
      }
    };
  }, [
    googleMap,
    updateUserLocationCircle,
    updateSearchLocationCircle,
  ]);

  // React to location changes
  useEffect(() => {
    if (googleMap) {
      updateUserLocationCircle();
    }
  }, [googleMap, userLocation, updateUserLocationCircle]);

  useEffect(() => {
    if (googleMap) {
      updateSearchLocationCircle();
    }
  }, [googleMap, searchLocation, updateSearchLocationCircle]);

  // Return references and methods for external control
  return {
    userCircleRef,
    searchCircleRef,
    dispose: useCallback(() => {
      // Manually dispose circle overlays
      if (userCircleRef.current) {
        google.maps.event.clearInstanceListeners(userCircleRef.current);
        userCircleRef.current.setMap(null);
        userCircleRef.current = null;
      }

      if (searchCircleRef.current) {
        google.maps.event.clearInstanceListeners(searchCircleRef.current);
        searchCircleRef.current.setMap(null);
        searchCircleRef.current = null;
      }
      
      if (userCircleAnimationFrameRef.current) {
        cancelAnimationFrame(userCircleAnimationFrameRef.current);
        userCircleAnimationFrameRef.current = null;
      }
      
      if (searchCircleAnimationFrameRef.current) {
        cancelAnimationFrame(searchCircleAnimationFrameRef.current);
        searchCircleAnimationFrameRef.current = null;
      }
    }, [])
  };
}