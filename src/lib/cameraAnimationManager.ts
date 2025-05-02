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
  private sheetHeight: number = 0;
  private mapHeight: number = 0;
  private map: google.maps.Map | null = null;
  
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
  public initialize(controls: any, map?: google.maps.Map): void {
    if (!this.cameraControls) {
      this.cameraControls = controls;
      if (map) this.map = map;
      logger.debug("[CameraAnimationManager] Initialized with controls");
    }
  }

  /**
   * Update viewport metrics to adjust camera positioning
   */
  public updateViewportMetrics(sheetHeight: number, mapHeight: number, map?: google.maps.Map): void {
    this.sheetHeight = sheetHeight;
    this.mapHeight = mapHeight;
    if (map) this.map = map;
    logger.debug(`[CameraAnimationManager] Updated viewport metrics: sheet=${sheetHeight}px, map=${mapHeight}px`);
  }

  /**
   * Calculate a simple viewport offset to shift camera based on sheet height
   * This applies a simple "pixel shift" to the camera's center point
   */
  private getPanOffset(): number {
    // Use a more substantial fixed offset value
    const FIXED_OFFSET = 90; // Positive to pan camera downward, in pixels
    
    logger.debug(`[cameraAnimationManager] Using fixed offset: ${FIXED_OFFSET}px`);
    return FIXED_OFFSET;
  }
  
  /**
   * Simple passthrough function for completion handlers
   * (we no longer need post-animation offset since we're applying it directly)
   */
  private createCompletionWithPanOffset(originalOnComplete?: () => void): () => void {
    // Simply return the original handler or an empty function
    return originalOnComplete || (() => {});
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
    const position = { lat, lng };
    
    // Get the fixed offset value
    const pixelOffset = this.getPanOffset();
    
    // Calculate a consistent offset based on target zoom level
    let offsetPosition = { ...position };
    
    if (pixelOffset !== 0) {
      try {
        // Get the target zoom level
        const targetZoom = options?.zoom || 16;
        
        // Use a standard formula for meters per pixel at this zoom level
        // At zoom level 0, there are approximately 156,543 meters per pixel at the equator
        // Each zoom level divides this by 2
        const metersPerPixel = 156543.03392 * Math.cos(position.lat * Math.PI / 180) / Math.pow(2, targetZoom);
        
        // Convert meters to lat degrees (approximate)
        // 111,111 meters per degree of latitude (roughly)
        const latPerPixel = metersPerPixel / 111111;
        
        // Apply the offset with a scaling factor to ensure consistency
        // For downward shift (positive offset), we decrease latitude
        const scaledOffset = pixelOffset * 0.9; // Apply most of the offset
        offsetPosition.lat = position.lat - (scaledOffset * latPerPixel);
        
        logger.debug(`[cameraAnimationManager] Applied ${pixelOffset}px offset (scaled: ${scaledOffset}px) at zoom ${targetZoom} to station [${position.lat}] → [${offsetPosition.lat}]`);
      } catch (e) {
        logger.warn(`[cameraAnimationManager] Could not calculate lat/lng offset: ${e}`);
        // If calculation fails, use the original position
        offsetPosition = position;
      }
    }
    
    // Use the adjusted position directly for the animation
    controls.animateToStation({
      position: offsetPosition,
      zoom: options?.zoom || 16,
      tilt: options?.tilt || 45,
      duration: options?.duration || 800,
      onComplete: options?.onComplete // Use the original onComplete handler directly
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
    
    // Get the fixed offset value
    const pixelOffset = this.getPanOffset();
    
    // Calculate a consistent offset based on target zoom level
    let offsetLocation = { ...location };
    
    if (pixelOffset !== 0) {
      try {
        // Get the target zoom level
        const targetZoom = options?.zoom || 16;
        
        // Use a standard formula for meters per pixel at this zoom level
        // At zoom level 0, there are approximately 156,543 meters per pixel at the equator
        // Each zoom level divides this by 2
        const metersPerPixel = 156543.03392 * Math.cos(location.lat * Math.PI / 180) / Math.pow(2, targetZoom);
        
        // Convert meters to lat degrees (approximate)
        // 111,111 meters per degree of latitude (roughly)
        const latPerPixel = metersPerPixel / 111111;
        
        // Apply the offset with a scaling factor to ensure consistency
        // For downward shift (positive offset), we decrease latitude
        const scaledOffset = pixelOffset * 0.9; // Apply most of the offset
        offsetLocation.lat = location.lat - (scaledOffset * latPerPixel);
        
        logger.debug(`[cameraAnimationManager] Applied ${pixelOffset}px offset (scaled: ${scaledOffset}px) at zoom ${targetZoom} to location [${location.lat}] → [${offsetLocation.lat}]`);
      } catch (e) {
        logger.warn(`[cameraAnimationManager] Could not calculate lat/lng offset: ${e}`);
        // If calculation fails, use the original location
        offsetLocation = location;
      }
    }
    
    // Use the adjusted location directly instead of applying pan offset later
    controls.animateCameraTo({
      center: offsetLocation,
      zoom: options?.zoom || 15, // Default to zoom level 15 for a wider view
      tilt: options?.tilt || 0,  // Flat view for search results
      duration: options?.duration || 800,
      onComplete: options?.onComplete // Use the original onComplete handler directly
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
    
    // Get the fixed offset value
    const pixelOffset = this.getPanOffset();
    
    // For routes, we can't directly offset the center (since it's calculated from bounds)
    // Instead, we'll use additional padding to adjust the viewport
    let adjustedPadding = options?.padding || 100;
    
    // If we have a positive offset (moving view down), add a scaled version to the padding
    if (pixelOffset > 0) {
      // Use a more substantial padding adjustment
      const scaledPadding = Math.round(pixelOffset * 0.9);
      adjustedPadding = adjustedPadding + scaledPadding;
      logger.debug(`[cameraAnimationManager] Adjusted route padding to ${adjustedPadding}px to account for ${pixelOffset}px offset (scaled: ${scaledPadding}px)`);
    }
    
    // Use animateToRoute with adjusted padding
    controls.animateToRoute({
      start: { lat: depLat, lng: depLng },
      end: { lat: arrLat, lng: arrLng },
      padding: adjustedPadding,
      duration: options?.duration || 800,
      onComplete: options?.onComplete // Use the original onComplete handler directly
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
    
    // Get the pan offset based on sheet height and log it
    const panOffset = this.getPanOffset();
    logger.debug(`[cameraAnimationManager] Creating circular animation around [${location.lat}, ${location.lng}] with sheet offset: ${panOffset}px`);
    
    // Create a completion handler that applies the pan offset
    const onCompleteWithPan = this.createCompletionWithPanOffset(options?.onComplete);
    
    // Use circleAroundPoint for orbital animations
    controls.circleAroundPoint({
      center: location,
      radius: options?.radius || 100,
      duration: options?.duration || 6000,
      revolutions: options?.revolutions || 1,
      zoom: options?.zoom || 18,
      tilt: options?.tilt || 45,
      onComplete: onCompleteWithPan
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
      zoom: 15,  // Lower zoom level to show more context around the search location
      tilt: 0,   // Flat view for search results
      duration: 800
    }, cameraControls);
  }

  /**
   * Handle when user presses the Locate Me button
   */
  public onLocateMePressed(location: LatLngLiteral, cameraControls?: any): void {
    this.animateToLocation(location, {
      zoom: 15,  // Lower zoom level to show more area around user
      tilt: 0,   // Flat view for user location
      duration: 800
    }, cameraControls);
  }
}

// Export the singleton instance
export default CameraAnimationManager.getInstance();