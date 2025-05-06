"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { STATION_COLORS, CONTEXT_SIZES } from "../constants";
import type { StationFeature } from "@/store/stationsSlice";
import type { Car } from "@/types/cars";

interface StationSelectorContextType {
  // Core state
  inSheet: boolean;
  currentStep: number;
  isAnimating: boolean;
  animatingStationId: number | null;
  
  // Station data
  departureStation: StationFeature | null;
  arrivalStation: StationFeature | null;
  departureId: number | null;
  arrivalId: number | null;
  isQrScanStation: boolean;
  scannedCar: Car | null;
  
  // Route info
  distanceInKm: string | null;
  pickupMins: number | null;
  
  // UI state
  highlightDeparture: boolean;
  highlightArrival: boolean;
  
  // Actions
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
  onClearDeparture: () => void;
  onClearArrival: () => void;
  onScan?: () => void;
  setDepartureMapExpanded: (expanded: boolean) => void;
  setArrivalMapExpanded: (expanded: boolean) => void;
  
  // AI Info Card state
  departureAiInfoExpanded: boolean;
  arrivalAiInfoExpanded: boolean;
  setDepartureAiInfoExpanded: (expanded: boolean) => void;
  setArrivalAiInfoExpanded: (expanded: boolean) => void;
  // No longer including animateToLocation as we use CameraAnimationManager directly
  
  // Theme (derived from inSheet)
  theme: {
    colors: typeof STATION_COLORS;
    sizes: typeof CONTEXT_SIZES.SHEET | typeof CONTEXT_SIZES.MAP;
    containerStyle: { backgroundColor: string };
    // Add AI Info setters to the theme
    setDepartureAiInfoExpanded?: (expanded: boolean) => void;
    setArrivalAiInfoExpanded?: (expanded: boolean) => void;
  };
}

// Default context with required fields
const defaultContext: StationSelectorContextType = {
  inSheet: false,
  currentStep: 1,
  isAnimating: false,
  animatingStationId: null,
  departureStation: null,
  arrivalStation: null,
  departureId: null,
  arrivalId: null,
  isQrScanStation: false,
  scannedCar: null,
  distanceInKm: null,
  pickupMins: null,
  highlightDeparture: true,
  highlightArrival: false,
  onAddressSearch: () => {},
  onClearDeparture: () => {},
  onClearArrival: () => {},
  onScan: () => {},
  setDepartureMapExpanded: () => {},
  setArrivalMapExpanded: () => {},
  departureAiInfoExpanded: false,
  arrivalAiInfoExpanded: false,
  setDepartureAiInfoExpanded: () => {},
  setArrivalAiInfoExpanded: () => {},
  // animateToLocation removed
  theme: {
    colors: STATION_COLORS,
    sizes: CONTEXT_SIZES.MAP,
    containerStyle: { backgroundColor: "rgba(0, 0, 0, 0.9)" },
    setDepartureAiInfoExpanded: () => {},
    setArrivalAiInfoExpanded: () => {}
  }
};

// Create the context
const StationSelectorContext = createContext<StationSelectorContextType>(defaultContext);

// Provider component
interface StationSelectorProviderProps {
  children: ReactNode;
  value: Partial<StationSelectorContextType>;
}

export function StationSelectorProvider({ children, value }: StationSelectorProviderProps) {
  // Merge provided values with defaults
  const contextValue: StationSelectorContextType = {
    ...defaultContext,
    ...value,
    // Ensure theme is derived from the current inSheet value
    theme: {
      colors: STATION_COLORS,
      sizes: value.inSheet ? CONTEXT_SIZES.SHEET : CONTEXT_SIZES.MAP,
      containerStyle: { backgroundColor: "rgba(0, 0, 0, 0.9)" },
      setDepartureAiInfoExpanded: value.setDepartureAiInfoExpanded,
      setArrivalAiInfoExpanded: value.setArrivalAiInfoExpanded
    }
  };

  return (
    <StationSelectorContext.Provider value={contextValue}>
      {children}
    </StationSelectorContext.Provider>
  );
}

// Custom hook to use the context
export function useStationSelector() {
  const context = useContext(StationSelectorContext);
  if (context === undefined) {
    throw new Error("useStationSelector must be used within a StationSelectorProvider");
  }
  return context;
}

export default StationSelectorContext;