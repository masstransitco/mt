import { useEffect, useRef, useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { selectStationsWithDistance } from '@/store/stationsSlice';
import { selectStations3D } from '@/store/stations3DSlice';
import { selectUserLocation, selectSearchLocation, selectWalkingRoute } from '@/store/userSlice';
import { selectDepartureStationId, selectArrivalStationId, selectRouteDecoded, selectBookingStep } from '@/store/bookingSlice';

import mapOverlayManager from '@/lib/mapOverlayManager';
import { createMarkerOverlay, MarkerOptions } from '@/lib/overlays/markerOverlayAdapter';
import { createThreeOverlay, ThreeOptions } from '@/lib/overlays/threeOverlayAdapter';
import { createCircleOverlay, CircleOptions } from '@/lib/overlays/circleOverlayAdapter';
import { createWalkingRouteOverlay, WalkingRouteOptions } from '@/lib/overlays/walkingRouteOverlayAdapter';

/**
 * Options for the useMapOverlays hook
 */
export interface MapOverlaysOptions {
  /**
   * Options for the marker overlay
   */
  markerOptions?: MarkerOptions;
  
  /**
   * Options for the Three.js overlay
   */
  threeOptions?: ThreeOptions;
  
  /**
   * Options for the circle overlay
   */
  circleOptions?: CircleOptions;
  
  /**
   * Options for the walking route overlay
   */
  walkingRouteOptions?: WalkingRouteOptions;
}

/**
 * Hook to initialize and manage all map overlays
 * 
 * This replaces the previous individual hooks:
 * - useMarkerOverlay
 * - useThreeOverlay
 * - useCircleOverlay
 * - useWalkingRouteOverlay
 * 
 * @param map Google Maps instance
 * @param options Options for the overlays
 * @returns References to overlay managers
 */
export function useMapOverlays(
  map: google.maps.Map | null,
  options: MapOverlaysOptions = {}
) {
  const initRef = useRef(false);
  
  // Get relevant state from Redux
  const stations = useAppSelector(selectStationsWithDistance);
  const buildings3D = useAppSelector(selectStations3D);
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);
  const walkingRoute = useAppSelector(selectWalkingRoute);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const routeDecoded = useAppSelector(selectRouteDecoded);
  const bookingStep = useAppSelector(selectBookingStep);
  
  // Initialize overlays when map changes
  useEffect(() => {
    // Set the map in the overlay manager
    mapOverlayManager.setMap(map);
    
    // Only initialize overlays once
    if (initRef.current) return;
    if (!map) return;
    
    console.log('[useMapOverlays] Initializing overlays');
    
    // Create marker overlay
    const markerOverlay = createMarkerOverlay(options.markerOptions || {});
    mapOverlayManager.register('markers', markerOverlay);
    
    // Create Three.js overlay
    const threeOverlay = createThreeOverlay(options.threeOptions || {});
    mapOverlayManager.register('three', threeOverlay);
    
    // Create circle overlay
    const circleOverlay = createCircleOverlay(options.circleOptions || {});
    mapOverlayManager.register('circles', circleOverlay);
    
    // Create walking route overlay
    const walkingRouteOverlay = createWalkingRouteOverlay(options.walkingRouteOptions || {});
    mapOverlayManager.register('walkingRoute', walkingRouteOverlay);
    
    // Mark as initialized
    initRef.current = true;
    
    // Clean up on unmount
    return () => {
      console.log('[useMapOverlays] Cleaning up overlays');
      mapOverlayManager.disposeAll();
      initRef.current = false;
    };
  }, [map, options]);
  
  // Update marker overlay when relevant state changes
  useEffect(() => {
    if (!map || !initRef.current) return;
    
    const markerOptions: MarkerOptions & { 
      stations?: any[],
      departureStationId?: number | null,
      arrivalStationId?: number | null,
      bookingStep?: number
    } = {
      ...options.markerOptions,
      stations,
      departureStationId,
      arrivalStationId,
      bookingStep
    };
    
    mapOverlayManager.updateOverlay('markers', markerOptions);
  }, [map, stations, departureStationId, arrivalStationId, bookingStep, options.markerOptions]);
  
  // Update Three.js overlay when relevant state changes
  useEffect(() => {
    if (!map || !initRef.current) return;
    
    const threeOptions: ThreeOptions & {
      buildings3D?: any[],
      routeDecoded?: any[],
      departureStationId?: number | null,
      arrivalStationId?: number | null,
      bookingStep?: number,
      showRouteTube?: boolean
    } = {
      ...options.threeOptions,
      buildings3D,
      routeDecoded,
      departureStationId,
      arrivalStationId,
      bookingStep,
      showRouteTube: !!routeDecoded && routeDecoded.length > 0 && bookingStep === 4
    };
    
    mapOverlayManager.updateOverlay('three', threeOptions);
  }, [map, buildings3D, routeDecoded, departureStationId, arrivalStationId, bookingStep, options.threeOptions]);
  
  // Update circle overlay when locations change
  useEffect(() => {
    if (!map || !initRef.current) return;
    
    const circleOptions: CircleOptions & {
      userLocation?: google.maps.LatLngLiteral | null,
      searchLocation?: google.maps.LatLngLiteral | null
    } = {
      ...options.circleOptions,
      userLocation,
      searchLocation
    };
    
    mapOverlayManager.updateOverlay('circles', circleOptions);
  }, [map, userLocation, searchLocation, options.circleOptions]);
  
  // Update walking route overlay when route changes
  useEffect(() => {
    if (!map || !initRef.current) return;
    
    const walkingRouteOptions: WalkingRouteOptions & {
      path?: google.maps.LatLngLiteral[]
    } = {
      ...options.walkingRouteOptions,
      path: walkingRoute?.map(pt => ({ lat: pt[0], lng: pt[1] }))
    };
    
    mapOverlayManager.updateOverlay('walkingRoute', walkingRouteOptions);
  }, [map, walkingRoute, options.walkingRouteOptions]);
  
  // Return references to the overlays for direct access if needed
  return useMemo(() => ({
    markerOverlay: mapOverlayManager.getOverlay('markers'),
    threeOverlay: mapOverlayManager.getOverlay('three'),
    circleOverlay: mapOverlayManager.getOverlay('circles'),
    walkingRouteOverlay: mapOverlayManager.getOverlay('walkingRoute'),
    manager: mapOverlayManager
  }), []);
}