import { store } from "@/store/store";
import type { StationFeature } from "@/store/stationsSlice";
import {
  selectStationsWithDistance,
  removeStation,
  addVirtualStation,
} from "@/store/stationsSlice";
import { logger } from "@/lib/logger";

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
import { clearWalkingRoute, setListSelectedStation } from "@/store/userSlice";
import { setSheetMode, setSheetMinimized } from "@/store/uiSlice";
import { toast } from "react-hot-toast";
import { createVirtualStationFromCar } from "./stationUtils";
import type { Car } from "../types/cars";
import cameraAnimationManager from "./cameraAnimationManager";

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
   * 
   * IMPORTANT: For camera animations to work correctly, cameraControls must be provided.
   * The preferred approach is to use the global instance from useCameraAnimation.getGlobalCameraControls()
   * 
   * @param stationId The station ID to select
   * @param viaScan Whether this selection is via QR scan (default: false)
   * @param cameraControls Camera controls instance from useCameraAnimation hook
   */
  public selectStation(stationId: number, viaScan = false, cameraControls?: any): void {
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
    
    logger.info(`[stationSelectionManager] Selecting station ${stationId}, isVirtual: ${isSelectedStationVirtual}, step: ${step}`);

    // OPTIMIZATION: Batch all Redux updates to reduce re-renders
    batch(() => {
      // Always clear any active walking route when selecting a station
      store.dispatch(clearWalkingRoute());
      logger.debug('[stationSelectionManager] Cleared walking route upon station selection');

      // If the selected station is a virtual car station, always mark it as the QR station
      if (isSelectedStationVirtual) {
        logger.debug(`[stationSelectionManager] Setting QR station data for ${stationId}`);
        store.dispatch(setQrStationData({
          isQrScanStation: true,
          qrVirtualStationId: stationId
        }));
      }

      // If we have both a current QR station AND a new QR station being selected, 
      // remove the old one if they're different
      if (isQrScanStation && virtualStationId && isSelectedStationVirtual && stationId !== virtualStationId) {
        logger.debug(`[stationSelectionManager] Replacing old QR station ${virtualStationId} with new one ${stationId}`);
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
          logger.debug(`[stationSelectionManager] Step ${step}: Regular station selected, clearing QR station ${virtualStationId}`);
          store.dispatch(clearDepartureStation());
          store.dispatch(removeStation(virtualStationId));
          store.dispatch(clearQrStationData());
          store.dispatch(setScannedCar(null));
          this.processedCarIdRef = null;
        } else {
          logger.debug(`[stationSelectionManager] Step ${step}: Keeping QR departure station ${virtualStationId}`);
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

      // Simply clear the list selected station when any station selection occurs
      // This ensures the NEAREST marker doesn't remain visible when a station is selected
      store.dispatch(setListSelectedStation(null));
      
      // Update UI state in Redux
      store.dispatch(setSheetMode("detail"));
      store.dispatch(setSheetMinimized(false));
    });
    
    // Get coordinates before animation to prevent Redux access during animation
    const selectedStationCoords = selectedStation?.geometry.coordinates;
    
    if (!selectedStationCoords) {
      logger.warn(`[stationSelectionManager] Cannot animate to station ${stationId} - coordinates not found`);
      return;
    }
    
    // Trigger camera animation based on the booking step
    if (step <= 2) {
      // For steps 1-2, we're selecting a departure station
      // Using direct coordinates instead of station ID for better performance
      cameraAnimationManager.animateToStationCoordinates(
        selectedStationCoords,
        stationId,
        {
          zoom: 16,
          tilt: 45,
          duration: 800
        },
        cameraControls
      );
    } else {
      // For steps 3-4, we're selecting an arrival station
      // Using direct coordinates instead of station ID for better performance
      cameraAnimationManager.animateToStationCoordinates(
        selectedStationCoords,
        stationId,
        {
          zoom: 16,
          tilt: 45,
          duration: 800
        },
        cameraControls
      );
    }
    
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
   * 
   * @param cameraControls Optional camera controls from useCameraAnimation hook
   */
  public confirmStationSelection(cameraControls?: any): void {
    const { batch } = require('react-redux');
    
    const state = store.getState();
    const step = state.booking.step;
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;
    
    logger.debug(`[stationSelectionManager] Confirming selection at step ${step}`);
    logger.debug(`[stationSelectionManager] isQrScanStation=${isQrScanStation}, virtualStationId=${virtualStationId}`);

    batch(() => {
      // For step 2, just show date picker without advancing to step 3
      if (step === 2) {
        // Make sure QR station data is preserved
        if (isQrScanStation && virtualStationId && departureStationId === virtualStationId) {
          logger.debug(`[stationSelectionManager] Preserving QR station data for ${virtualStationId}`);
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
    
    // After confirming, do a small camera animation to emphasize the selected station
    if (departureStationId && step === 2) {
      // Get all stations from state
      const stations = selectStationsWithDistance(state);
      
      // Find the departure station
      const departureStation = stations.find(s => s.id === departureStationId);
      
      if (departureStation) {
        const [lng, lat] = departureStation.geometry.coordinates;
        
        // Use camera animation manager with direct coordinates
        // This prevents Redux access during animation for better performance
        cameraAnimationManager.animateToStationCoordinates(
          departureStation.geometry.coordinates,
          departureStationId,
          {
            zoom: 17, // Slightly zoomed in for emphasis
            tilt: 45,
            duration: 1000,
            onComplete: () => {
              logger.debug(`[stationSelectionManager] Confirmation highlight animation complete`);
            }
          },
          cameraControls
        );
      }
    }
  }

  /**
   * Handle a successful QR scan for a car
   * @param car The car scanned
   * @param cameraControls Optional camera controls from useCameraAnimation hook
   */
  public handleQrScanSuccess(car: Car, cameraControls?: any): void {
    if (!car) return;
    
    const { batch } = require('react-redux');
    logger.info("[stationSelectionManager] handleQrScanSuccess with car ID:", car.id);

    // Get current state to check for existing QR station
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;

    // Create a new virtual station with a timestamp-based ID
    const vStationId = Date.now();
    const virtualStation = createVirtualStationFromCar(car, vStationId);
    logger.debug(`[stationSelectionManager] Created new virtual station ${vStationId} for car ${car.id}`);

    // Get coordinates for animation
    const coordinates = virtualStation.geometry.coordinates;
    const [lng, lat] = coordinates;

    batch(() => {
      // Clear any departure/arrival stations and routes
      store.dispatch(clearDepartureStation());
      store.dispatch(clearArrivalStation());
      store.dispatch(clearDispatchRoute());
      store.dispatch(clearRoute());
  
      // Clean up previous QR station if it exists
      if (isQrScanStation && virtualStationId) {
        logger.debug(`[stationSelectionManager] Removing previous QR station ${virtualStationId}`);
        store.dispatch(removeStation(virtualStationId));
        store.dispatch(clearQrStationData());
      }
  
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

    // Animate to the virtual station using direct coordinates
    // This prevents possible Redux access during the animation
    cameraAnimationManager.animateToLocation(
      { lat, lng },
      {
        zoom: 17, // Higher zoom for QR scanned car
        tilt: 45,
        duration: 800
      },
      cameraControls
    );

    // Track the car ID we processed
    this.processedCarIdRef = car.id;
    
    toast.success(`${car.model || 'Car'} ${car.registration || car.id} selected as departure`);
  }

  /**
   * Reset the booking flow for a new QR scan
   * 
   * @param cameraControls Optional camera controls from useCameraAnimation hook
   */
  public resetBookingFlowForQrScan(cameraControls?: any): void {
    const state = store.getState();
    const virtualStationId = state.booking.qrVirtualStationId;
    
    const { batch } = require('react-redux');
    
    batch(() => {
      store.dispatch(resetBookingFlow());
      store.dispatch(clearDispatchRoute());
      store.dispatch(clearRoute());
  
      if (virtualStationId !== null) {
        store.dispatch(removeStation(virtualStationId));
        store.dispatch(clearQrStationData());
      }
      store.dispatch(setScannedCar(null));
      this.processedCarIdRef = null;
    });
    
    // Reset camera to default view using the camera animation manager
    cameraAnimationManager.resetCamera({
      zoom: 14,
      duration: 800
    }, cameraControls);
  }

  /**
   * Clear the departure station
   * 
   * @param cameraControls Optional camera controls from useCameraAnimation hook
   */
  public clearDepartureStation(cameraControls?: any): void {
    const { batch } = require('react-redux');
    const state = store.getState();
    const isQrScanStation = state.booking.isQrScanStation;
    const virtualStationId = state.booking.qrVirtualStationId;
    const departureStationId = state.booking.departureStationId;
    
    // Proceed with clearing the station state
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
      
      // IMPORTANT: Clear the list selected station to make the NEAREST marker collapse
      store.dispatch(setListSelectedStation(null));
      
      // Update UI state in Redux
      store.dispatch(setSheetMode("guide"));
      store.dispatch(setSheetMinimized(false));
    });
    
    // After clearing the station in Redux, trigger a camera reset animation
    cameraAnimationManager.onDepartureStationCleared(cameraControls);
    
    toast.success("Departure station cleared. Back to picking departure.");
  }

  /**
   * Clear the arrival station
   * 
   * @param cameraControls Optional camera controls from useCameraAnimation hook
   */
  public clearArrivalStation(cameraControls?: any): void {
    const { batch } = require('react-redux');
    const state = store.getState();
    const arrivalStationId = state.booking.arrivalStationId;
    const departureStationId = state.booking.departureStationId;
    
    batch(() => {
      store.dispatch(clearArrivalStation());
      store.dispatch(advanceBookingStep(3));
      store.dispatch(clearRoute());
      
      // IMPORTANT: Clear the list selected station to make the NEAREST marker collapse
      store.dispatch(setListSelectedStation(null));
      
      // Update UI state in Redux
      store.dispatch(setSheetMode("guide"));
      store.dispatch(setSheetMinimized(false));
    });
    
    // After clearing the station in Redux, use the camera animation manager to handle animation
    cameraAnimationManager.onArrivalStationCleared(departureStationId, cameraControls);
    
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
    logger.info("[stationSelectionManager] Processing QR code:", qrCodeValue);
    
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
      logger.debug("[stationSelectionManager] Extracted car registration:", registration);

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
      logger.error("[stationSelectionManager] Error processing QR code:", error);
      return {
        success: false,
        message: "Failed to process the car QR code"
      };
    }
  }
}

// Export a singleton instance
export default StationSelectionManager.getInstance();