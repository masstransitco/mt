import { useCallback, useEffect, useRef } from "react";
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
}

/**
 * Custom hook to manage location circles for user location and search location
 * following the same lifecycle as Google Maps WebGL overlays
 */
export function useCircleOverlay(
  googleMap: google.maps.Map | null,
  options: UseCircleOverlayOptions = {}
) {
  // Default options with sensible values
  const {
    userCircleColor = "#10A37F", // Green color for user location
    userCircleOpacity = 0.2,
    userCircleRadius = 100, // 100 meters
    searchCircleColor = "#276EF1", // Blue color for search location
    searchCircleOpacity = 0.15,
    searchCircleRadius = 150, // 150 meters
    onUserCircleClick,
    onSearchCircleClick,
  } = options;

  // Redux location states
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  // Circle references
  const userCircleRef = useRef<GoogleCircle | null>(null);
  const searchCircleRef = useRef<GoogleCircle | null>(null);

  // Reference to track previous values for optimizing updates
  const prevLocationsRef = useRef<{
    userLocation: google.maps.LatLngLiteral | null;
    searchLocation: google.maps.LatLngLiteral | null;
  }>({
    userLocation: null,
    searchLocation: null,
  });

  /**
   * Create or update user location circle
   * Following the same pattern as our Three.js models - update properties first,
   * only update visibility at the end
   */
  const updateUserLocationCircle = useCallback(() => {
    if (!googleMap) return;

    const hasValidLocation =
      userLocation &&
      typeof userLocation.lat === "number" &&
      typeof userLocation.lng === "number";

    // Update or create circle
    if (hasValidLocation) {
      if (!userCircleRef.current) {
        // Create new circle if it doesn't exist
        userCircleRef.current = new google.maps.Circle({
          strokeColor: userCircleColor,
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: userCircleColor,
          fillOpacity: userCircleOpacity,
          map: googleMap,
          center: userLocation,
          radius: userCircleRadius,
          clickable: !!onUserCircleClick,
          zIndex: 1, // Below search circle
        });

        // Add click handler if provided
        if (onUserCircleClick) {
          userCircleRef.current.addListener("click", onUserCircleClick);
        }
      } else {
        // Update existing circle properties
        // Only update center if location has changed
        if (
          !prevLocationsRef.current.userLocation ||
          prevLocationsRef.current.userLocation.lat !== userLocation.lat ||
          prevLocationsRef.current.userLocation.lng !== userLocation.lng
        ) {
          userCircleRef.current.setCenter(userLocation);
        }

        // Ensure the circle is on the map - similar to setting visible=true
        if (!userCircleRef.current.getMap()) {
          userCircleRef.current.setMap(googleMap);
        }
      }

      // Save current location for future comparison
      prevLocationsRef.current.userLocation = { ...userLocation };
    } else {
      // Hide circle if no valid location - similar to setting visible=false
      if (userCircleRef.current && userCircleRef.current.getMap()) {
        userCircleRef.current.setMap(null);
      }
    }
  }, [
    googleMap,
    userLocation,
    userCircleColor,
    userCircleOpacity,
    userCircleRadius,
    onUserCircleClick,
  ]);

  /**
   * Create or update search location circle
   * Following the same pattern as our Three.js models - update properties first,
   * only update visibility at the end
   */
  const updateSearchLocationCircle = useCallback(() => {
    if (!googleMap) return;

    const hasValidLocation =
      searchLocation &&
      typeof searchLocation.lat === "number" &&
      typeof searchLocation.lng === "number";

    // Update or create circle
    if (hasValidLocation) {
      if (!searchCircleRef.current) {
        // Create new circle if it doesn't exist
        searchCircleRef.current = new google.maps.Circle({
          strokeColor: searchCircleColor,
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: searchCircleColor,
          fillOpacity: searchCircleOpacity,
          map: googleMap,
          center: searchLocation,
          radius: searchCircleRadius,
          clickable: !!onSearchCircleClick,
          zIndex: 2, // Above user circle
        });

        // Add click handler if provided
        if (onSearchCircleClick) {
          searchCircleRef.current.addListener("click", onSearchCircleClick);
        }
      } else {
        // Update existing circle properties
        // Only update center if location has changed
        if (
          !prevLocationsRef.current.searchLocation ||
          prevLocationsRef.current.searchLocation.lat !== searchLocation.lat ||
          prevLocationsRef.current.searchLocation.lng !== searchLocation.lng
        ) {
          searchCircleRef.current.setCenter(searchLocation);
        }

        // Ensure the circle is on the map - similar to setting visible=true
        if (!searchCircleRef.current.getMap()) {
          searchCircleRef.current.setMap(googleMap);
        }
      }

      // Save current location for future comparison
      prevLocationsRef.current.searchLocation = { ...searchLocation };
    } else {
      // Hide circle if no valid location - similar to setting visible=false
      if (searchCircleRef.current && searchCircleRef.current.getMap()) {
        searchCircleRef.current.setMap(null);
      }
    }
  }, [
    googleMap,
    searchLocation,
    searchCircleColor,
    searchCircleOpacity,
    searchCircleRadius,
    onSearchCircleClick,
  ]);

  // Update circles when map or options change
  useEffect(() => {
    if (!googleMap) return;

    // Update circles with current locations
    updateUserLocationCircle();
    updateSearchLocationCircle();

    // Cleanup function - similar to our other overlay hooks
    return () => {
      if (userCircleRef.current) {
        // If we need a fade-out animation, we would implement it here
        // For now, just remove from map
        userCircleRef.current.setMap(null);
        // Clean up event listeners
        if (onUserCircleClick) {
          google.maps.event.clearListeners(userCircleRef.current, "click");
        }
        userCircleRef.current = null;
      }

      if (searchCircleRef.current) {
        searchCircleRef.current.setMap(null);
        if (onSearchCircleClick) {
          google.maps.event.clearListeners(searchCircleRef.current, "click");
        }
        searchCircleRef.current = null;
      }
    };
  }, [
    googleMap,
    updateUserLocationCircle,
    updateSearchLocationCircle,
    onUserCircleClick,
    onSearchCircleClick,
  ]);

  // React to location changes
  useEffect(() => {
    updateUserLocationCircle();
  }, [userLocation, updateUserLocationCircle]);

  useEffect(() => {
    updateSearchLocationCircle();
  }, [searchLocation, updateSearchLocationCircle]);

  // Return methods to manually update circles from outside
  return {
    userCircleRef,
    searchCircleRef,
    updateUserLocationCircle,
    updateSearchLocationCircle,
  };
}