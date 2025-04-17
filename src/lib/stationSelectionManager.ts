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
import { setScannedCar, fetchCarByRegistration } from "@/store/carSlice";
import { clearWalkingRoute } from "@/store/userSlice";
import { setSheetMode, setSheetMinimized, setListSelectedStation } from "@/store/uiSlice";
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
   */
  public selectStation(stationId: number, viaScan = false): void {
    // Import batch from react-redux to batch multiple updates together
    // This is important to prevent multiple re-renders
    const { batch } = require('react-redux');
    
    const state = store.getState();
    const step = state.booking.step;
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;

    // Get the station object to check if selected station is a virtual car station
    const stations = selectStationsWithDistance(state);
    const selectedStation = stations.find(s => s.id === stationId);
    const isSelectedStationVirtual = selectedStation?.properties?.isVirtualCarLocation === true;
    
    console.log(`[stationSelectionManager] Selecting station ${stationId}, isVirtual: ${isSelectedStationVirtual}, step: ${step}`);

    // OPTIMIZATION: Batch all Redux updates to reduce re-renders
    batch(() => {
      // Always clear any active walking route when selecting a station
      store.dispatch(clearWalkingRoute());
      console.log('[stationSelectionManager] Cleared walking route upon station selection');

      // If the selected station is a virtual car station, always mark it as the QR station
      if (isSelectedStationVirtual) {
        console.log(`[stationSelectionManager] Setting QR station data for ${stationId}`);
        store.dispatch(setQrStationData({
          isQrScanStation: true,
          qrVirtualStationId: stationId
        }));
      }

      // If we have both a current QR station AND a new QR station being selected, 
      // remove the old one if they're different
      if (isQrScanStation && virtualStationId && isSelectedStationVirtual && stationId !== virtualStationId) {
        console.log(`[stationSelectionManager] Replacing old QR station ${virtualStationId} with new one ${stationId}`);
        // Only clear departure if we're in step 1-2
        if (step <= 2) {
          store.dispatch(clearDepartureStation());
        }
        store.dispatch(removeStation(virtualStationId));
        store.dispatch(setQrStationData({
          isQrScanStation: true,
          qrVirtualStationId: stationId
        }));
        store.dispatch(setScannedCar(null));
        this.processedCarIdRef = null;
      }
      
      // ONLY remove QR station data if selecting a regular station in step 1-2
      // In steps 3-4, we need to keep the departure station intact
      if (!isSelectedStationVirtual && isQrScanStation && virtualStationId) {
        if (step <= 2) {
          console.log(`[stationSelectionManager] Step ${step}: Regular station selected, clearing QR station ${virtualStationId}`);
          store.dispatch(clearDepartureStation());
          store.dispatch(removeStation(virtualStationId));
          store.dispatch(clearQrStationData());
          store.dispatch(setScannedCar(null));
          this.processedCarIdRef = null;
        } else {
          console.log(`[stationSelectionManager] Step ${step}: Keeping QR departure station ${virtualStationId}`);
          // In steps 3-4, we want to KEEP the QR station as departure
          // Just make sure state is consistent
          if (departureStationId === virtualStationId) {
            store.dispatch(setQrStationData({
              isQrScanStation: true,
              qrVirtualStationId: virtualStationId
            }));
          }
        }
      }

      // Step logic - CRUCIAL CHANGE: handle selection based on step without resetting
      if (step === 1) {
        store.dispatch(selectDepartureStation(stationId));
        store.dispatch(advanceBookingStep(2));
      } else if (step === 2) {
        store.dispatch(selectDepartureStation(stationId));
      } else if (step === 3) {
        // For step 3, we're selecting an arrival station - DO NOT reset QR departure station
        store.dispatch(selectArrivalStation(stationId));
        store.dispatch(advanceBookingStep(4));
      } else if (step === 4) {
        // For step 4, we're re-selecting an arrival station - DO NOT reset QR departure station
        store.dispatch(selectArrivalStation(stationId));
      }

      // Update list selected station in Redux
      store.dispatch(setListSelectedStation(stationId));
      
      // Update UI state in Redux
      store.dispatch(setSheetMode("detail"));
      store.dispatch(setSheetMinimized(false));
    });
    
    // Show toast notifications outside the batch to avoid delaying state updates
    if (step === 1) {
      toast.success("Departure station selected!");
    } else if (step === 2) {
      toast.success("Departure station re-selected!");
    } else if (step === 3) {
      toast.success("Arrival station selected!");
    } else if (step === 4) {
      toast.success("Arrival station re-selected!");
    } else {
      toast(`Station tapped, but no action at step ${step}`);
    }
  }

  /**
   * Confirm station selection but don't advance booking step anymore
   */
  public confirmStationSelection(): void {
    const { batch } = require('react-redux');
    
    const state = store.getState();
    const step = state.booking.step;
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;
    
    console.log(`[stationSelectionManager] Confirming selection at step ${step}`);
    console.log(`[stationSelectionManager] isQrScanStation=${isQrScanStation}, virtualStationId=${virtualStationId}`);

    batch(() => {
      // For step 2, just show date picker without advancing to step 3
      if (step === 2) {
        // Make sure QR station data is preserved
        if (isQrScanStation && virtualStationId && departureStationId === virtualStationId) {
          console.log(`[stationSelectionManager] Preserving QR station data for ${virtualStationId}`);
          // Re-set the QR station data to ensure it's not lost
          store.dispatch(setQrStationData({
            isQrScanStation: true,
            qrVirtualStationId: virtualStationId
          }));
        }
        
        // Update UI state in Redux
        store.dispatch(setSheetMode("guide"));
        store.dispatch(setSheetMinimized(false));
        
        // No more advancing to step 3 here - will be done after date/time selection
        toast.success("Please select date and time");
      }
    });
  }

  /**
   * Handle a successful QR scan for a car
   * @param car The car scanned
   */
  public handleQrScanSuccess(car: Car): void {
    if (!car) return;
    
    const { batch } = require('react-redux');
    console.log("[stationSelectionManager] handleQrScanSuccess with car ID:", car.id);

    // Get current state to check for existing QR station
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;

    batch(() => {
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
  
      // Update UI state in Redux
      store.dispatch(setSheetMode("detail"));
      store.dispatch(setSheetMinimized(false));
    });

    // Track the car ID we processed
    this.processedCarIdRef = car.id;
    
    toast.success(`${car.model || 'Car'} ${car.registration || car.id} selected as departure`);
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
   */
  public clearDepartureStation(): void {
    const { batch } = require('react-redux');
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;
    
    // Check animation state before clearing
    const checkAnimationState = async (): Promise<boolean> => {
      const animationStateManager = (await import("./animationStateManager")).default;
      const animState = animationStateManager.getState();
      return animState.isAnimating && animState.targetId === departureStationId;
    };
    
    // Check if animation is in progress for this station
    checkAnimationState().then(isAnimating => {
      if (isAnimating) {
        // Don't allow clearing during animation
        toast.success("Please wait for animation to complete");
        return;
      }
      
      // Proceed with clearing if not animating
      batch(() => {
        store.dispatch(clearDepartureStation());
        store.dispatch(advanceBookingStep(1));
        store.dispatch(clearDispatchRoute());
        
        if (isQrScanStation && virtualStationId !== null) {
          store.dispatch(removeStation(virtualStationId));
          store.dispatch(clearQrStationData());
          store.dispatch(setScannedCar(null));
          this.processedCarIdRef = null;
        }
        
        // Update UI state in Redux
        store.dispatch(setSheetMode("guide"));
        store.dispatch(setSheetMinimized(false));
      });
      
      toast.success("Departure station cleared. Back to picking departure.");
    });
  }

  /**
   * Clear the arrival station
   */
  public clearArrivalStation(): void {
    const { batch } = require('react-redux');
    
    batch(() => {
      store.dispatch(clearArrivalStation());
      store.dispatch(advanceBookingStep(3));
      store.dispatch(clearRoute());
      
      // Update UI state in Redux
      store.dispatch(setSheetMode("guide"));
      store.dispatch(setSheetMinimized(false));
    });
    
    toast.success("Arrival station cleared. Back to picking arrival.");
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
  
  /**
   * Process a QR code and create a virtual station from the scanned vehicle
   * 
   * QR Flow Overview:
   * 1. QR code is scanned and contains a car registration ID
   * 2. The registration is extracted using regex pattern matching
   * 3. Car details are fetched from the API using fetchCarByRegistration
   * 4. A virtual station is created from the car using createVirtualStationFromCar
   * 5. Previous QR stations are cleaned up if they exist
   * 6. The virtual station is added to the stations slice
   * 7. The virtual station is marked as QR-based with isQrScanStation flag
   * 8. The station is set as the departure station and booking advances to step 2
   * 9. UI state is updated to show detail sheet mode
   * 
   * @param qrCodeValue The raw value from the QR code scan
   * @returns Promise containing { success: boolean, message: string, car?: Car }
   */
  public async processQrCode(qrCodeValue: string): Promise<{
    success: boolean;
    message: string;
    car?: Car;
  }> {
    console.log("[stationSelectionManager] Processing QR code:", qrCodeValue);
    
    try {
      // Extract the car registration from the code
      const match = qrCodeValue.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
      if (!match) {
        return { 
          success: false, 
          message: "Invalid QR code format" 
        };
      }

      const registration = match[1].toUpperCase();
      console.log("[stationSelectionManager] Extracted car registration:", registration);

      // Fetch the car from the backend
      const carResult = await store.dispatch(fetchCarByRegistration(registration)).unwrap();
      if (!carResult) {
        return { 
          success: false, 
          message: `Car ${registration} not found` 
        };
      }

      // Use the successful car scan result to create a virtual station
      this.handleQrScanSuccess(carResult);
      
      return {
        success: true,
        message: `Car ${registration} found!`,
        car: carResult
      };
    } catch (error) {
      console.error("[stationSelectionManager] Error processing QR code:", error);
      return {
        success: false,
        message: "Failed to process the car QR code"
      };
    }
  }
}

// Export a singleton instance
export default StationSelectionManager.getInstance();