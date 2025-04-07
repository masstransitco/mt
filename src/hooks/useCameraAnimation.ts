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
  // Animate to route (fitBounds)
  // -------------------------
  const animateToRoute = useCallback(
    (points: Array<{ lat: number; lng: number }>) => {
      if (!map || points.length < 1) return;

      // For multiple points, use an official method: fitBounds.
      const bounds = new google.maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));

      // We'll do an immediate fit, because Google Maps doesn't provide
      // a direct “animate fitBounds” method. For a more manual approach,
      // you could do repeated interpolation steps, but that’s more
      // code complexity.
      map.setHeading(0);
      map.setTilt(0);
      map.fitBounds(bounds);

      manualLocationRef.current = false;
    },
    [map]
  );

  // -------------------------
  // Animate to user/search location
  // Now using animateCameraTo
  // -------------------------
  const animateToLocation = useCallback(
    (loc: google.maps.LatLngLiteral, zoom = 15) => {
      if (!map) return;
      // We’ll smoothly move from current to target (heading=0).
      const target = {
        center: loc,
        zoom,
        heading: 0,
        tilt: 20, // slight tilt for a nicer effect
      };
      animateCameraTo(target, 1000);
      manualLocationRef.current = true;
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
        const depSt = findStation(depId);
        const arrSt = findStation(arrId);
        if (depSt && arrSt) {
          const [lng1, lat1] = depSt.geometry.coordinates;
          const [lng2, lat2] = arrSt.geometry.coordinates;
          animateToRoute([
            { lat: lat1, lng: lng1 },
            { lat: lat2, lng: lng2 },
          ]);
        }
      } else {
        // If arrival not chosen yet, just reset the view
        resetView();
      }
      return;
    }

    // 4) Step 4 => show route if available
    if (bookingStep === 4 && depId && arrId) {
      // If routeCoords exist, we can also do a direct bounding
      // around the route or just do departure + arrival.
      // For simplicity, let's keep it departure+arrival bounding:
      const depSt = findStation(depId);
      const arrSt = findStation(arrId);
      if (depSt && arrSt) {
        const [lng1, lat1] = depSt.geometry.coordinates;
        const [lng2, lat2] = arrSt.geometry.coordinates;
        animateToRoute([
          { lat: lat1, lng: lng1 },
          { lat: lat2, lng: lng2 },
        ]);
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
    animateToLocation(searchLocation, 15);
  }, [searchLocation, animateToLocation]);

  // -------------------------
  // Watch for new user location => animate from current
  // -------------------------
  useEffect(() => {
    if (!userLocation || isAnimatingRef.current) return;
    animateToLocation(userLocation, 15);
  }, [userLocation, animateToLocation]);

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