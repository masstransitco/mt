import { useEffect, useRef, useCallback } from "react";
import { useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRouteDecoded,
} from "@/store/bookingSlice";
import {
  selectUserLocation,
  selectSearchLocation,
} from "@/store/userSlice";
import type { StationFeature } from "@/store/stationsSlice";
import { DEFAULT_CENTER } from "@/constants/map";
import animationStateManager, { AnimationType, AnimationPriority } from "@/lib/animationStateManager";
import { useAnimationState } from "@/hooks/useAnimationState";

/** Minimal interface */
interface UseSimpleCameraAnimationsOptions {
  map: google.maps.Map | null;
  stations: StationFeature[];
  onCameraChanged?: () => void; // optional callback after each camera move
}

export function useSimpleCameraAnimations({
  map,
  stations,
  onCameraChanged,
}: UseSimpleCameraAnimationsOptions) {
  // --- Redux states for booking flow ---
  const bookingStep = useAppSelector(selectBookingStep);
  const depId = useAppSelector(selectDepartureStationId);
  const arrId = useAppSelector(selectArrivalStationId);
  const routeCoords = useAppSelector(selectRouteDecoded);

  // --- Redux states for user location/search ---
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  // Track if user manually set a location
  const manualLocationRef = useRef(false);

  // Animation ID references for tracking animations
  const currentAnimationIdRef = useRef<string | null>(null);

  // -------------------------
  // On user/search location change, mark manual override
  // -------------------------
  useEffect(() => {
    if (searchLocation || userLocation) {
      manualLocationRef.current = true;
    }
  }, [searchLocation, userLocation]);

  // -------------------------
  // Helper: enable/disable user gestures
  // -------------------------
  const setUserGestureEnabled = useCallback(
    (enabled: boolean) => {
      if (!map) return;
      map.setOptions({
        disableDefaultUI: false,
        gestureHandling: enabled ? "auto" : "none",
        keyboardShortcuts: enabled,
      });
    },
    [map]
  );

  // -------------------------
  // Helper: get current camera state
  // -------------------------
  const getCurrentCameraState = useCallback(() => {
    // If no map is available, return default state
    if (!map) {
      return {
        center: DEFAULT_CENTER,
        zoom: 13,
        heading: 0,
        tilt: 0,
      };
    }
    
    // Get camera state directly from map
    const center = map.getCenter();
    return {
      center: center ? {
        lat: center.lat(),
        lng: center.lng(),
      } : DEFAULT_CENTER,
      zoom: map.getZoom() ?? 13,
      heading: map.getHeading() ?? 0,
      tilt: map.getTilt() ?? 0,
    };
  }, [map]);

  // -------------------------
  // We'll use the shared animation utility methods from animationStateManager
  // -------------------------

  // -------------------------
  // animateCameraTo: smoothly transition from current camera to a target
  // -------------------------
  const animateCameraTo = useCallback(
    (
      target: {
        center: google.maps.LatLngLiteral;
        zoom: number;
        tilt: number;
        heading: number;
      },
      durationMs = 1000, // 1s default
      onComplete?: () => void,
      animationType: AnimationType = 'CAMERA_CIRCLING',
      targetId: number | string | null = null,
      priority: AnimationPriority = AnimationPriority.MEDIUM,
      isBlocking: boolean = false
    ) => {
      if (!map) return;

      // Snapshot the current camera
      const start = getCurrentCameraState();
      const end = target;
      
      // Check if the camera position is already very close to the target
      const noChange = animationStateManager.isCameraEqual(start, end);
      
      // If we're already at the target position (or very close), just update state and return
      if (noChange) {
        // Just set camera directly without animation
        map.moveCamera(end);
        // Direct camera update is sufficient
        // Call callbacks
        onCameraChanged?.();
        onComplete?.();
        return;
      }

      // If we have a current animation, cancel it
      if (currentAnimationIdRef.current) {
        animationStateManager.cancelAnimation(currentAnimationIdRef.current);
        currentAnimationIdRef.current = null;
      }
      
      // Register the animation with the global animation state manager
      const animationId = animationStateManager.startAnimation({
        type: animationType,
        targetId,
        duration: durationMs,
        priority,
        isBlocking,
        canInterrupt: true,
        onProgress: (progress) => {
          if (!map) return;
          
          // Use animation manager's lerpCamera function
          const interpolated = animationStateManager.lerpCamera(start, end, progress);

          // Update camera position with interpolated values
          map.moveCamera(interpolated);
          
          // Call onCameraChanged only at key points to reduce unnecessary calls
          if (progress === 0 || progress >= 0.5 || progress === 1) {
            onCameraChanged?.();
          }
        },
        onComplete: () => {
          setUserGestureEnabled(true);
          currentAnimationIdRef.current = null;
          onComplete?.();
        }
      });
      
      // Store current animation ID for future reference
      currentAnimationIdRef.current = animationId;
      
      // Disable user gestures while animation is active
      setUserGestureEnabled(false);
    },
    [map, getCurrentCameraState, setUserGestureEnabled, onCameraChanged]
  );

  // -------------------------
  // Find a station by ID
  // -------------------------
  const findStation = useCallback(
    (stationId: number) => stations.find((s) => s.id === stationId),
    [stations]
  );

  /**
   * circleAroundStation
   * - Uses the updated animation system for smooth camera circling
   * - Centralizes animation state in the animationStateManager
   * - Proper priority and UI blocking for consistent UX
   */
  const circleAroundStation = useCallback(
    (stationId: number, onComplete?: () => void) => {
      if (!map) return;
      const station = findStation(stationId);
      if (!station) {
        onComplete?.();
        return;
      }
      const [lng, lat] = station.geometry.coordinates;

      // Phase 1: Move to station with animation manager
      const revolveStart = {
        center: { lat, lng },
        zoom: 17,
        heading: 0,
        tilt: 0,
      };

      // Register the camera movement in the animation system
      animateCameraTo(
        revolveStart, 
        800,
        () => {
          // Once we've moved to the station, start the circling animation
          const circleAnimationId = animationStateManager.startAnimation({
            type: 'CAMERA_CIRCLING',
            targetId: stationId,
            duration: 3700, // Slightly shorter for better UX
            priority: AnimationPriority.HIGH,
            isBlocking: true,
            onProgress: (progress) => {
              if (!map) return;
              
              // Calculate tilt and heading based on progress
              let tilt, heading;
              
              // First 30% of the animation: tilt up
              if (progress < 0.3) {
                const tiltProgress = progress / 0.3; // Normalize to 0-1 range
                tilt = tiltProgress * 67.5;
                heading = 0;
              } 
              // Remaining 70%: rotate around
              else {
                tilt = 67.5;
                const rotateProgress = (progress - 0.3) / 0.7; // Normalize to 0-1 range
                heading = rotateProgress * 180;
              }
              
              // Update camera
              map.moveCamera({
                center: revolveStart.center,
                zoom: revolveStart.zoom,
                tilt,
                heading,
              });
              
              // Call camera changed callback periodically
              if (progress === 0 || progress >= 0.3 || progress >= 0.6 || progress === 1) {
                onCameraChanged?.();
              }
            },
            onComplete: () => {
              setUserGestureEnabled(true);
              
              // The animation manager will handle button display timing
              onComplete?.();
            }
          });
        },
        'CAMERA_CIRCLING',
        stationId,
        AnimationPriority.HIGH,
        true
      );
    },
    [map, findStation, animateCameraTo, setUserGestureEnabled, onCameraChanged]
  );

  // -------------------------
  // Animate to route (fitBounds with enhanced view)
  // -------------------------
  const animateToRoute = useCallback(
    (points: Array<{ lat: number; lng: number }>) => {
      if (!map || points.length < 1) return;

      // Don't log in production to reduce overhead
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useCameraAnimation] Animating to route with ${points.length} points`);
      }
      
      // Sample points if there are too many to reduce computation
      const optimizedPoints = points.length > 20 
        ? [
            points[0],
            ...points.filter((_, i) => i % Math.ceil(points.length / 10) === 0),
            points[points.length - 1]
          ]
        : points;
      
      // For multiple points, first calculate the bounds to get center and appropriate zoom
      const bounds = new google.maps.LatLngBounds();
      optimizedPoints.forEach((pt) => bounds.extend(pt));
      
      // Calculate approximate center and zoom directly
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      
      // Manual center calculation
      const center = {
        lat: (ne.lat() + sw.lat()) / 2,
        lng: (ne.lng() + sw.lng()) / 2
      };
      
      // Approximate zoom calculation based on distance
      const latDistance = Math.abs(ne.lat() - sw.lat());
      const lngDistance = Math.abs(ne.lng() - sw.lng());
      const maxDistance = Math.max(latDistance, lngDistance * Math.cos(center.lat * Math.PI / 180));
      
      // Approximate zoom based on distance
      let estimatedZoom = Math.log2(360 / maxDistance);
      
      // Adjust zoom for better viewing - typically 1 level out
      const adjustedZoom = Math.max(Math.min(estimatedZoom - 1, 18), 10);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useCameraAnimation] Route animation: estimated zoom ${estimatedZoom.toFixed(2)}, adjusted to ${adjustedZoom}`);
      }
      
      // Use animation manager with the calculated center and zoom
      animateCameraTo(
        {
          center,
          zoom: adjustedZoom,
          tilt: 45, // 45-degree tilt for a perspective view
          heading: 0, // keep heading at 0 for consistent north orientation
        },
        1000,  // Slightly faster animation for better responsiveness
        () => {
          manualLocationRef.current = false;
        },
        'ROUTE_PREVIEW',
        null,
        AnimationPriority.MEDIUM,
        false
      );
    },
    [map, animateCameraTo]
  );

  // -------------------------
  // Animate to user/search location
  // Now using the animation manager
  // -------------------------
  const animateToLocation = useCallback(
    (loc: google.maps.LatLngLiteral, zoom = 15) => {
      if (!map) return;
      
      // Set manual location flag immediately to prevent other animations from overriding
      manualLocationRef.current = true;
      
      // Log that we're animating to a location
      console.log(`[useCameraAnimation] Animating to location: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}, zoom=${zoom}`);
      
      // We'll smoothly move from current to target (heading=0).
      const target = {
        center: loc,
        zoom,
        heading: 0,
        tilt: 20, // slight tilt for a nicer effect
      };
      
      // Use animation manager
      animateCameraTo(
        target,
        1000,
        undefined,
        'CAMERA_CIRCLING', // Reusing this type for simple camera movement
        null,
        AnimationPriority.MEDIUM,
        false
      );
    },
    [map, animateCameraTo]
  );

  // -------------------------
  // Reset to default view (animate from current)
  // -------------------------
  const resetView = useCallback(() => {
    if (!map) return;
    const target = {
      center: { ...DEFAULT_CENTER },
      zoom: 13,
      heading: 0,
      tilt: 0,
    };
    
    // Use animation manager with low priority
    animateCameraTo(
      target,
      1000,
      undefined,
      'CAMERA_CIRCLING',
      null,
      AnimationPriority.LOW,
      false
    );
  }, [map, animateCameraTo]);

  // -------------------------
  // Setup effect for subscribing to animation state changes
  // -------------------------
  useEffect(() => {
    // Subscribe to animation state changes to sync with camera controls
    const unsubscribe = animationStateManager.subscribe((state) => {
      // When there are no active animations, ensure user gestures are enabled
      if (!state.isAnimating && map) {
        setUserGestureEnabled(true);
      }
      
      // If there's a blocking animation, make sure user gestures are disabled
      if (state.activeAnimations.some(anim => anim.isBlocking) && map) {
        setUserGestureEnabled(false);
      }
    });
    
    return () => {
      unsubscribe();
      
      // Cancel any animations when component unmounts
      if (currentAnimationIdRef.current) {
        animationStateManager.cancelAnimation(currentAnimationIdRef.current);
      }
    };
  }, [map, setUserGestureEnabled]);

  // -------------------------
  // Main effect reacting to bookingStep
  // -------------------------
  useEffect(() => {
    // Don't trigger animations if animation manager is already animating
    if (!map || animationStateManager.getState().isAnimating) return;

    // 1) If no station at all & user not manually overriding => reset
    if (!depId && !arrId) {
      if (!manualLocationRef.current) {
        resetView();
      }
      return;
    }

    // 2) Steps 1 or 2 => revolve around departure
    if ((bookingStep === 1 || bookingStep === 2) && depId) {
      circleAroundStation(depId);
      return;
    }

    // 3) Step 3 => once user selects arrival, we skip revolve for arrival.
    //    Instead, we do a route fit. Also revert view if user transitions
    //    from step 2 → 3 without an arrival.
    if (bookingStep === 3) {
      // If both departure + arrival exist => fit them
      if (depId && arrId) {
        // Check if we have routeCoords first (this would be rare in step 3, but possible)
        if (routeCoords && routeCoords.length > 0) {
          console.log(`[useCameraAnimation] Step 3: Using decoded route polyline with ${routeCoords.length} points`);
          
          // Sample route for performance if needed
          const sampledRoute = routeCoords.length > 50 
            ? [
                routeCoords[0], // Always include start
                ...routeCoords.filter((_, i) => i % Math.floor(routeCoords.length / 10) === 0), // Sample middle points
                routeCoords[routeCoords.length - 1] // Always include end
              ]
            : routeCoords;
          
          animateToRoute(sampledRoute);
        } else {
          // Fallback to just fitting departure and arrival stations
          const depSt = findStation(depId);
          const arrSt = findStation(arrId);
          if (depSt && arrSt) {
            const [lng1, lat1] = depSt.geometry.coordinates;
            const [lng2, lat2] = arrSt.geometry.coordinates;
            
            console.log(`[useCameraAnimation] Step 3: Using station-based route visualization`);
            
            animateToRoute([
              { lat: lat1, lng: lng1 },
              { lat: lat2, lng: lng2 },
            ]);
          }
        }
      } else {
        // If arrival not chosen yet, we DON'T reset the view here
        // This allows search location updates in step 3 to take precedence
        // Note: searchLocation/userLocation effects now handle this case
        console.log('[useCameraAnimation] Step 3 without arrival: allowing search location update');
      }
      return;
    }

    // 4) Step 4 => show route if available
    if (bookingStep === 4 && depId && arrId) {
      // If routeCoords exist, use them for a more precise route visualization
      if (routeCoords && routeCoords.length > 0) {
        console.log(`[useCameraAnimation] Using decoded route polyline with ${routeCoords.length} points`);
        
        // Use the actual route coordinates for a more precise fit
        // For performance, we'll sample the route if it's very detailed
        const sampledRoute = routeCoords.length > 50 
          ? [
              routeCoords[0], // Always include start
              ...routeCoords.filter((_, i) => i % Math.floor(routeCoords.length / 10) === 0), // Sample middle points
              routeCoords[routeCoords.length - 1] // Always include end
            ]
          : routeCoords;
        
        animateToRoute(sampledRoute);
      } else {
        // Fallback to just fitting departure and arrival stations
        const depSt = findStation(depId);
        const arrSt = findStation(arrId);
        if (depSt && arrSt) {
          const [lng1, lat1] = depSt.geometry.coordinates;
          const [lng2, lat2] = arrSt.geometry.coordinates;
          
          console.log(`[useCameraAnimation] Falling back to station-based route visualization`);
          
          animateToRoute([
            { lat: lat1, lng: lng1 },
            { lat: lat2, lng: lng2 },
          ]);
        }
      }
    }
  }, [
    map,
    bookingStep,
    depId,
    arrId,
    routeCoords,
    circleAroundStation,
    resetView,
    animateToRoute,
    findStation,
  ]);

  // -------------------------
  // Watch for new search location => animate from current
  // -------------------------
  useEffect(() => {
    // Don't trigger if no location or animation manager is already busy with higher priority
    if (!searchLocation || animationStateManager.isUIBlocked()) return;
    
    // Only animate to search location if:
    // 1. We're in step 1 (selecting departure station)
    // 2. We're in step 3 (selecting arrival station) and NO arrival station is selected yet
    if (bookingStep === 1 || (bookingStep === 3 && !arrId)) {
      console.log(`[useCameraAnimation] Animating to search location in step ${bookingStep}`);
      animateToLocation(searchLocation, 15);
    } else {
      console.log(`[useCameraAnimation] Ignoring search location in step ${bookingStep} with arrId=${arrId}`);
    }
  }, [searchLocation, animateToLocation, bookingStep, arrId]);

  // -------------------------
  // Watch for new user location => animate from current
  // -------------------------
  useEffect(() => {
    // Don't trigger if no location or animation manager is already busy with higher priority
    if (!userLocation || animationStateManager.isUIBlocked()) return;
    
    // Only animate to user location if:
    // 1. We're in step 1 (selecting departure station)
    // 2. We're in step 3 (selecting arrival station) and NO arrival station is selected yet
    if (bookingStep === 1 || (bookingStep === 3 && !arrId)) {
      console.log(`[useCameraAnimation] Animating to user location in step ${bookingStep}`);
      animateToLocation(userLocation, 15);
    } else {
      console.log(`[useCameraAnimation] Ignoring user location in step ${bookingStep} with arrId=${arrId}`);
    }
  }, [userLocation, animateToLocation, bookingStep, arrId]);

  // -------------------------
  // Return any helpful references or methods
  // -------------------------
  return {
    resetView,
    flyToStation: (stationId: number, tilt = 45) => {
      const station = findStation(stationId);
      if (!map || !station) return;
      const [lng, lat] = station.geometry.coordinates;
      
      // Use animation manager with medium priority
      animateCameraTo(
        { center: { lat, lng }, zoom: 15, heading: 0, tilt },
        1000,
        () => {
          manualLocationRef.current = false;
        },
        'CAMERA_CIRCLING',
        stationId,
        AnimationPriority.MEDIUM,
        false
      );
    },
    circleAroundStation,
    animateToRoute,
    animateToLocation,
    // Return whether animation is currently running
    isAnimating: () => animationStateManager.getState().isAnimating
  };
}