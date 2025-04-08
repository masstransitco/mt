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
    if (!map) {
      return {
        center: { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng },
        zoom: 13,
        heading: 0,
        tilt: 0,
      };
    }
    const center = map.getCenter();
    return {
      center: {
        lat: center?.lat() || DEFAULT_CENTER.lat,
        lng: center?.lng() || DEFAULT_CENTER.lng,
      },
      zoom: map.getZoom() ?? 13,
      heading: map.getHeading() ?? 0,
      tilt: map.getTilt() ?? 0,
    };
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

      // Cancel any in-progress revolve
      isAnimatingRef.current = true;
      setUserGestureEnabled(false);

      // Snapshot the current camera
      const start = getCurrentCameraState();
      const end = target;

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

        map.moveCamera({
          center,
          zoom,
          heading,
          tilt,
        });
        onCameraChanged?.();

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

        const animateRevolve = () => {
          if (!map) {
            stop();
            return;
          }

          if (phase === 1) {
            // Increase tilt up to ~67.5 in increments
            tilt += 0.9; // Increased from 0.5 for faster tilt
            if (tilt >= 67.5) {
              tilt = 67.5;
              phase = 2;
            }
          } else {
            // Phase 2: revolve heading from 0 → 180 (reduced from 360)
            heading += 1.5; // Increased from 0.8 for faster rotation
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
          onCameraChanged?.();

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
            console.log(`[useCameraAnimation] Animation complete for station ${stationId}, notifying manager`);
            animationStateManager.completeAnimation();
            
            // Force a slight delay to ensure state updates propagate
            setTimeout(() => {
              console.log(`[useCameraAnimation] Animation state after completion:`, animationStateManager.getState());
            }, 50);
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

      console.log(`[useCameraAnimation] Animating to route with ${points.length} points`);
      
      // For multiple points, first calculate the bounds to get center and appropriate zoom
      const bounds = new google.maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));
      
      // First, let the map calculate the appropriate zoom level by fitting the bounds
      // This is done "invisibly" without animation to get a reference point
      map.fitBounds(bounds);
      
      // Small delay to ensure the map has processed the fitBounds operation
      setTimeout(() => {
        // After fitBounds, get the computed zoom level
        const computedZoom = map.getZoom() || 13;
        
        // Calculate center point from bounds
        const center = bounds.getCenter();
        
        if (!center) return;
        
        // We want a lower zoom level (further away) than what fitBounds gives us
        // Decrease zoom by 1 level for a bit more context around the route
        const adjustedZoom = Math.max(computedZoom - 1, 10);
        
        console.log(`[useCameraAnimation] Route animation: original zoom ${computedZoom}, adjusted to ${adjustedZoom}`);
        
        // Now use our smooth animation with the calculated center but adjusted zoom and tilt
        animateCameraTo(
          {
            center: { lat: center.lat(), lng: center.lng() },
            zoom: adjustedZoom,
            tilt: 45, // 45-degree tilt for a perspective view
            heading: 0, // keep heading at 0 for consistent north orientation
          },
          1200  // Slightly longer animation duration for smoother experience
        );
      }, 10);
      
      manualLocationRef.current = false;
    },
    [map, animateCameraTo]  // Added animateCameraTo dependency
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