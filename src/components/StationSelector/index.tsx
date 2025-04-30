"use client";

import React from "react";
import dynamic from "next/dynamic";
import { StationSelectorProvider } from "./context/StationSelectorContext";
import MainContent from "./presentation/MainContent";
import useStationActions from "./hooks/useStationActions";
import type { Car } from "@/types/cars";

// Lazy-load Google3DMapCard so we don't bundle the script in SSR
const Google3DMapCard = dynamic(() => import("@/components/3DMapCard"), {
  ssr: false,
  loading: () => (
    <div className="h-52 w-full bg-card rounded-xl flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-[#10a37f] border-t-transparent rounded-full" />
    </div>
  ),
});

interface StationSelectorProps {
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
  onClearDeparture?: () => void;
  onClearArrival?: () => void;
  onScan?: () => void; // for QR scanning
  isQrScanStation?: boolean;
  virtualStationId?: number | null;
  scannedCar?: Car | null;
  // animateToLocation is no longer needed as we use CameraAnimationManager directly
  inSheet?: boolean; // to indicate if it's embedded in a sheet
  currentStep?: number; // current booking step
}

/**
 * Container component for StationSelector
 * Manages state and provides context to presentational components
 */
function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
  onScan,
  isQrScanStation = false,
  virtualStationId = null,
  scannedCar = null,
  inSheet = false,
  currentStep: externalStep,
}: StationSelectorProps) {
  // Get station actions from the custom hook
  const {
    step: reduxStep,
    departureStation,
    arrivalStation,
    departureId,
    arrivalId,
    distanceInKm,
    pickupMins,
    highlightDeparture,
    highlightArrival,
    isAnimating,
    animatingStationId,
    departureMapExpanded,
    arrivalMapExpanded,
    setDepartureMapExpanded,
    setArrivalMapExpanded,
    handleClearDeparture,
    handleClearArrival,
    handleScan,
  } = useStationActions();

  // Use external step if provided, otherwise fall back to Redux step
  const currentStep = externalStep !== undefined ? externalStep : reduxStep;
  
  // Track DateTimePicker visibility
  const [isDateTimePickerVisible, setIsDateTimePickerVisible] = React.useState(false);

  // Prepare context value for provider
  const contextValue = {
    // Core state
    inSheet,
    currentStep,
    isAnimating,
    animatingStationId,
    
    // Station data
    departureStation,
    arrivalStation,
    departureId,
    arrivalId,
    isQrScanStation,
    scannedCar,
    
    // Route info
    distanceInKm,
    pickupMins,
    
    // UI state
    highlightDeparture,
    highlightArrival,
    
    // Actions - Prefer provided props over internal handlers when available
    onAddressSearch,
    onClearDeparture: onClearDeparture || handleClearDeparture,
    onClearArrival: onClearArrival || handleClearArrival,
    onScan: onScan || handleScan,
    setDepartureMapExpanded,
    setArrivalMapExpanded,
    
    // No longer passing animateToLocation as CameraAnimationManager is used directly
  };

  return (
    <>
      <StationSelectorProvider value={contextValue}>
        <MainContent />
      </StationSelectorProvider>

      {/* DEPARTURE MapCard expanded view */}
      {departureMapExpanded && departureStation && (
        <Google3DMapCard
          coordinates={[departureStation.geometry.coordinates[0], departureStation.geometry.coordinates[1]]}
          name={departureStation.properties.Place}
          address={departureStation.properties.Address}
          expanded={departureMapExpanded}
          onToggleExpanded={setDepartureMapExpanded}
          hideDefaultExpandButton
        />
      )}

      {/* ARRIVAL MapCard expanded view */}
      {arrivalMapExpanded && arrivalStation && (
        <Google3DMapCard
          coordinates={[arrivalStation.geometry.coordinates[0], arrivalStation.geometry.coordinates[1]]}
          name={arrivalStation.properties.Place}
          address={arrivalStation.properties.Address}
          expanded={arrivalMapExpanded}
          onToggleExpanded={setArrivalMapExpanded}
          hideDefaultExpandButton
        />
      )}
    </>
  );
}

export default React.memo(StationSelector);