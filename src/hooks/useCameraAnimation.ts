import { useEffect, useRef, useCallback } from "react";
import { Group, Easing, Tween } from "@tweenjs/tween.js";
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

// If you'd like to measure distance to scale duration, you need geometry library:
// e.g. in JsApiLoader: libraries: ["geometry"];
declare global {
  interface Window {
    google?: typeof google;
  }
}

/**
 * The shape of the options passed to our hook.
 */
interface UseCameraAnimationOptions {
  map: google.maps.Map | null;
  stations: StationFeature[];
  /**
   * If you use a WebGLOverlayView (e.g. for Three.js),
   * pass its ref so we can call requestRedraw().
   */
  overlayRef?: React.RefObject<google.maps.WebGLOverlayView | null>;
}

// Utility to normalize angle in [0..360)
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

// Choose the shortest heading path (avoid spinning the long way)
function shortHeadingPath(from: number, to: number): number {
  const c = normalizeAngle(from);
  const t = normalizeAngle(to);
  let diff = t - c;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return c + diff;
}

export function useCameraAnimation({
  map,
  stations,
  overlayRef,
}: UseCameraAnimationOptions) {
  // Grab booking data from Redux
  const bookingStep = useAppSelector(selectBookingStep);
  const depId = useAppSelector(selectDepartureStationId);
  const arrId = useAppSelector(selectArrivalStationId);
  const routeCoordinates = useAppSelector(selectRouteDecoded);

  // Also user location and search location
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  // A single TWEEN.Group for all camera animations
  const tweenGroupRef = useRef(new Group());
  const activeTweenRef = useRef<Tween<google.maps.CameraOptions> | null>(null);

  // rAF handle
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Main loop to update all camera tweens.
   */
  const animationLoop = useCallback((time: number) => {
    const group = tweenGroupRef.current;
    if (!group) return;
    group.update(time);

    if (group.allStopped()) {
      animationFrameRef.current = null;
    } else {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    }
  }, []);

  /**
   * Start the animation frame loop if not already running.
   */
  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current == null) {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    }
  }, [animationLoop]);

  /**
   * Animate the camera from current to target.
   * Longer default duration for smoothness.
   * Optionally scale duration by distance if geometry is available.
   */
  const animateCamera = useCallback(
    (
      rawTarget: Partial<google.maps.CameraOptions>,
      baseDuration = 580,
      easing = Easing.Quadratic.Out
    ) => {
      if (!map) return;

      // 1) Current camera
      const currentCamera = {
        center: map.getCenter()?.toJSON() ?? DEFAULT_CENTER,
        zoom: map.getZoom() ?? 12,
        tilt: map.getTilt?.() ?? 0,
        heading: map.getHeading?.() ?? 0,
      };

      // 2) Shortest heading path
      let heading = rawTarget.heading ?? currentCamera.heading;
      heading = shortHeadingPath(currentCamera.heading, heading);

      // 3) Clamp tilt
      let tilt =
        rawTarget.tilt !== undefined ? rawTarget.tilt : currentCamera.tilt;
      if (tilt < 0) tilt = 0;
      if (tilt > 67) tilt = 67; // or pick your max

      // 4) Merge final target
      const finalTarget: google.maps.CameraOptions = {
        center: {
          ...currentCamera.center,
          ...(rawTarget.center || {}),
        },
        zoom: rawTarget.zoom ?? currentCamera.zoom,
        tilt,
        heading,
      };

      // 5) Scale duration by distance if geometry is available
      let finalDuration = baseDuration;
      if (
        window.google?.maps?.geometry?.spherical &&
        finalTarget.center &&
        currentCamera.center
      ) {
        // Guarantee we have a valid LatLngLiteral
        const startCenter = currentCamera.center ?? DEFAULT_CENTER;
        const endCenter = finalTarget.center ?? DEFAULT_CENTER;

        const dist = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(startCenter),
          new window.google.maps.LatLng(endCenter)
        );
        // e.g. each km => +150 ms, up to 8s
        const scaledExtra = dist * 0.15;
        finalDuration = Math.min(finalDuration + scaledExtra, 8000);
      }

      // Stop any existing tween
      if (activeTweenRef.current) {
        activeTweenRef.current.stop();
        tweenGroupRef.current.remove(activeTweenRef.current);
      }

      // Create a new tween
      const newTween = new Tween(currentCamera, tweenGroupRef.current)
        .to(finalTarget, finalDuration)
        .easing(easing)
        .onUpdate(() => {
          map.moveCamera(currentCamera);
          // Redraw if you have a WebGL overlay
          if (overlayRef?.current) {
            overlayRef.current.requestRedraw();
          }
        })
        .onComplete(() => {
          // Snap to final
          map.moveCamera(finalTarget);
        })
        .start();

      activeTweenRef.current = newTween;
      tweenGroupRef.current.add(newTween);
      startAnimationLoop();
    },
    [map, overlayRef, startAnimationLoop]
  );

  /**
   * Reset view to default vantage point.
   */
  const resetView = useCallback(() => {
    animateCamera(
      {
        center: DEFAULT_CENTER,
        zoom: 12,
        tilt: 30,
        heading: 0,
      },
      2000
    );
  }, [animateCamera]);

  /**
   * Animate to a station by ID (convenience).
   */
  const animateToStation = useCallback(
    (stationId: number, duration?: number) => {
      if (!map) return;
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;
      const [lng, lat] = station.geometry.coordinates;
      animateCamera(
        {
          center: { lat, lng },
          zoom: 16,
          tilt: 45,
          heading: 0,
        },
        duration ?? 2500,
        Easing.Cubic.InOut
      );
    },
    [map, stations, animateCamera]
  );

  /**
   * Animate to the user’s location (if available).
   */
  const animateToUserLocation = useCallback(
    (duration = 2000) => {
      if (!map || !userLocation) return;
      animateCamera(
        {
          center: { lat: userLocation.lat, lng: userLocation.lng },
          zoom: 15,
          tilt: 0,
          heading: 0,
        },
        duration,
        Easing.Cubic.InOut
      );
    },
    [map, userLocation, animateCamera]
  );

  /**
   * Animate to the user’s search location (if available).
   */
  const animateToSearchLocation = useCallback(
    (duration = 2000) => {
      if (!map || !searchLocation) return;
      animateCamera(
        {
          center: { lat: searchLocation.lat, lng: searchLocation.lng },
          zoom: 14,
          tilt: 0,
          heading: 0,
        },
        duration,
        Easing.Cubic.InOut
      );
    },
    [map, searchLocation, animateCamera]
  );

  /**
   * Watch booking step changes; animate accordingly.
   */
  useEffect(() => {
    if (!map) return;

    // If no dep/arr, reset
    if (!depId && !arrId) {
      resetView();
      return;
    }

    // Steps 1 or 2 => animate to departure
    if ((bookingStep === 1 || bookingStep === 2) && depId) {
      animateToStation(depId);
    }

    // Steps 3 or 4 => route midpoint or arrival
    if ((bookingStep === 3 || bookingStep === 4) && depId && arrId) {
      if (routeCoordinates?.length > 1) {
        const midIndex = Math.floor(routeCoordinates.length / 2);
        const midpoint = routeCoordinates[midIndex];
        animateCamera(
          {
            center: midpoint,
            tilt: 45,
            heading: 0,
            zoom: 13,
          },
          3000,
          Easing.Cubic.InOut
        );
      } else {
        animateToStation(arrId);
      }
    }
  }, [
    map,
    bookingStep,
    depId,
    arrId,
    routeCoordinates,
    resetView,
    animateToStation,
    animateCamera,
  ]);

  /**
   * If userLocation changes, auto-animate.
   */
  useEffect(() => {
    if (userLocation) {
      animateToUserLocation();
    }
  }, [userLocation, animateToUserLocation]);

  /**
   * If searchLocation changes, auto-animate.
   */
  useEffect(() => {
    if (searchLocation) {
      animateToSearchLocation();
    }
  }, [searchLocation, animateToSearchLocation]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      tweenGroupRef.current.removeAll?.();
      activeTweenRef.current = null;
    };
  }, []);

  // Return whichever camera APIs you need
  return {
    animateCamera,
    animateToStation,
    animateToUserLocation,
    animateToSearchLocation,
    resetView,
  };
}
