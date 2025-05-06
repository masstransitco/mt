"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { shallowEqual } from "react-redux";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toast } from "react-hot-toast";
// import { useAnimationState } from "@/hooks/useAnimationState"; // Old animation system - removed
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRoute,
  selectIsQrScanStation,
  selectQrVirtualStationId,
} from "@/store/bookingSlice";
import { selectStationsWithDistance } from "@/store/stationsSlice";
import { selectScannedCar } from "@/store/carSlice";
import { selectDispatchRoute, clearDispatchRoute } from "@/store/dispatchSlice";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import type { StationFeature } from "@/store/stationsSlice";

// Reference to the StationSelectionManager instance
let stationManagerPromise: Promise<any> | null = null;

// Helper function to get the StationSelectionManager
const getStationManager = () => {
  if (!stationManagerPromise) {
    stationManagerPromise = import("@/lib/stationSelectionManager").then(module => module.default);
  }
  return stationManagerPromise;
};

/**
 * Hook to handle station selection actions
 */
export function useStationActions() {
  const dispatch = useAppDispatch();
  const stationManagerRef = useRef<any>(null);
  
  // Load the StationSelectionManager on mount
  useEffect(() => {
    getStationManager().then(manager => {
      stationManagerRef.current = manager;
    });
  }, []);
  
  // Get all necessary state in a single selector call to reduce re-renders
  const {
    step,
    departureId,
    arrivalId,
    stations,
    bookingRoute,
    scannedCar,
    isQrScanStation,
    virtualStationId,
    dispatchRoute
  } = useAppSelector(state => ({
    step: selectBookingStep(state),
    departureId: selectDepartureStationId(state),
    arrivalId: selectArrivalStationId(state),
    stations: selectStationsWithDistance(state),
    bookingRoute: selectRoute(state),
    scannedCar: selectScannedCar(state),
    isQrScanStation: selectIsQrScanStation(state),
    virtualStationId: selectQrVirtualStationId(state),
    dispatchRoute: selectDispatchRoute(state)
  }), shallowEqual);

  // Local UI state
  const [departureMapExpanded, setDepartureMapExpanded] = useState(false);
  const [arrivalMapExpanded, setArrivalMapExpanded] = useState(false);
  const [departureAiInfoExpanded, setDepartureAiInfoExpanded] = useState(false);
  const [arrivalAiInfoExpanded, setArrivalAiInfoExpanded] = useState(false);
  
  
  // Simplified animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const animatingStationId = null; // We no longer track specific station animations

  // Derived state for departure station
  const departureStation = useMemo(() => {
    if (isQrScanStation && scannedCar && departureId) {
      // For virtual stations from QR scans
      if (virtualStationId === departureId || departureId === 1000000 + (scannedCar.id || 0)) {
        return createVirtualStationFromCar(scannedCar, departureId);
      }
    }
    return stations.find((s) => s.id === departureId) || null;
  }, [stations, departureId, isQrScanStation, virtualStationId, scannedCar]);

  // Derived state for arrival station
  const arrivalStation = useMemo(() => {
    return stations.find((s) => s.id === arrivalId) || null;
  }, [stations, arrivalId]);

  // Compute route distance
  const distanceInKm = useMemo(() => {
    return bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null;
  }, [bookingRoute]);

  // Compute pickup in X minutes
  const pickupMins = useMemo(() => {
    if (!dispatchRoute?.duration) return null;
    const drivingMins = dispatchRoute.duration / 60;
    return Math.ceil(drivingMins + 15);
  }, [dispatchRoute]);

  // Highlight logic
  const highlightDeparture = useMemo(() => step <= 2, [step]);
  const highlightArrival = useMemo(() => step >= 3, [step]);

  // Handler to clear departure station
  const handleClearDeparture = useCallback(async () => {
    // Simple check - don't clear if any animation is running
    if (!isAnimating) {
      dispatch(clearDispatchRoute());
      setDepartureMapExpanded(false);
      
      const stationManager = await getStationManager();
      stationManager.clearDepartureStation();
    } else {
      toast.success("Please wait for animation to complete");
    }
  }, [dispatch, isAnimating, departureId]);

  // Handler to clear arrival station
  const handleClearArrival = useCallback(async () => {
    setArrivalMapExpanded(false);
    
    const stationManager = await getStationManager();
    stationManager.clearArrivalStation();
  }, []);

  // Handler for opening QR scanner
  const handleScan = useCallback(async () => {
    const stationManager = await getStationManager();
    stationManager.resetBookingFlowForQrScan();
  }, []);

  // Handler for address search
  const handleAddressSearch = useCallback((location: google.maps.LatLngLiteral) => {
    // This should be provided by the parent component
    // We don't implement Redux dispatches here
  }, []);

  return {
    // State
    step,
    departureId,
    arrivalId,
    departureStation,
    arrivalStation,
    isQrScanStation,
    virtualStationId,
    scannedCar,
    distanceInKm,
    pickupMins,
    highlightDeparture,
    highlightArrival,
    isAnimating,
    animatingStationId,
    
    // UI state
    departureMapExpanded,
    arrivalMapExpanded,
    departureAiInfoExpanded,
    arrivalAiInfoExpanded,
    
    // Actions
    setDepartureMapExpanded,
    setArrivalMapExpanded,
    setDepartureAiInfoExpanded,
    setArrivalAiInfoExpanded,
    handleClearDeparture,
    handleClearArrival,
    handleScan,
    handleAddressSearch
  };
}

export default useStationActions;