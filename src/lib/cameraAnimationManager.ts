"use client";

import { useCameraAnimation } from "@/hooks/useCameraAnimation";
import { store } from "@/store/store";
import { selectStationsWithDistance } from "@/store/stationsSlice";
import type { StationFeature } from "@/store/stationsSlice";
// Use Google Maps’ built‑in LatLngLiteral to avoid missing‑type errors
type LatLngLiteral = google.maps.LatLngLiteral;
import { logger } from "@/lib/logger";

/**
 * CameraAnimationManager
 * 
 * A centralized manager for all map camera animations in the application.
 * This singleton coordinates camera movements for all six key scenarios:
 * 1. Departure station selection
 * 2. Arrival station selection
 * 3. Departure station cleared
 * 4. Arrival station cleared
 * 5. User search location
 * 6. User pressing "Locate Me" button
 */
class CameraAnimationManager {
  private static instance: CameraAnimationManager;
  private cameraControls: any = null;
  
  private constructor() {
    // We'll set up the controls when needed
  }
  
  public static getInstance(): CameraAnimationManager {
    if (!CameraAnimationManager.instance) {
      CameraAnimationManager.instance = new CameraAnimationManager();
    }
    return CameraAnimationManager.instance;
  }
  
  // Method to initialize controls
  public initialize(controls: any): void {
    if (!this.cameraControls) {
      this.cameraControls = controls;
      logger.debug("[CameraAnimationManager] Initialized with controls");
    }
  }

  /**
   * Get camera controls, either from provided instance or stored instance
   */
  private getCameraControls(externalControls?: any): any {
    // Use provided controls if available, otherwise use the stored instance
    const controls = externalControls || this.cameraControls;
    
    if (!controls) {
      logger.warn("[cameraAnimationManager] No camera controls available - animation will not work");
      return null;
    }
    
    if (!controls.animateCameraTo) {
      logger.warn("[cameraAnimationManager] Camera controls missing required methods");
      logger.debug("Available methods:", Object.keys(controls).join(", "));
      return null;
    }
    
    return controls;
  }

  /**
   * Find a station by ID from the Redux store
   */
  private findStationById(stationId: number): StationFeature | null {
    const state = store.getState();
    const stations = selectStationsWithDistance(state);
    return stations.find(s => s.id === stationId) || null;
  }

  /**
   * Animate directly to station coordinates without requiring Redux lookup during animation
   */
  public animateToStationCoordinates(
    coordinates: [number, number],
    stationId: number, // Keep for logging purposes only
    options?: { 
      zoom?: number; 
      tilt?: number; 
      duration?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    const controls = this.getCameraControls(cameraControls);
    if (!controls) return;
    
    const [lng, lat] = coordinates;
    
    logger.debug(`[cameraAnimationManager] Animating to station ${stationId} at [${lat}, ${lng}]`);
    
    // Note: We don't need to check isAnimating here
    // The underlying useCameraAnimation hook will handle this
    
    // Use animateToStation for station views with appropriate defaults
    controls.animateToStation({
      position: { lat, lng },
      zoom: options?.zoom || 16,
      tilt: options?.tilt || 45,
      duration: options?.duration || 800,
      onComplete: options?.onComplete
    });
  }

  /**
   * Animate to a selected station (departure or arrival)
   * This is a wrapper that performs Redux lookup before animation 
   */
  public animateToSelectedStation(
    stationId: number, 
    options?: { 
      zoom?: number; 
      tilt?: number; 
      duration?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    // Find station data BEFORE starting animation
    const station = this.findStationById(stationId);
    if (!station) return;
    
    // Pass the coordinates directly to avoid Redux lookup during animation
    this.animateToStationCoordinates(
      station.geometry.coordinates,
      stationId,
      options,
      cameraControls
    );
  }

  /**
   * Reset camera to default view
   */
  public resetCamera(
    options?: {
      center?: LatLngLiteral;
      zoom?: number;
      duration?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    const controls = this.getCameraControls(cameraControls);
    if (!controls) return;
    
    // Note: We don't need to check isAnimating here
    // The underlying useCameraAnimation hook will handle this
    
    logger.debug(`[cameraAnimationManager] Resetting camera view`);
    
    // Use resetCamera with default parameters
    controls.resetCamera({
      center: options?.center,
      zoom: options?.zoom || 14,
      duration: options?.duration || 800,
      onComplete: options?.onComplete
    });
  }

  /**
   * Animate to user location or search location
   */
  public animateToLocation(
    location: LatLngLiteral,
    options?: {
      zoom?: number;
      tilt?: number;
      duration?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    const controls = this.getCameraControls(cameraControls);
    if (!controls || !location) return;
    
    // Note: We don't need to check isAnimating here
    // The underlying useCameraAnimation hook will handle this
    
    logger.debug(`[cameraAnimationManager] Animating to location [${location.lat}, ${location.lng}]`);
    
    // Use animateCameraTo for general location views
    controls.animateCameraTo({
      center: location,
      zoom: options?.zoom || 16,
      tilt: options?.tilt || 0, // Flat view for search results
      duration: options?.duration || 800,
      onComplete: options?.onComplete
    });
  }

  /**
   * Animate to show a route between two stations
   */
  public animateToShowRoute(
    departureStationId: number,
    arrivalStationId: number,
    options?: {
      padding?: number;
      duration?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    const controls = this.getCameraControls(cameraControls);
    if (!controls) return;
    
    const departureStation = this.findStationById(departureStationId);
    const arrivalStation = this.findStationById(arrivalStationId);
    
    if (!departureStation || !arrivalStation) return;
    
    const [depLng, depLat] = departureStation.geometry.coordinates;
    const [arrLng, arrLat] = arrivalStation.geometry.coordinates;
    
    // Note: We don't need to check isAnimating here
    // The underlying useCameraAnimation hook will handle this
    
    logger.debug(`[cameraAnimationManager] Animating to show route between stations ${departureStationId} and ${arrivalStationId}`);
    
    // Use animateToRoute for showing both points
    controls.animateToRoute({
      start: { lat: depLat, lng: depLng },
      end: { lat: arrLat, lng: arrLng },
      padding: options?.padding || 100,
      duration: options?.duration || 800,
      onComplete: options?.onComplete
    });
  }

  /**
   * Create a circular animation around a point (e.g., for highlighting)
   */
  public circleAroundPoint(
    location: LatLngLiteral,
    options?: {
      radius?: number;
      duration?: number;
      revolutions?: number;
      zoom?: number;
      tilt?: number;
      onComplete?: () => void;
    },
    cameraControls?: any
  ): void {
    const controls = this.getCameraControls(cameraControls);
    if (!controls || !location) return;
    
    // Note: We don't need to check isAnimating here
    // The underlying useCameraAnimation hook will handle this
    
    logger.debug(`[cameraAnimationManager] Creating circular animation around [${location.lat}, ${location.lng}]`);
    
    // Use circleAroundPoint for orbital animations
    controls.circleAroundPoint({
      center: location,
      radius: options?.radius || 100,
      duration: options?.duration || 6000,
      revolutions: options?.revolutions || 1,
      zoom: options?.zoom || 18,
      tilt: options?.tilt || 45,
      onComplete: options?.onComplete
    });
  }

  /**
   * Handle when a departure station is selected
   */
  public onDepartureStationSelected(stationId: number, cameraControls?: any): void {
    // Pre-fetch the station data before animation
    const station = this.findStationById(stationId);
    if (!station) return;
    
    // Use the coordinates directly instead of passing the ID
    this.animateToStationCoordinates(
      station.geometry.coordinates,
      stationId,
      {
        zoom: 16,
        tilt: 45,
        duration: 800
      }, 
      cameraControls
    );
  }

  /**
   * Handle when an arrival station is selected
   */
  public onArrivalStationSelected(stationId: number, cameraControls?: any): void {
    // Pre-fetch the station data before animation
    const station = this.findStationById(stationId);
    if (!station) return;
    
    // Use the coordinates directly instead of passing the ID
    this.animateToStationCoordinates(
      station.geometry.coordinates,
      stationId,
      {
        zoom: 16,
        tilt: 45,
        duration: 800
      }, 
      cameraControls
    );
  }

  /**
   * Handle when a departure station is cleared
   */
  public onDepartureStationCleared(cameraControls?: any): void {
    this.resetCamera({
      zoom: 14,
      duration: 800
    }, cameraControls);
  }

  /**
   * Handle when an arrival station is cleared
   */
  public onArrivalStationCleared(departureStationId: number | null, cameraControls?: any): void {
    // If there's a departure station, animate back to it
    if (departureStationId) {
      // Pre-fetch the station data before animation
      const station = this.findStationById(departureStationId);
      if (!station) return;
      
      // Use the coordinates directly instead of passing the ID
      this.animateToStationCoordinates(
        station.geometry.coordinates,
        departureStationId,
        {
          zoom: 16,
          tilt: 45,
          duration: 800
        }, 
        cameraControls
      );
    } else {
      // Otherwise reset to default view
      this.resetCamera({
        zoom: 14,
        duration: 800
      }, cameraControls);
    }
  }

  /**
   * Handle when a user searches for a location
   */
  public onLocationSearch(location: LatLngLiteral, cameraControls?: any): void {
    this.animateToLocation(location, {
      zoom: 16,
      tilt: 0, // Flat view for search results
      duration: 800
    }, cameraControls);
  }

  /**
   * Handle when user presses the Locate Me button
   */
  public onLocateMePressed(location: LatLngLiteral, cameraControls?: any): void {
    this.animateToLocation(location, {
      zoom: 16,
      tilt: 0, // Flat view for user location
      duration: 800
    }, cameraControls);
  }
}

// Export the singleton instance
export default CameraAnimationManager.getInstance();