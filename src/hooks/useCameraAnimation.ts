import { useCallback, useEffect } from "react";
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
import { useAppSelector } from "@/store/store";
import type { StationFeature } from "@/store/stationsSlice";
import { DEFAULT_CENTER } from "@/constants/map";

interface UseCameraAnimationOptions {
  map: google.maps.Map | null;
  stations: StationFeature[];
  /**
   * If you're using a WebGLOverlayView for custom 3D, pass its ref
   * so we can call requestRedraw() each time the camera moves.
   */
  overlayRef?: React.RefObject<google.maps.WebGLOverlayView | null>;
}

/**
 * A version of the camera-animation hook that uses *only* the standard
 * map.panTo() / map.setZoom() / map.setTilt() methods. This relies on
 * the built-in Google Maps animation for panning (zoom, tilt, and heading
 * typically jump quickly rather than animate smoothly).
 */
export function useCameraAnimationStable({
  map,
  stations,
  overlayRef,
}: UseCameraAnimationOptions) {
  // Redux states
  const bookingStep = useAppSelector(selectBookingStep);
  const depId = useAppSelector(selectDepartureStationId);
  const arrId = useAppSelector(selectArrivalStationId);
  const routeCoords = useAppSelector(selectRouteDecoded);
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  /**
   * Optionally call requestRedraw() after camera changes if using a WebGL overlay.
   */
  const maybeRedraw = useCallback(() => {
    overlayRef?.current?.requestRedraw();
  }, [overlayRef]);

  /**
   * Pan/zoom/tilt/heading with standard stable methods. The map
   * will animate the pan, but zoom, tilt, and heading will be quick jumps.
   */
  const animateCamera = useCallback(
    (center: google.maps.LatLngLiteral, zoom: number, tilt = 0, heading = 0) => {
      if (!map) return;
      // 1) Pan to the center (built-in short animation)
      map.panTo(center);
      // 2) Zoom immediately
      map.setZoom(zoom);
      // 3) Tilt and heading (in stable mode, these typically jump without a pan-like animation)
      map.setTilt?.(tilt);
      map.setHeading?.(heading);

      // Redraw any 3D overlays
      maybeRedraw();
    },
    [map, maybeRedraw]
  );

  /**
   * Reset view if there’s no station chosen
   */
  const resetView = useCallback(() => {
    // example: animate back to a default vantage
    animateCamera(DEFAULT_CENTER, 12, 0, 0);
  }, [animateCamera]);

  /**
   * Move to a particular station (no custom duration, uses built-in short pan animation)
   */
  const animateToStation = useCallback(
    (stationId: number) => {
      if (!map) return;
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;

      const [lng, lat] = station.geometry.coordinates;
      animateCamera({ lat, lng }, 16, 0, 0);
    },
    [map, stations, animateCamera]
  );

  /**
   * User location or search location
   */
  const animateToLocation = useCallback(
    (loc: google.maps.LatLngLiteral, zoom: number) => {
      animateCamera(loc, zoom, 0, 0);
    },
    [animateCamera]
  );

  /**
   * Watch booking steps to decide where to animate
   */
  useEffect(() => {
    if (!map) return;

    // No stations => reset
    if (!depId && !arrId) {
      resetView();
      return;
    }

    // Step 1 or 2 => highlight departure
    if ((bookingStep === 1 || bookingStep === 2) && depId) {
      animateToStation(depId);
    }

    // Step 3 or 4 => if we have a route, move to approximate midpoint
    if ((bookingStep === 3 || bookingStep === 4) && depId && arrId) {
      if (routeCoords?.length > 1) {
        const midIndex = Math.floor(routeCoords.length / 2);
        const midpoint = routeCoords[midIndex];
        animateCamera(midpoint, 13, 0, 0);
      } else {
        // fallback if no route
        animateToStation(arrId);
      }
    }
  }, [map, bookingStep, depId, arrId, routeCoords, resetView, animateToStation, animateCamera]);

  /**
   * If user location changes, animate
   */
  useEffect(() => {
    if (userLocation) {
      animateToLocation(userLocation, 15);
    }
  }, [userLocation, animateToLocation]);

  /**
   * If search location changes, animate
   */
  useEffect(() => {
    if (searchLocation) {
      animateToLocation(searchLocation, 14);
    }
  }, [searchLocation, animateToLocation]);

  // Return whichever methods you’d like to expose
  return {
    resetView,
    animateToStation,
    animateToLocation,
  };
}