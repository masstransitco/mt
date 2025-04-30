/**
 * Camera Animation Hook
 * 
 * This hook provides smooth camera animations for Google Maps.
 * Key features:
 * - Maintains a global singleton instance for shared access across components
 * - Provides methods for various camera movements (pan, zoom, route views)
 * - Cancels animations when user interaction is detected
 * - Works with stationSelectionManager for station-based animations
 * 
 * IMPORTANT: The global instance pattern is crucial for ensuring consistent 
 * animations across different UI components (markers, 3D buildings, etc.)
 */

import { useRef, useEffect, useCallback } from 'react';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';
// Local alias – we rely on the core Google Maps type instead of a custom one
type LatLngLiteral = google.maps.LatLngLiteral;
import { logger } from '@/lib/logger';

// We're removing the global variable pattern in favor of a more explicit singleton in CameraAnimationManager

// Constants for animation parameters
const ANIMATION_DEFAULTS = {
  duration: 800,      // Default duration in ms
  minDuration: 300,   // Minimum duration to ensure visibility
  maxDuration: 2000,  // Cap for very long distances
  zoomDefault: 16,    // Default zoom level for point focus
  tiltDefault: 0,     // Default tilt (overhead view)
  headingDefault: 0   // Default heading (north up)
};

/**
 * A simplified hook for animating the Google Maps camera
 */
export const useCameraAnimation = () => {
  const { map } = useGoogleMaps();
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  /**
   * Animates the camera to a new position with smooth transitions
   */
  const animateCameraTo = useCallback((
    options: {
      center?: LatLngLiteral;
      zoom?: number;
      tilt?: number;
      heading?: number;
      duration?: number;
      onComplete?: () => void;
    }
  ) => {
    if (!map || isAnimatingRef.current) return;
    
    const { 
      center, 
      zoom, 
      tilt, 
      heading, 
      duration = ANIMATION_DEFAULTS.duration,
      onComplete 
    } = options;
    
    const startTime = performance.now();
    const startCenter = map.getCenter()?.toJSON();
    const startZoom = map.getZoom();
    const startTilt = map.getTilt();
    const startHeading = map.getHeading();
    
    const targetCenter = center;
    const targetZoom = zoom !== undefined ? zoom : startZoom;
    const targetTilt = tilt !== undefined ? tilt : startTilt;
    const targetHeading = heading !== undefined ? heading : startHeading;
    
    isAnimatingRef.current = true;
    onCompleteCallbackRef.current = onComplete || null;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeOutCubic(progress);
      
      if (!startCenter && targetCenter) {
        // If no start center but we have a target, just set it directly
        map.setCenter(targetCenter);
      } else if (startCenter && targetCenter) {
        // Interpolate between start and target centers
        const currentLat = lerp(startCenter.lat, targetCenter.lat, easeProgress);
        const currentLng = lerp(startCenter.lng, targetCenter.lng, easeProgress);
        map.setCenter({ lat: currentLat, lng: currentLng });
      }
      
      if (startZoom !== undefined && targetZoom !== undefined) {
        const currentZoom = lerp(startZoom, targetZoom, easeProgress);
        map.setZoom(currentZoom);
      }
      
      if (startTilt !== undefined && targetTilt !== undefined) {
        const currentTilt = lerp(startTilt, targetTilt, easeProgress);
        map.setTilt(currentTilt);
      }
      
      if (startHeading !== undefined && targetHeading !== undefined) {
        let currentHeading;
        
        // Handle heading wrap-around (e.g., 350° to 10°)
        const headingDiff = ((targetHeading - startHeading + 540) % 360) - 180;
        currentHeading = (startHeading + headingDiff * easeProgress + 360) % 360;
        
        map.setHeading(currentHeading);
      }
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        
        // Call onComplete callback if provided
        if (onCompleteCallbackRef.current) {
          onCompleteCallbackRef.current();
          onCompleteCallbackRef.current = null;
        }
      }
    };
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      onCompleteCallbackRef.current = null;
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Return true if animation started successfully
    return true;
  }, [map]);
  
  /**
   * Creates a circular animation around a point
   */
  const circleAroundPoint = useCallback((
    options: {
      center: LatLngLiteral;
      radius?: number;
      duration?: number;
      revolutions?: number;
      zoom?: number;
      tilt?: number;
      onComplete?: () => void;
    }
  ) => {
    if (!map || isAnimatingRef.current) return false;
    
    const { 
      center, 
      radius = 100, 
      duration = 6000, 
      revolutions = 1,
      zoom = 18,
      tilt = 45,
      onComplete
    } = options;
    
    const startTime = performance.now();
    
    // Set initial position
    map.setZoom(zoom);
    map.setTilt(tilt);
    
    isAnimatingRef.current = true;
    onCompleteCallbackRef.current = onComplete || null;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate the angle in radians (2π × revolutions × progress)
      const angle = Math.PI * 2 * revolutions * progress;
      
      // Calculate offset position
      const offsetX = Math.sin(angle) * radius;
      const offsetY = Math.cos(angle) * radius;
      
      // Convert meters to approximate degrees
      const metersPerDegreeLatitude = 111320; // roughly 111,320 meters per degree latitude
      const metersPerDegreeLongitude = 111320 * Math.cos(center.lat * (Math.PI / 180));
      
      const newCenter = {
        lat: center.lat + (offsetY / metersPerDegreeLatitude),
        lng: center.lng + (offsetX / metersPerDegreeLongitude)
      };
      
      // Update heading to point toward the center
      const heading = (Math.atan2(center.lng - newCenter.lng, center.lat - newCenter.lat) * 180 / Math.PI) + 180;
      
      // Apply camera updates
      map.moveCamera({
        center: newCenter,
        heading: heading
      });
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        
        // Call onComplete callback if provided
        if (onCompleteCallbackRef.current) {
          onCompleteCallbackRef.current();
          onCompleteCallbackRef.current = null;
        }
      }
    };
    
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      onCompleteCallbackRef.current = null;
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Return true if animation started successfully
    return true;
  }, [map]);

  /**
   * Animates the camera to show a route (from start to end points)
   */
  const animateToRoute = useCallback((
    options: {
      start: LatLngLiteral;
      end: LatLngLiteral;
      padding?: number;
      duration?: number;
      onComplete?: () => void;
    }
  ) => {
    if (!map || isAnimatingRef.current) return false;
    
    const { 
      start, 
      end, 
      padding = 100, 
      duration = ANIMATION_DEFAULTS.duration,
      onComplete
    } = options;
    
    // Create bounds that include start and end points
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(start);
    bounds.extend(end);
    
    // Calculate center and zoom based on bounds
    const center = bounds.getCenter().toJSON();
    
    // Start animation
    return animateCameraTo({
      center,
      duration,
      zoom: getBoundsZoomLevel(bounds, {
        width: map.getDiv().clientWidth - padding * 2,
        height: map.getDiv().clientHeight - padding * 2
      }),
      tilt: 0, // Overhead view for routes
      heading: 0,
      onComplete
    });
  }, [map, animateCameraTo]);

  /**
   * Animates to a station with appropriate camera parameters
   * 
   * This method supports both newer and older parameter styles for backward compatibility
   */
  const animateToStation = useCallback((
    options: {
      position: LatLngLiteral;
      zoom?: number;
      tilt?: number;
      heading?: number;
      duration?: number;
      onComplete?: () => void;
    }
  ) => {
    if (!map || isAnimatingRef.current) return false;
    
    const { 
      position, 
      zoom = ANIMATION_DEFAULTS.zoomDefault, 
      tilt = 45,  // Use tilt for stations to show 3D buildings
      heading = ANIMATION_DEFAULTS.headingDefault,
      duration = ANIMATION_DEFAULTS.duration,
      onComplete
    } = options;
    
    return animateCameraTo({
      center: position,
      zoom,
      tilt,
      heading,
      duration,
      onComplete
    });
  }, [map, animateCameraTo]);
  
  /**
   * Animate directly to coordinates without accessing Redux during animation
   */
  const flyToCoordinates = useCallback((
    coordinates: [number, number],
    tilt = 45
  ) => {
    if (!map || isAnimatingRef.current) return false;
    
    try {
      const [lng, lat] = coordinates;
      return animateCameraTo({
        center: { lat, lng },
        zoom: 15, 
        tilt,
        heading: 0,
        duration: 1000
      });
    } catch (error) {
      logger.error("[useCameraAnimation] Error in flyToCoordinates:", error);
      return false;
    }
  }, [map, animateCameraTo]);

  // Simplified flyToStation - only needed for backward compatibility
  // This version now separates Redux access from animation execution
  const flyToStation = useCallback((stationId: number, tilt = 45) => {
    if (!map) return false;
    
    // Get station details from store BEFORE animation starts
    try {
      const { store } = require('@/store/store');
      const { selectStationsWithDistance } = require('@/store/stationsSlice');
      const state = store.getState();
      const stations = selectStationsWithDistance(state);
      const station = stations.find(s => s.id === stationId);
      
      // Once we have the data, pass the coordinates directly to animation function
      if (station) {
        return flyToCoordinates(station.geometry.coordinates, tilt);
      }
    } catch (error) {
      logger.error("[useCameraAnimation] Error in flyToStation:", error);
    }
    
    return false;
  }, [map, flyToCoordinates]);

  /**
   * Reset the camera to a default view
   */
  const resetCamera = useCallback((
    options: {
      center?: LatLngLiteral;
      zoom?: number;
      duration?: number;
      onComplete?: () => void;
    } = {}
  ) => {
    if (!map || isAnimatingRef.current) return false;
    
    const { 
      center, 
      zoom = 14, 
      duration = 800,
      onComplete
    } = options;
    
    return animateCameraTo({
      center,
      zoom,
      tilt: 0,
      heading: 0,
      duration,
      onComplete
    });
  }, [map, animateCameraTo]);

  /**
   * Cancels any ongoing camera animation
   */
  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      isAnimatingRef.current = false;
      
      // Call onComplete callback if provided
      if (onCompleteCallbackRef.current) {
        onCompleteCallbackRef.current();
        onCompleteCallbackRef.current = null;
      }
      
      return true;
    }
    return false;
  }, []);

  // Create the return object with all methods
  const cameraControlsObj = {
    animateCameraTo,
    circleAroundPoint,
    animateToRoute,
    animateToStation,
    resetCamera,
    cancelAnimation,
    isAnimating: () => isAnimatingRef.current,
    // New optimized method for direct coordinate animations
    flyToCoordinates,
    // Global instance accessor - this provides compatibility with stationSelectionManager
    flyToStation
  };
  
  // Simply return the controls object - no longer using global variable
  return cameraControlsObj;
};

/**
 * Computes a zoom level that fits the given bounds inside the provided viewport
 * dimensions. Adapted from common Google Maps helper patterns.
 */
function getBoundsZoomLevel(
  bounds: google.maps.LatLngBounds,
  mapDim: { width: number; height: number }
): number {
  const WORLD_DIM = { width: 256, height: 256 };
  const ZOOM_MAX = 21;

  const latRad = (lat: number): number => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  };

  const zoom = (mapPx: number, worldPx: number, fraction: number): number =>
    Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();

  const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;
  const lngDiff = ne.lng() - sw.lng();
  const lngFraction = ((lngDiff < 0 ? lngDiff + 360 : lngDiff)) / 360;

  const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction || 0.000001);
  const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction || 0.000001);

  const result = Math.min(latZoom, lngZoom, ZOOM_MAX);
  return Number.isFinite(result) ? result : ANIMATION_DEFAULTS.zoomDefault;
}

// Utility functions

/**
 * Linear interpolation between two values
 */
function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Cubic easing function for smooth animation (easeOutCubic)
 * Starts fast, gradually slows down - good for camera movement
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Removed getGlobalCameraControls function - no longer needed with singleton pattern