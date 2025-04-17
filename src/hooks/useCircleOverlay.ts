import { useCallback, useEffect, useRef } from "react";
import { useAppSelector } from "@/store/store";
import { selectUserLocation, selectSearchLocation } from "@/store/userSlice";
import animationStateManager, { AnimationType, AnimationPriority } from "@/lib/animationStateManager";
import { useAnimationState } from "@/hooks/useAnimationState";

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
 * Custom hook to manage location circles for user location and search location
 * following the same lifecycle as Google Maps WebGL overlays
 * Now integrated with the animation state manager
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
    animateAppearance = true,
  } = options;

  // Redux location states
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  // Circle references
  const userCircleRef = useRef<GoogleCircle | null>(null);
  const searchCircleRef = useRef<GoogleCircle | null>(null);

  // Animation IDs for tracking
  const userCircleAnimationIdRef = useRef<string | null>(null);
  const searchCircleAnimationIdRef = useRef<string | null>(null);

  // Reference to track previous values for optimizing updates
  const prevLocationsRef = useRef<{
    userLocation: google.maps.LatLngLiteral | null;
    searchLocation: google.maps.LatLngLiteral | null;
  }>({
    userLocation: null,
    searchLocation: null,
  });

  /**
   * Create, update or animate a location circle
   * Shared implementation for both user and search circles
   */
  const updateLocationCircle = useCallback(
    (options: {
      circleRef: React.MutableRefObject<GoogleCircle | null>;
      location: google.maps.LatLngLiteral | null;
      prevLocation: google.maps.LatLngLiteral | null;
      animationIdRef: React.MutableRefObject<string | null>;
      circleColor: string;
      circleOpacity: number;
      circleRadius: number;
      onCircleClick?: () => void;
      targetId: string;
      zIndex: number;
    }) => {
      const {
        circleRef,
        location,
        prevLocation,
        animationIdRef,
        circleColor,
        circleOpacity,
        circleRadius,
        onCircleClick,
        targetId,
        zIndex
      } = options;
      
      if (!googleMap) return;

      // Check if location is valid
      const hasValidLocation =
        location &&
        typeof location.lat === "number" &&
        typeof location.lng === "number";

      // Cancel any existing animation
      if (animationIdRef.current) {
        animationStateManager.cancelAnimation(animationIdRef.current);
        animationIdRef.current = null;
      }

      // Update or create circle
      if (hasValidLocation) {
        const isNewCircle = !circleRef.current;
        const locationChanged = prevLocation && 
          (prevLocation.lat !== location.lat ||
           prevLocation.lng !== location.lng);

        if (isNewCircle) {
          // Create new circle if it doesn't exist
          circleRef.current = new google.maps.Circle({
            strokeColor: circleColor,
            strokeOpacity: 0,  // Start invisible for animation
            strokeWeight: 2,
            fillColor: circleColor,
            fillOpacity: 0,    // Start invisible for animation
            map: googleMap,
            center: location,
            radius: circleRadius * 0.3,  // Start smaller for animation
            clickable: !!onCircleClick,
            zIndex, 
          });

          // Add click handler if provided
          if (onCircleClick) {
            circleRef.current.addListener("click", onCircleClick);
          }

          // Animate the circle appearance if enabled
          if (animateAppearance) {
            animationIdRef.current = animationStateManager.startAnimation({
              type: 'MARKER_ANIMATION',
              targetId: `${targetId}_appear`,
              duration: 800,
              priority: AnimationPriority.MEDIUM,
              isBlocking: false,
              onProgress: (progress) => {
                if (!circleRef.current) return;
                
                // Grow radius and fade in opacity
                const radius = circleRadius * (0.3 + (0.7 * progress));
                const opacity = circleOpacity * progress;
                const strokeOpacity = 0.6 * progress;
                
                circleRef.current.setRadius(radius);
                circleRef.current.setOptions({
                  fillOpacity: opacity,
                  strokeOpacity: strokeOpacity
                });
              },
              onComplete: () => {
                if (!circleRef.current) return;
                
                // Ensure final values are set
                circleRef.current.setRadius(circleRadius);
                circleRef.current.setOptions({
                  fillOpacity: circleOpacity,
                  strokeOpacity: 0.6
                });
                
                animationIdRef.current = null;
              }
            });
          } else {
            // Set final values immediately if animation is disabled
            circleRef.current.setRadius(circleRadius);
            circleRef.current.setOptions({
              fillOpacity: circleOpacity,
              strokeOpacity: 0.6
            });
          }
        } else if (locationChanged) {
          // If location changed, animate the transition
          const previousLocation = prevLocation!;
          
          animationIdRef.current = animationStateManager.startAnimation({
            type: 'MARKER_ANIMATION',
            targetId: `${targetId}_move`,
            duration: 500,
            priority: AnimationPriority.LOW,
            isBlocking: false,
            onProgress: (progress) => {
              if (!circleRef.current) return;
              
              // Use animationStateManager's lerpLatLng utility
              const interpolated = animationStateManager.lerpLatLng(
                previousLocation,
                location,
                progress
              );
              
              circleRef.current.setCenter(interpolated);
            },
            onComplete: () => {
              if (!circleRef.current) return;
              circleRef.current.setCenter(location);
              animationIdRef.current = null;
            }
          });
        } else {
          // Make sure circle is visible on map
          if (circleRef.current && !circleRef.current.getMap()) {
            circleRef.current.setMap(googleMap);
            circleRef.current.setOptions({
              fillOpacity: circleOpacity,
              strokeOpacity: 0.6
            });
            circleRef.current.setRadius(circleRadius);
          }
        }

        return { ...location };
      } else {
        // Hide circle if no valid location
        if (circleRef.current && circleRef.current.getMap()) {
          if (animateAppearance) {
            // Animate the fade out
            animationIdRef.current = animationStateManager.startAnimation({
              type: 'MARKER_ANIMATION',
              targetId: `${targetId}_fadeout`,
              duration: 400,
              priority: AnimationPriority.LOW,
              isBlocking: false,
              onProgress: (progress) => {
                if (!circleRef.current) return;
                
                // Shrink radius and fade out opacity
                const reverseProgress = 1 - progress;
                const radius = circleRadius * (0.3 + (0.7 * reverseProgress));
                const opacity = circleOpacity * reverseProgress;
                const strokeOpacity = 0.6 * reverseProgress;
                
                circleRef.current.setRadius(radius);
                circleRef.current.setOptions({
                  fillOpacity: opacity,
                  strokeOpacity: strokeOpacity
                });
              },
              onComplete: () => {
                if (circleRef.current) {
                  circleRef.current.setMap(null);
                }
                animationIdRef.current = null;
              }
            });
          } else {
            // Remove from map immediately if animation is disabled
            circleRef.current.setMap(null);
          }
        }
        
        return null;
      }
    },
    [googleMap, animateAppearance]
  );

  /**
   * Update user location circle - uses shared implementation
   */
  const updateUserLocationCircle = useCallback(() => {
    const newLocation = updateLocationCircle({
      circleRef: userCircleRef,
      location: userLocation,
      prevLocation: prevLocationsRef.current.userLocation,
      animationIdRef: userCircleAnimationIdRef,
      circleColor: userCircleColor,
      circleOpacity: userCircleOpacity,
      circleRadius: userCircleRadius,
      onCircleClick: onUserCircleClick,
      targetId: 'user_circle',
      zIndex: 1
    });
    
    if (newLocation) {
      prevLocationsRef.current.userLocation = newLocation;
    }
  }, [
    updateLocationCircle,
    userLocation,
    userCircleColor,
    userCircleOpacity,
    userCircleRadius,
    onUserCircleClick,
  ]);

  /**
   * Update search location circle - uses shared implementation
   */
  const updateSearchLocationCircle = useCallback(() => {
    const newLocation = updateLocationCircle({
      circleRef: searchCircleRef,
      location: searchLocation,
      prevLocation: prevLocationsRef.current.searchLocation,
      animationIdRef: searchCircleAnimationIdRef,
      circleColor: searchCircleColor,
      circleOpacity: searchCircleOpacity,
      circleRadius: searchCircleRadius,
      onCircleClick: onSearchCircleClick,
      targetId: 'search_circle',
      zIndex: 2
    });
    
    if (newLocation) {
      prevLocationsRef.current.searchLocation = newLocation;
    }
  }, [
    updateLocationCircle,
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

    // Cleanup function
    return () => {
      // Cancel any active animations
      if (userCircleAnimationIdRef.current) {
        animationStateManager.cancelAnimation(userCircleAnimationIdRef.current);
      }
      
      if (searchCircleAnimationIdRef.current) {
        animationStateManager.cancelAnimation(searchCircleAnimationIdRef.current);
      }
      
      if (userCircleRef.current) {
        userCircleRef.current.setMap(null);
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

  // React to location changes - only if no blocking animations are running
  useEffect(() => {
    if (!animationStateManager.isUIBlocked()) {
      updateUserLocationCircle();
    }
  }, [userLocation, updateUserLocationCircle]);

  useEffect(() => {
    if (!animationStateManager.isUIBlocked()) {
      updateSearchLocationCircle();
    }
  }, [searchLocation, updateSearchLocationCircle]);

  // Return methods and references
  return {
    userCircleRef,
    searchCircleRef,
    updateUserLocationCircle,
    updateSearchLocationCircle,
    isAnimating: () => !!(userCircleAnimationIdRef.current || searchCircleAnimationIdRef.current)
  };
}