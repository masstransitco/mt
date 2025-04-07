import { store } from "@/store/store";
import type { StationFeature } from "@/store/stationsSlice";
import {
  selectStationsWithDistance,
  removeStation,
  addVirtualStation,
} from "@/store/stationsSlice";

import {
  selectBookingStep,
  advanceBookingStep,
  selectDepartureStation,
  selectArrivalStation,
  clearDepartureStation,
  clearArrivalStation,
  clearQrStationData,
  setQrStationData,
  selectIsQrScanStation,
  selectQrVirtualStationId,
  clearRoute,
  resetBookingFlow,
} from "@/store/bookingSlice";

import { clearDispatchRoute } from "@/store/dispatchSlice";
import { setScannedCar } from "@/store/carSlice";
import { setListSelectedStation } from "@/store/userSlice";
import { toast } from "react-hot-toast";
import { createVirtualStationFromCar } from "./stationUtils";
import type { Car } from "@/types/cars";
import type { SheetMode } from "@/types/map";

export type SelectionMode = "departure" | "arrival";

// Exported for testing
export const getSelectionModeFromStep = (step: number): SelectionMode => {
  return step === 1 || step === 2 ? "departure" : "arrival";
};

class StationSelectionManager {
  // Reference to track QR scanned car IDs
  private processedCarIdRef: number | null = null;
  
  // Singleton implementation
  private static instance: StationSelectionManager;
  
  private constructor() {}
  
  public static getInstance(): StationSelectionManager {
    if (!StationSelectionManager.instance) {
      StationSelectionManager.instance = new StationSelectionManager();
    }
    return StationSelectionManager.instance;
  }

  /**
   * Gets the current booking step from the store
   */
  public getCurrentStep(): number {
    return store.getState().booking.step;
  }

  /**
   * Gets the current selection mode (departure or arrival) based on the booking step
   */
  public getCurrentSelectionMode(): SelectionMode {
    const step = this.getCurrentStep();
    return getSelectionModeFromStep(step);
  }

  /**
   * Select a station (either departure or arrival based on current step)
   * @param stationId The station ID to select
   * @param viaScan Whether this selection is via QR scan (default: false)
   * @returns The new sheet mode after selection
   */
  public selectStation(stationId: number, viaScan = false): SheetMode {
    const state = store.getState();
    const step = state.booking.step;
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;

    // Get the station object to check if selected station is a virtual car station
    const stations = selectStationsWithDistance(state);
    const selectedStation = stations.find(s => s.id === stationId);
    const isSelectedStationVirtual = selectedStation?.properties?.isVirtualCarLocation === true;
    
    console.log(`[stationSelectionManager] Selecting station ${stationId}, isVirtual: ${isSelectedStationVirtual}`);
    console.log(`[stationSelectionManager] Current state: isQrScanStation=${isQrScanStation}, virtualStationId=${virtualStationId}`);

    // If we had a prior QR-based station, remove it if it's different
    if (isQrScanStation && virtualStationId && stationId !== virtualStationId) {
      console.log(`[stationSelectionManager] Clearing previous QR station ${virtualStationId}`);
      store.dispatch(clearDepartureStation());
      store.dispatch(removeStation(virtualStationId));
      store.dispatch(clearQrStationData());
      store.dispatch(setScannedCar(null));
      this.processedCarIdRef = null;
    }
    
    // If we're selecting a regular station but had a QR station as departure,
    // clear the QR station even if we're in step 3+
    if (!isSelectedStationVirtual && isQrScanStation && virtualStationId && departureStationId === virtualStationId) {
      console.log(`[stationSelectionManager] Regular station selected, clearing QR departure station ${virtualStationId}`);
      // Don't clear departure if we're in step 3+ as it would reset the flow
      if (step <= 2) {
        store.dispatch(clearDepartureStation());
      }
      store.dispatch(removeStation(virtualStationId));
      store.dispatch(clearQrStationData());
      store.dispatch(setScannedCar(null));
      this.processedCarIdRef = null;
    }

    // Step logic
    if (step === 1) {
      store.dispatch(selectDepartureStation(stationId));
      store.dispatch(advanceBookingStep(2));
      toast.success("Departure station selected!");
    } else if (step === 2) {
      store.dispatch(selectDepartureStation(stationId));
      toast.success("Departure station re-selected!");
    } else if (step === 3) {
      store.dispatch(selectArrivalStation(stationId));
      store.dispatch(advanceBookingStep(4));
      toast.success("Arrival station selected!");
    } else if (step === 4) {
      store.dispatch(selectArrivalStation(stationId));
      toast.success("Arrival station re-selected!");
    } else {
      toast(`Station tapped, but no action at step ${step}`);
    }

    // Update list selected station in Redux
    store.dispatch(setListSelectedStation(stationId));

    // If this is a new QR station, mark it as such in redux
    if (isSelectedStationVirtual && viaScan) {
      console.log(`[stationSelectionManager] Setting QR station data for ${stationId}`);
      store.dispatch(setQrStationData({
        isQrScanStation: true,
        qrVirtualStationId: stationId
      }));
    }

    // Return the new sheet mode
    return "detail";
  }

  /**
   * Confirm station selection and advance the booking step
   * @returns The new sheet mode
   */
  public confirmStationSelection(): SheetMode {
    const step = this.getCurrentStep();
    
    // For example: if step 2 is confirmed, move on to step 3
    if (step === 2) {
      store.dispatch(advanceBookingStep(3));
      toast.success("Departure confirmed! Now choose your arrival station.");
    }
    
    return "guide";
  }

  /**
   * Handle a successful QR scan for a car
   * @param car The car scanned
   * @returns The new sheet mode
   */
  public handleQrScanSuccess(car: Car): SheetMode {
    if (!car) return "guide";
    console.log("[stationSelectionManager] handleQrScanSuccess with car ID:", car.id);

    // Get current state to check for existing QR station
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;

    // Clear any departure/arrival stations and routes
    store.dispatch(clearDepartureStation());
    store.dispatch(clearArrivalStation());
    store.dispatch(clearDispatchRoute());
    store.dispatch(clearRoute());

    // Clean up previous QR station if it exists
    if (isQrScanStation && virtualStationId) {
      console.log(`[stationSelectionManager] Removing previous QR station ${virtualStationId}`);
      store.dispatch(removeStation(virtualStationId));
      store.dispatch(clearQrStationData());
    }

    // Create a new virtual station with a timestamp-based ID
    const vStationId = Date.now();
    const virtualStation = createVirtualStationFromCar(car, vStationId);
    console.log(`[stationSelectionManager] Created new virtual station ${vStationId} for car ${car.id}`);

    // Add the virtual station and mark as QR station
    store.dispatch(addVirtualStation(virtualStation));
    store.dispatch(setQrStationData({
      isQrScanStation: true,
      qrVirtualStationId: vStationId
    }));

    // Set as departure and advance to step 2
    store.dispatch(selectDepartureStation(vStationId));
    store.dispatch(advanceBookingStep(2));
    
    // Set the car in the car slice so other components can access it
    store.dispatch(setScannedCar(car));

    // Track the car ID we processed
    this.processedCarIdRef = car.id;
    
    toast.success(`${car.model || 'Car'} ${car.registration || car.id} selected as departure`);
    return "detail";
  }

  /**
   * Reset the booking flow for a new QR scan
   */
  public resetBookingFlowForQrScan(): void {
    const state = store.getState();
    const virtualStationId = state.booking.qrVirtualStationId;
    
    store.dispatch(resetBookingFlow());
    store.dispatch(clearDispatchRoute());
    store.dispatch(clearRoute());

    if (virtualStationId !== null) {
      store.dispatch(removeStation(virtualStationId));
      store.dispatch(clearQrStationData());
    }
    store.dispatch(setScannedCar(null));
    this.processedCarIdRef = null;
  }

  /**
   * Clear the departure station
   * @returns The new sheet mode
   */
  public clearDepartureStation(): SheetMode {
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    
    store.dispatch(clearDepartureStation());
    store.dispatch(advanceBookingStep(1));
    store.dispatch(clearDispatchRoute());
    
    if (isQrScanStation && virtualStationId !== null) {
      store.dispatch(removeStation(virtualStationId));
      store.dispatch(clearQrStationData());
      store.dispatch(setScannedCar(null));
      this.processedCarIdRef = null;
    }
    
    toast.success("Departure station cleared. Back to picking departure.");
    return "guide";
  }

  /**
   * Clear the arrival station
   * @returns The new sheet mode
   */
  public clearArrivalStation(): SheetMode {
    store.dispatch(clearArrivalStation());
    store.dispatch(advanceBookingStep(3));
    store.dispatch(clearRoute());
    
    toast.success("Arrival station cleared. Back to picking arrival.");
    return "guide";
  }

  /**
   * Sort stations by distance to a point
   */
  public sortStationsByDistanceToPoint(
    point: google.maps.LatLngLiteral, 
    stationsToSort: StationFeature[]
  ): StationFeature[] {
    if (!window.google?.maps?.geometry?.spherical) {
      return stationsToSort;
    }
    
    try {
      const newStations = [...stationsToSort];
      newStations.sort((a, b) => {
        const [lngA, latA] = a.geometry.coordinates;
        const [lngB, latB] = b.geometry.coordinates;
        const distA = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(latA, lngA),
          new window.google.maps.LatLng(point.lat, point.lng)
        );
        const distB = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(latB, lngB),
          new window.google.maps.LatLng(point.lat, point.lng)
        );
        return distA - distB;
      });
      return newStations;
    } catch (error) {
      console.error("Error sorting stations by distance:", error);
      return stationsToSort;
    }
  }

  /**
   * Get all stations sorted by distance to a reference location
   */
  public getSortedStations(referenceLocation?: google.maps.LatLngLiteral | null): StationFeature[] {
    const stations = selectStationsWithDistance(store.getState());
    
    if (!referenceLocation) {
      return stations;
    }
    
    return this.sortStationsByDistanceToPoint(referenceLocation, stations);
  }
}

// Export a singleton instance
export default StationSelectionManager.getInstance();