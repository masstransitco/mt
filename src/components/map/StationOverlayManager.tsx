import React, { useEffect, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { 
  selectStationsWithDistance, 
  selectStationsLoading,
  StationFeature
} from '@/store/stationsSlice';
import { 
  selectDepartureStationId, 
  selectArrivalStationId,
  selectBookingStep,
  selectRouteDecoded
} from '@/store/bookingSlice';
import { selectListSelectedStationId } from '@/store/userSlice';
import { selectStations3D } from '@/store/stations3DSlice';

interface StationOverlayManagerProps {
  /**
   * Google Maps instance
   */
  map: google.maps.Map | null;
  
  /**
   * Callback for station selection
   */
  onStationSelected?: (stationId: number) => void;
  
  /**
   * Reference to the map overlay manager
   */
  overlayManager?: any;
  
  /**
   * Camera animation controls
   */
  cameraControls?: any;
}

/**
 * Manages station-related overlays including markers and 3D buildings
 * 
 * This component is responsible for:
 * - Station marker rendering
 * - Station selection handling
 * - Marker state management based on selection state
 * - Integrating with overlay system
 */
export function StationOverlayManager({ 
  map,
  onStationSelected,
  overlayManager,
  cameraControls
}: StationOverlayManagerProps) {
  const dispatch = useAppDispatch();
  
  // Get station data and selection state from Redux
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const listSelectedStationId = useAppSelector(selectListSelectedStationId);
  const bookingStep = useAppSelector(selectBookingStep);
  const buildings3D = useAppSelector(selectStations3D);
  const routeDecoded = useAppSelector(selectRouteDecoded);
  
  // Handle station selection with camera controls
  const handleStationClick = useCallback((stationId: number) => {
    console.log(`[StationOverlayManager] Station clicked: ${stationId}`);
    
    if (onStationSelected) {
      onStationSelected(stationId);
    } else {
      // Default behavior - use stationSelectionManager with camera controls
      import('@/lib/stationSelectionManager').then(module => {
        const stationSelectionManager = module.default;
        stationSelectionManager.selectStation(stationId, false, cameraControls);
      });
    }
  }, [onStationSelected, cameraControls]);
  
  // Determine which stations should be expanded based on selection state
  const getMarkerViewStates = useCallback((stations: StationFeature[]) => {
    const expandedStationIds = new Set<number>();
    const importantStationIds = new Set<number>();
    
    // Add selected stations to expanded set
    if (departureStationId) {
      expandedStationIds.add(departureStationId);
      importantStationIds.add(departureStationId);
    }
    
    if (arrivalStationId) {
      expandedStationIds.add(arrivalStationId);
      importantStationIds.add(arrivalStationId);
    }
    
    // Add list-selected station if it's not already departure or arrival
    if (listSelectedStationId && 
        listSelectedStationId !== departureStationId && 
        listSelectedStationId !== arrivalStationId) {
      expandedStationIds.add(listSelectedStationId);
      importantStationIds.add(listSelectedStationId);
    }
    
    return {
      expandedStationIds,
      importantStationIds
    };
  }, [departureStationId, arrivalStationId, listSelectedStationId]);
  
  // Filter stations based on booking step
  const filteredStations = useMemo(() => {
    // In steps 2 and 4, only show important stations
    if (bookingStep === 2 || bookingStep === 4) {
      const { importantStationIds } = getMarkerViewStates(stations);
      return stations.filter(station => importantStationIds.has(station.id));
    }
    
    // Show all stations in other steps
    return stations;
  }, [stations, bookingStep, getMarkerViewStates]);
  
  // Create marker options object
  const markerOptions = useMemo(() => ({
    stations: filteredStations,
    departureStationId,
    arrivalStationId,
    bookingStep,
    onPickupClick: handleStationClick
  }), [filteredStations, departureStationId, arrivalStationId, bookingStep, handleStationClick]);
  
  // Create three options object
  const threeOptions = useMemo(() => ({
    buildings3D,
    routeDecoded,
    departureStationId,
    arrivalStationId,
    bookingStep,
    showRouteTube: !!routeDecoded && routeDecoded.length > 0 && bookingStep === 4,
    onStationSelected: handleStationClick
  }), [buildings3D, routeDecoded, departureStationId, arrivalStationId, bookingStep, handleStationClick]);
  
  // Update the overlay manager with our options
  useEffect(() => {
    if (!map || !overlayManager) return;
    
    // Update marker overlay
    overlayManager.updateOverlay('markers', markerOptions);
    
    // Update Three.js overlay
    overlayManager.updateOverlay('three', threeOptions);
    
  }, [map, overlayManager, markerOptions, threeOptions]);
  
  return null; // This is a controller component with no UI
}