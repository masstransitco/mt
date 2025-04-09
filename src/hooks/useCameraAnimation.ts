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
import cameraStateManager from "@/lib/cameraStateManager";

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

  // Track if we're mid-animation (so we can block user inputs)
  const isAnimatingRef = useRef(false);

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
    // Try to get camera state from shared manager first
    const sharedState = cameraStateManager.getCameraState();
    if (sharedState.lastUpdated > 0) {
      return {
        center: sharedState.center || DEFAULT_CENTER,
        zoom: sharedState.zoom,
        heading: sharedState.heading,
        tilt: sharedState.tilt,
      };
    }
    
    // Fallback to direct API calls if needed
    if (!map) {
      const defaultState = {
        center: DEFAULT_CENTER,
        zoom: 13,
        heading: 0,
        tilt: 0,
      };
      return defaultState;
    }
    
    // Get camera state directly from map - only done once if shared state isn't initialized
    const center = map.getCenter();
    const cameraState = {
      center: center ? {
        lat: center.lat(),
        lng: center.lng(),
      } : DEFAULT_CENTER,
      zoom: map.getZoom() ?? 13,
      heading: map.getHeading() ?? 0,
      tilt: map.getTilt() ?? 0,
    };
    
    // Update shared state - only done once on initialization
    cameraStateManager.updateCameraState({
      tilt: cameraState.tilt,
      zoom: cameraState.zoom,
      heading: cameraState.heading,
      center: cameraState.center
    });
    
    return cameraState;
  }, [map]);

  // -------------------------
  // Helper: linear interpolation
  // -------------------------
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // For lat/lng, just do a simple linear interpolation
  const lerpLatLng = (
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
    t: number
  ) => ({
    lat: lerp(from.lat, to.lat, t),
    lng: lerp(from.lng, to.lng, t),
  });

  // Constants for determining if camera positions are roughly equal
  const EPSILON = {
    latLng: 0.00005, // ~5 meters
    zoom: 0.01,
    heading: 0.5,
    tilt: 0.5,
  };

  // Helper functions to determine if values are roughly equal
  const isRoughlyEqual = (a: number, b: number, epsilon: number) => Math.abs(a - b) < epsilon;
  const isLatLngEqual = (a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) =>
    isRoughlyEqual(a.lat, b.lat, EPSILON.latLng) && isRoughlyEqual(a.lng, b.lng, EPSILON.latLng);

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
      onComplete?: () => void
    ) => {
      if (!map) return;

      // Snapshot the current camera
      const start = getCurrentCameraState();
      const end = target;
      
      // Check if the camera position is already very close to the target
      const noChange =
        isLatLngEqual(start.center, end.center) &&
        isRoughlyEqual(start.zoom, end.zoom, EPSILON.zoom) &&
        isRoughlyEqual(start.heading, end.heading, EPSILON.heading) &&
        isRoughlyEqual(start.tilt, end.tilt, EPSILON.tilt);
      
      // If we're already at the target position (or very close), just update state and return
      if (noChange) {
        // Just set camera directly without animation
        map.moveCamera(end);
        // Update state manager without animation
        cameraStateManager.updateCameraState(end);
        // Call callbacks
        onCameraChanged?.();
        onComplete?.();
        return;
      }

      // If we get here, we need to animate - cancel any in-progress animation
      isAnimatingRef.current = true;
      setUserGestureEnabled(false);

      const startTime = performance.now();
      let rafId = 0;

      const frame = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / durationMs, 1); // clamp to 1

        // LERP each camera property
        const center = lerpLatLng(start.center, end.center, t);
        const zoom = lerp(start.zoom, end.zoom, t);
        const heading = lerp(start.heading, end.heading, t);
        const tilt = lerp(start.tilt, end.tilt, t);

        // Only update camera if values significantly changed
        map.moveCamera({
          center,
          zoom,
          heading,
          tilt,
        });
        
        // Throttle updates to camera state manager (only every 3rd frame)
        if (Math.floor(t * 10) % 3 === 0) {
          cameraStateManager.updateCameraState({
            center,
            zoom,
            heading,
            tilt
          });
        }
        
        // Call onCameraChanged only at key points (start, middle, end)
        if (t === 0 || t >= 0.5 || t === 1) {
          onCameraChanged?.();
        }

        if (t < 1) {
          rafId = requestAnimationFrame(frame);
        } else {
          finish();
        }
      };

      const finish = () => {
        isAnimatingRef.current = false;
        setUserGestureEnabled(true);
        onComplete?.();
      };

      rafId = requestAnimationFrame(frame);

      // In case the component unmounts mid-animation
      return () => {
        cancelAnimationFrame(rafId);
        finish();
      };
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
   * - First animates camera from current position → revolve start position
   * - Then does revolve (tilt up to ~67.5, heading 0→360)
   * - Re-enables user input
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

      // Mark animation as started and update animation state manager
      isAnimatingRef.current = true;
      setUserGestureEnabled(false);
      
      // Update animation state in the manager
      import("@/lib/animationStateManager").then(module => {
        const animationStateManager = module.default;
        // 4500ms total duration (reduced from 8000ms)
        animationStateManager.startAnimation('CAMERA_CIRCLING', stationId, 4500);
      });

      // Step 1: smoothly move from current camera to revolve start
      const revolveStart = {
        center: { lat, lng },
        zoom: 17, // slightly further than before
        heading: 0,
        tilt: 0,
      };

      animateCameraTo(revolveStart, 800, () => {
        // Step 2: revolve
        let tilt = 0;
        let heading = 0;
        let phase = 1; // 1 => tilt up, 2 => revolve
        isAnimatingRef.current = true;
        setUserGestureEnabled(false);

        let rafId = 0;

        // Track frames to optimize updates
        let frameCounter = 0;
        
        const animateRevolve = () => {
          if (!map) {
            stop();
            return;
          }

          frameCounter++;
          
          if (phase === 1) {
            // Increase tilt up to ~67.5 in increments
            tilt += 1.2; // Further increased speed for faster tilt
            if (tilt >= 67.5) {
              tilt = 67.5;
              phase = 2;
            }
          } else {
            // Phase 2: revolve heading from 0 → 180
            heading += 2.0; // Further increased for faster rotation
            if (heading >= 180) {
              heading = 180;
            }
          }

          map.moveCamera({
            center: revolveStart.center,
            zoom: revolveStart.zoom,
            tilt,
            heading,
          });
          
          // Update shared camera state less frequently
          if (frameCounter % 3 === 0) {
            cameraStateManager.updateCameraState({
              center: revolveStart.center,
              zoom: revolveStart.zoom,
              tilt,
              heading
            });
          }
          
          // Only call callback periodically to reduce overhead
          if (frameCounter % 4 === 0) {
            onCameraChanged?.();
          }

          if (phase === 2 && heading >= 180) {
            stop();
            return;
          }
          rafId = requestAnimationFrame(animateRevolve);
        };

        const stop = () => {
          cancelAnimationFrame(rafId);
          isAnimatingRef.current = false;
          setUserGestureEnabled(true);
          
          // Notify animation state manager of completion
          import("@/lib/animationStateManager").then(module => {
            const animationStateManager = module.default;
            
            // Log completion
            console.log(`[useCameraAnimation] Animation complete for station ${stationId}, notifying manager`);
            
            // First ensure camera state is updated one last time with final values
            cameraStateManager.updateCameraState({
              center: revolveStart.center,
              zoom: revolveStart.zoom,
              tilt,
              heading
            });
            
            // Then notify animation manager that we've completed
            animationStateManager.completeAnimation();
            
            // Force a slight delay to ensure state updates propagate and log the result
            setTimeout(() => {
              console.log(`[useCameraAnimation] Animation state after completion:`, animationStateManager.getState());
            }, 300);
          });
          
          if (onComplete) {
            onComplete();
          }
        };

        rafId = requestAnimationFrame(animateRevolve);
      });
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
      
      // Calculate approximate center and zoom directly instead of relying on fitBounds + setTimeout
      // This avoids an extra render cycle and potential flicker
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      
      // Manual center calculation
      const center = {
        lat: (ne.lat() + sw.lat()) / 2,
        lng: (ne.lng() + sw.lng()) / 2
      };
      
      // Approximate zoom calculation based on distance
      // Using the Haversine formula approximation
      const latDistance = Math.abs(ne.lat() - sw.lat());
      const lngDistance = Math.abs(ne.lng() - sw.lng());
      const maxDistance = Math.max(latDistance, lngDistance * Math.cos(center.lat * Math.PI / 180));
      
      // Approximate zoom based on distance
      // zoom = log2(360/distance) assuming 360 degrees covers zoom level 0
      let estimatedZoom = Math.log2(360 / maxDistance);
      
      // Adjust zoom for better viewing - typically 1 level out
      const adjustedZoom = Math.max(Math.min(estimatedZoom - 1, 18), 10);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[useCameraAnimation] Route animation: estimated zoom ${estimatedZoom.toFixed(2)}, adjusted to ${adjustedZoom}`);
      }
      
      // Use our smooth animation with the calculated center and zoom
      animateCameraTo(
        {
          center,
          zoom: adjustedZoom,
          tilt: 45, // 45-degree tilt for a perspective view
          heading: 0, // keep heading at 0 for consistent north orientation
        },
        1000  // Slightly faster animation for better responsiveness
      );
      
      manualLocationRef.current = false;
    },
    [map, animateCameraTo]
  );

  // -------------------------
  // Animate to user/search location
  // Now using animateCameraTo
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
      
      animateCameraTo(target, 1000);
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
    animateCameraTo(target, 1000);
  }, [map, animateCameraTo]);

  // -------------------------
  // Main effect reacting to bookingStep
  // -------------------------
  useEffect(() => {
    if (!map || isAnimatingRef.current) return;

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
    if (!searchLocation || isAnimatingRef.current) return;
    
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
    if (!userLocation || isAnimatingRef.current) return;
    
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
      animateCameraTo({ center: { lat, lng }, zoom: 15, heading: 0, tilt }, 1000);
      manualLocationRef.current = false;
    },
    circleAroundStation,
    animateToRoute,
    animateToLocation,
    isAnimatingRef,
  };
}