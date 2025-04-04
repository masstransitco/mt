import { useCallback, useEffect, useRef } from "react";
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRouteDecoded,
} from "@/store/bookingSlice";
import {
  selectUserLocation,
  selectSearchLocation,
} from "@/store/userSlice";
import { useAppSelector } from "@/store/store";
import type { StationFeature } from "@/store/stationsSlice";
import { DEFAULT_CENTER } from "@/constants/map";

/**
 * Easing functions for smoother transitions
 */
const Easing = {
  // Linear (no easing)
  linear: (t: number): number => t,
  
  // Quadratic easing
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  // Cubic easing
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  // Exponential
  easeOutExpo: (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  
  // Elastic bounce (camera overshoots slightly then settles)
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

interface UseCameraAnimationOptions {
  map: google.maps.Map | null;
  stations: StationFeature[];
  /**
   * If you're using a WebGLOverlayView for custom 3D, pass its ref
   * so we can call requestRedraw() each time the camera moves.
   */
  overlayRef?: React.RefObject<google.maps.WebGLOverlayView | null>;
}

/**
 * Optimized helper functions for interpolation with minimal computation
 */
const interpolate = (start: number, end: number, progress: number): number => {
  return start + (end - start) * progress;
};

// Pre-computed constants for common math operations
const LONGITUDE_THRESHOLD = 180;
const FULL_CIRCLE = 360;

// Memoization cache for interpolateLatLng calculations
const memoLatLngCache = new Map<string, (progress: number) => google.maps.LatLngLiteral>();
const getCacheKey = (start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral): string => {
  return `${start.lat},${start.lng}|${end.lat},${end.lng}`;
};

/**
 * Optimized coordinate interpolation with memoization
 * Creates and returns a memoized function that efficiently calculates
 * intermediate points without redundant calculations
 */
const createInterpolateLatLngFn = (
  start: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral
): ((progress: number) => google.maps.LatLngLiteral) => {
  // Fast-path: If points are very close, use simple direct interpolation
  const isVeryClose = 
    Math.abs(start.lat - end.lat) < 0.0001 && 
    Math.abs(start.lng - end.lng) < 0.0001;
    
  if (isVeryClose) {
    return (progress: number) => ({
      lat: start.lat + (end.lat - start.lat) * progress,
      lng: start.lng + (end.lng - start.lng) * progress
    });
  }

  // Pre-compute values for longitude wrapping once
  const lngDiff = end.lng - start.lng;
  const wrappedLngDiff = Math.abs(lngDiff) > LONGITUDE_THRESHOLD
    ? (lngDiff > 0 ? lngDiff - FULL_CIRCLE : lngDiff + FULL_CIRCLE)
    : lngDiff;
  
  // Pre-compute lat diff
  const latDiff = end.lat - start.lat;
  
  // Return optimized function that uses pre-computed values
  return (progress: number) => {
    const lat = start.lat + latDiff * progress;
    let lng = start.lng + wrappedLngDiff * progress;
    
    // Normalize longitude only once at the end (more efficient)
    if (lng > LONGITUDE_THRESHOLD) lng -= FULL_CIRCLE;
    else if (lng < -LONGITUDE_THRESHOLD) lng += FULL_CIRCLE;
    
    return { lat, lng };
  };
};

/**
 * Memoized version that returns an optimized function for reuse
 */
const getInterpolateLatLngFn = (
  start: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral
): ((progress: number) => google.maps.LatLngLiteral) => {
  const cacheKey = getCacheKey(start, end);
  
  // Use cached function if available
  if (memoLatLngCache.has(cacheKey)) {
    return memoLatLngCache.get(cacheKey)!;
  }
  
  // Create new function and cache it
  const interpolateFn = createInterpolateLatLngFn(start, end);
  
  // Limit cache size to prevent memory leaks (keep only recent 20 calculations)
  if (memoLatLngCache.size > 20) {
    const firstKeyResult = memoLatLngCache.keys().next();
    if (!firstKeyResult.done && firstKeyResult.value) {
      memoLatLngCache.delete(firstKeyResult.value);
    }
  }
  
  memoLatLngCache.set(cacheKey, interpolateFn);
  return interpolateFn;
};

/**
 * Wrapper for backward compatibility
 */
const interpolateLatLng = (
  start: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral,
  progress: number
): google.maps.LatLngLiteral => {
  const fn = getInterpolateLatLngFn(start, end);
  return fn(progress);
};

// Pre-computed constants and memoization for heading calculations
const headingCache = new Map<string, (progress: number) => number>();

const createInterpolateHeadingFn = (start: number, end: number): ((progress: number) => number) => {
  // Normalize inputs to 0-360 range
  const normStart = ((start % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
  const normEnd = ((end % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
  
  // Pre-compute heading difference with optimal direction
  let diff = normEnd - normStart;
  
  // Fix wrapping for shortest path
  if (Math.abs(diff) > LONGITUDE_THRESHOLD) {
    diff = diff > 0 ? diff - FULL_CIRCLE : diff + FULL_CIRCLE;
  }
  
  // Return optimized function
  return (progress: number) => {
    const heading = normStart + diff * progress;
    
    // Normalize to 0-360 range only once at the end
    return heading >= FULL_CIRCLE 
      ? heading - FULL_CIRCLE 
      : heading < 0 
        ? heading + FULL_CIRCLE 
        : heading;
  };
};

const getHeadingCacheKey = (start: number, end: number): string => {
  return `${start}|${end}`;
};

const getInterpolateHeadingFn = (start: number, end: number): ((progress: number) => number) => {
  const cacheKey = getHeadingCacheKey(start, end);
  
  if (headingCache.has(cacheKey)) {
    return headingCache.get(cacheKey)!;
  }
  
  const headingFn = createInterpolateHeadingFn(start, end);
  
  // Limit cache size to prevent memory leaks
  if (headingCache.size > 20) {
    const firstKeyResult = headingCache.keys().next();
    if (!firstKeyResult.done && firstKeyResult.value) {
      headingCache.delete(firstKeyResult.value);
    }
  }
  
  headingCache.set(cacheKey, headingFn);
  return headingFn;
};

/**
 * Wrapper for backward compatibility
 */
const interpolateHeading = (start: number, end: number, progress: number): number => {
  const fn = getInterpolateHeadingFn(start, end);
  return fn(progress);
};

/**
 * A version of the camera-animation hook that uses *only* the standard
 * map.panTo() / map.setZoom() / map.setTilt() methods. This relies on
 * the built-in Google Maps animation for panning (zoom, tilt, and heading
 * typically jump quickly rather than animate smoothly).
 */
export function useCameraAnimationStable({
  map,
  stations,
  overlayRef,
}: UseCameraAnimationOptions) {
  // Redux states
  const bookingStep = useAppSelector(selectBookingStep);
  const depId = useAppSelector(selectDepartureStationId);
  const arrId = useAppSelector(selectArrivalStationId);
  const routeCoords = useAppSelector(selectRouteDecoded);
  const userLocation = useAppSelector(selectUserLocation);
  const searchLocation = useAppSelector(selectSearchLocation);

  /**
   * Optionally call requestRedraw() after camera changes if using a WebGL overlay.
   */
  const maybeRedraw = useCallback(() => {
    overlayRef?.current?.requestRedraw();
  }, [overlayRef]);

  /**
   * Pan/zoom/tilt/heading using moveCamera for smooth transitions.
   * This utilizes Google Maps' WebGL capabilities for fluid animations
   * of all camera properties simultaneously.
   */
  const animateCamera = useCallback(
    (center: google.maps.LatLngLiteral, zoom: number, tilt = 0, heading = 0) => {
      if (!map) return;
      
      // Use moveCamera to animate all properties simultaneously
      // This provides smoother transitions than individual method calls
      map.moveCamera({
        center,
        zoom,
        tilt,
        heading
      });

      // Redraw any 3D overlays after camera movement
      // This is crucial for WebGLOverlayView to update properly
      maybeRedraw();
    },
    [map, maybeRedraw]
  );

  /**
   * Enhanced animation sequence with optimized RAF handling and memoized interpolation
   * Interpolates between keyframes with smooth transitions and efficient frame scheduling
   */
  const animateSequence = useCallback(
    (keyframes: Array<{
      center: google.maps.LatLngLiteral;
      zoom: number;
      tilt: number;
      heading: number;
      durationMs: number;
      easingFn?: keyof typeof Easing;
    }>) => {
      if (!map || keyframes.length === 0) return;
      
      // Animation state tracking
      let currentKeyframe = 0;
      let animationActive = true;
      let rafId: number | null = null;
      
      // Animation configuration for current segment
      interface AnimationConfig {
        interpolateCenterFn: (progress: number) => google.maps.LatLngLiteral;
        interpolateHeadingFn: (progress: number) => number;
        startZoom: number;
        zoomDiff: number;
        startTilt: number;
        tiltDiff: number;
        startTime: number;
        duration: number;
        easingFn: (t: number) => number;
        onComplete: () => void;
      }
      
      let currentAnimation: AnimationConfig | null = null;
      
      // Tracks the time of the previous animation frame
      let lastFrameTime = 0;
      // Skip frame optimization - don't render invisible changes
      const MIN_PERCEPTIBLE_CHANGE = 0.001;
      // FPS throttling for low-end devices
      let isLowEndDevice = false;
      let targetFrameRate = 60; // Default target framerate
      const targetFrameTime = 1000 / targetFrameRate;
      
      // Detect if we're running on a low-end device based on first animation frame timing
      const detectDevicePerformance = (frameTime: number) => {
        if (lastFrameTime === 0) {
          lastFrameTime = frameTime;
          return false;
        }
        
        const frameDelta = frameTime - lastFrameTime;
        // If frame time is > 25ms (40fps), consider it a lower-end device
        if (frameDelta > 25) {
          isLowEndDevice = true;
          targetFrameRate = 30; // Reduce target framerate
        }
        return isLowEndDevice;
      };
      
      // Track map options within the sequence function scope
      const sequenceMapOptions = {
        zoom: 0,
        tilt: 0,
        heading: 0,
        center: { lat: 0, lng: 0 }
      };
      
      // Optimized animation step with deltaTime and frame skipping
      const optimizedStep = (timestamp: number) => {
        if (!animationActive || !currentAnimation) {
          rafId = null;
          return;
        }
        
        // FPS throttling for low-end devices
        if (detectDevicePerformance(timestamp)) {
          // If we haven't waited long enough for next frame, skip rendering
          if ((timestamp - lastFrameTime) < targetFrameTime) {
            rafId = requestAnimationFrame(optimizedStep);
            return;
          }
        }
        
        // Update last frame time
        lastFrameTime = timestamp;
        
        // Get current animation params
        const { 
          interpolateCenterFn, 
          interpolateHeadingFn,
          startZoom, 
          zoomDiff, 
          startTilt, 
          tiltDiff, 
          startTime, 
          duration, 
          easingFn, 
          onComplete 
        } = currentAnimation;
        
        // Calculate normalized progress (0-1)
        const elapsed = timestamp - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        
        // Apply easing function
        const progress = easingFn(rawProgress);
        
        // Interpolate all values using optimized pre-calculated functions
        const center = interpolateCenterFn(progress);
        const zoom = startZoom + zoomDiff * progress;
        const tilt = startTilt + tiltDiff * progress;
        const heading = interpolateHeadingFn(progress);
        
        // Skip frame if changes are imperceptible using mapOptions pattern
        const isChangePerceptible = 
          Math.abs(zoom - sequenceMapOptions.zoom) > MIN_PERCEPTIBLE_CHANGE ||
          Math.abs(tilt - sequenceMapOptions.tilt) > MIN_PERCEPTIBLE_CHANGE ||
          Math.abs(heading - sequenceMapOptions.heading) > MIN_PERCEPTIBLE_CHANGE;
        
        // Only update camera if changes are perceptible
        if (isChangePerceptible) {
          // Build camera options (ensuring correct type)
          const cameraOptions: google.maps.CameraOptions = {
            center,
            zoom,
            tilt,
            heading
          };
          
          // Move camera to interpolated position
          map.moveCamera(cameraOptions);
          
          // Update our tracked map options
          sequenceMapOptions.zoom = zoom;
          sequenceMapOptions.tilt = tilt;
          sequenceMapOptions.heading = heading;
          
          // Handle center with proper type conversion
          if (center) {
            if ('lat' in center && 'lng' in center && typeof center.lat === 'number' && typeof center.lng === 'number') {
              // It's already a LatLngLiteral
              sequenceMapOptions.center = {
                lat: center.lat,
                lng: center.lng
              };
            } else if (typeof center.lat === 'function' && typeof center.lng === 'function') {
              // It's a LatLng object, convert to LatLngLiteral
              sequenceMapOptions.center = {
                lat: center.lat(),
                lng: center.lng()
              };
            }
          }
          
          // Request redraw for WebGL overlay
          maybeRedraw();
        }
        
        // Continue animation if not finished
        if (rawProgress < 1) {
          rafId = requestAnimationFrame(optimizedStep);
        } else {
          // Final frame - ensure we hit target exactly
          const finalCenter = interpolateCenterFn(1);
          // Ensure we're using a proper LatLngLiteral for the final frame
          const finalLatLng: google.maps.LatLngLiteral = 
            ('lat' in finalCenter && 'lng' in finalCenter && typeof finalCenter.lat === 'number' && typeof finalCenter.lng === 'number')
              ? { lat: finalCenter.lat, lng: finalCenter.lng }
              : (typeof finalCenter.lat === 'function' && typeof finalCenter.lng === 'function')
                ? { lat: finalCenter.lat(), lng: finalCenter.lng() }
                : sequenceMapOptions.center; // fallback
          
          const finalCameraOptions: google.maps.CameraOptions = {
            center: finalLatLng,
            zoom: startZoom + zoomDiff,
            tilt: startTilt + tiltDiff,
            heading: interpolateHeadingFn(1)
          };
          
          map.moveCamera(finalCameraOptions);
          maybeRedraw();
          
          // Update sequence map options to final state
          sequenceMapOptions.zoom = finalCameraOptions.zoom || sequenceMapOptions.zoom;
          sequenceMapOptions.tilt = finalCameraOptions.tilt || sequenceMapOptions.tilt;
          sequenceMapOptions.heading = finalCameraOptions.heading || sequenceMapOptions.heading;
          sequenceMapOptions.center = finalLatLng;
          
          // Cleanup
          rafId = null;
          currentAnimation = null;
          
          // Move to next keyframe
          onComplete();
        }
      };
      
      // Function to animate between two keyframes
      const animateBetweenKeyframes = (
        fromFrame: typeof keyframes[0],
        toFrame: typeof keyframes[0],
        onComplete: () => void
      ) => {
        // If duration is 0 or nearly 0, just jump to the target position
        if (toFrame.durationMs <= 16) { // One frame at 60fps
          map.moveCamera({
            center: toFrame.center,
            zoom: toFrame.zoom,
            tilt: toFrame.tilt,
            heading: toFrame.heading
          });
          maybeRedraw();
          onComplete();
          return;
        }
        
        // Cleanup previous animation if any
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        
        // Setup optimized animation with pre-calculated functions
        const startTime = performance.now();
        const duration = toFrame.durationMs;
        
        // Get easing function (default to easeOutCubic if not specified)
        const easingFunction = Easing[toFrame.easingFn || 'easeOutCubic'];
        
        // Pre-calculate interpolation functions for this segment
        const interpolateCenterFn = getInterpolateLatLngFn(fromFrame.center, toFrame.center);
        const interpolateHeadingFn = getInterpolateHeadingFn(fromFrame.heading, toFrame.heading);
        
        // Pre-calculate diffs for simple linear values
        const zoomDiff = toFrame.zoom - fromFrame.zoom;
        const tiltDiff = toFrame.tilt - fromFrame.tilt;
        
        // Set current animation config
        currentAnimation = {
          interpolateCenterFn,
          interpolateHeadingFn,
          startZoom: fromFrame.zoom,
          zoomDiff,
          startTilt: fromFrame.tilt,
          tiltDiff,
          startTime,
          duration,
          easingFn: easingFunction,
          onComplete
        };
        
        // Start animation using RequestAnimationFrame with proper cleanup
        rafId = requestAnimationFrame(optimizedStep);
      };
      
      // Process keyframes sequentially with proper cleanup
      const processNextKeyframe = () => {
        if (!animationActive || currentKeyframe >= keyframes.length - 1) {
          return;
        }
        
        const currentFrame = keyframes[currentKeyframe];
        const nextFrame = keyframes[currentKeyframe + 1];
        
        animateBetweenKeyframes(currentFrame, nextFrame, () => {
          currentKeyframe++;
          if (currentKeyframe < keyframes.length - 1) {
            processNextKeyframe();
          }
        });
      };
      
      // Function to stop animation and clean up resources
      const stopAnimation = () => {
        animationActive = false;
        
        // Cancel any pending animation frame
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        
        // Clear animation state
        currentAnimation = null;
      };
      
      // Ensure we have at least 2 keyframes
      if (keyframes.length < 2) {
        // If only one keyframe, just move directly to it
        const frame = keyframes[0];
        map.moveCamera({
          center: frame.center,
          zoom: frame.zoom,
          tilt: frame.tilt,
          heading: frame.heading
        });
        maybeRedraw();
        return stopAnimation;
      }
      
      // Start animation from first keyframe
      processNextKeyframe();
      
      // Return function to stop animation
      return stopAnimation;
    },
    [map, maybeRedraw]
  );

  /**
   * Reset view with simplified fluid animation
   */
  const resetView = useCallback(() => {
    if (!map) return;
    
    try {
      // Get current camera state
      const center = map.getCenter();
      if (!center) {
        // If we can't get the center, use a direct animation
        map.moveCamera({
          center: DEFAULT_CENTER,
          zoom: 13,
          tilt: 0,
          heading: 0
        });
        maybeRedraw();
        return;
      }
      
      const currentCenter = { 
        lat: center.lat(), 
        lng: center.lng() 
      };
      const currentZoom = map.getZoom() || 14;
      const currentTilt = map.getTilt() || 0;
      const currentHeading = map.getHeading() || 0;
    
      // Simple fluid animation direct to default view
      animateSequence([
        {
          // Starting position
          center: currentCenter,
          zoom: currentZoom,
          tilt: currentTilt,
          heading: currentHeading,
          durationMs: 0
        },
        {
          // Default view without tilt
          center: DEFAULT_CENTER,
          zoom: 13,
          tilt: 0,
          heading: 0,
          durationMs: 800,
          easingFn: 'easeOutCubic'
        }
      ]);
    } catch (error) {
      // Fallback in case of any errors
      console.warn("Error in resetView, using fallback animation:", error);
      if (map) {
        map.moveCamera({
          center: DEFAULT_CENTER,
          zoom: 13,
          tilt: 0,
          heading: 0
        });
        maybeRedraw();
      }
    }
  }, [map, animateSequence, maybeRedraw]);

  /**
   * Move to a particular station with simplified fluid animation
   * Adds 45-degree tilt when station is selected
   */
  const animateToStation = useCallback(
    (stationId: number, isArrival: boolean = false) => {
      if (!map) return;
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;

      const [lng, lat] = station.geometry.coordinates;
      const targetCenter = { lat, lng };
      
      try {
        // Get current camera position
        const center = map.getCenter();
        if (!center) {
          // If we can't get the center, use a direct animation
          map.moveCamera({
            center: targetCenter,
            zoom: 15,
            tilt: 45, // Add 45-degree tilt for station view
            heading: 0
          });
          maybeRedraw();
          return;
        }
        
        const currentCenter = { 
          lat: center.lat(), 
          lng: center.lng() 
        };
        const currentZoom = map.getZoom() || 14;
        const currentTilt = map.getTilt() || 0;
        const currentHeading = map.getHeading() || 0;
        
        // Set consistent zoom level for both departure and arrival
        const finalZoom = 15;
        
        // Create a simple fluid animation with 45-degree tilt
        animateSequence([
          // Starting position (current map state)
          {
            center: currentCenter,
            zoom: currentZoom,
            tilt: currentTilt,
            heading: currentHeading,
            durationMs: 0 // Start immediately
          },
          // Direct animation to target station with 45-degree tilt
          {
            center: targetCenter,
            zoom: finalZoom,
            tilt: 45, // Add 45-degree tilt for station view
            heading: 0, // No heading change
            durationMs: 800,
            easingFn: 'easeOutCubic'
          }
        ]);
      } catch (error) {
        // Fallback in case of any errors
        console.warn("Error in animateToStation, using fallback animation:", error);
        if (map) {
          map.moveCamera({
            center: targetCenter,
            zoom: 15,
            tilt: 45, // Add 45-degree tilt for station view
            heading: 0
          });
          maybeRedraw();
        }
      }
    },
    [map, stations, animateSequence, maybeRedraw]
  );

  /**
   * User location or search location with simplified smooth animation
   * No distance calculation, just direct animation
   */
  const animateToLocation = useCallback(
    (loc: google.maps.LatLngLiteral, zoom: number) => {
      if (!map) return;
      
      try {
        // Get current camera state
        const center = map.getCenter();
        if (!center) {
          // If we can't get the center, use a simple animation
          map.moveCamera({
            center: loc,
            zoom: zoom,
            tilt: 20,
            heading: 0
          });
          maybeRedraw();
          return;
        }
        
        const currentCenter = { 
          lat: center.lat(), 
          lng: center.lng() 
        };
        const currentZoom = map.getZoom() || 14;
        const currentTilt = map.getTilt() || 0;
        const currentHeading = map.getHeading() || 0;
        
        // Use a consistent direct animation regardless of distance
        // Simple two-keyframe animation
        animateSequence([
          {
            // Starting position
            center: currentCenter,
            zoom: currentZoom,
            tilt: currentTilt,
            heading: currentHeading,
            durationMs: 0
          },
          {
            // Target location with slight tilt
            center: loc,
            zoom: zoom,
            tilt: 20, // Light tilt for better perspective
            heading: currentHeading,
            durationMs: 800,
            easingFn: 'easeOutCubic'
          }
        ]);
      } catch (error) {
        // Fallback in case of any errors
        console.warn("Error in animateToLocation, using fallback animation:", error);
        if (map) {
          map.moveCamera({
            center: loc,
            zoom: zoom,
            tilt: 20,
            heading: 0
          });
          maybeRedraw();
        }
      }
    },
    [map, animateSequence, maybeRedraw]
  );
  
  /**
   * Creates a continuous fluid animation using Three.js setAnimationLoop pattern with
   * optimized easing and motion patterns - designed for efficient WebGL performance
   * @param renderer Three.js WebGLRenderer instance
   * @param options Animation options with camera parameters and motion pattern
   */
  const createFluidAnimation = useCallback(
    (
      renderer: THREE.WebGLRenderer,
      options: {
        // Basic camera parameters
        center: google.maps.LatLngLiteral;
        zoom: number;
        startTilt?: number;
        startHeading?: number;
        
        // Animation pattern - choose one
        pattern: 
          | { type: 'tiltAndRotate', maxTilt: number, maxHeading: number, duration?: number }
          | { type: 'orbit', tilt: number, radius: number, cycles: number, duration?: number }
          | { type: 'flyTo', target: google.maps.LatLngLiteral, finalZoom: number, finalTilt: number, finalHeading: number, duration?: number }
          | { type: 'customPath', controlPoints: Array<{pos: google.maps.LatLngLiteral, tilt: number, heading: number, zoom: number}>, duration?: number };
        
        // Animation settings
        easingFn?: keyof typeof Easing;
        onUpdate?: (params: any) => void;
        onComplete?: () => void;
      }
    ) => {
      if (!map || !renderer) return;
      
      // Default values
      const startTilt = options.startTilt ?? 0;
      const startHeading = options.startHeading ?? 0;
      const easingFn = options.easingFn ?? 'easeOutCubic';
      
      // Animation control state - follow Google Maps documentation pattern
      const startTime = performance.now();
      let animationActive = true;
      let lastUpdateTime = 0;
      const MIN_UPDATE_INTERVAL = 16; // ~60fps throttle
      
      // Track camera state in mapOptions object as per Google Maps documentation
      // Ensure center is a proper LatLngLiteral
      const centerLatLng: google.maps.LatLngLiteral = 
        options.center && 'lat' in options.center && 'lng' in options.center && 
        typeof options.center.lat === 'number' && typeof options.center.lng === 'number'
          ? { lat: options.center.lat, lng: options.center.lng }
          : { lat: 0, lng: 0 };
      
      const mapOptions = {
        zoom: options.zoom, 
        tilt: startTilt,
        heading: startHeading,
        center: centerLatLng
      };
      
      // Pre-calculated animation functions for each pattern
      interface AnimationPattern {
        type: string;
        duration: number;
        isPerceptibleChange?: (last: any, current: any) => boolean;
        animateFn: (rawProgress: number, easedProgress: number) => google.maps.CameraOptions;
      }
      
      // Create optimized animation pattern based on selected type
      const setupAnimationPattern = (): AnimationPattern => {
        const pattern = options.pattern;
        
        // Tilt and rotate pattern
        if (pattern.type === 'tiltAndRotate') {
          const duration = pattern.duration ?? 10000; // Default 10 seconds
          
          // Pre-calculate optimization values
          const tiltDiff = pattern.maxTilt - startTilt;
          const headingDiff = ((pattern.maxHeading - startHeading) + FULL_CIRCLE) % FULL_CIRCLE;
          const shouldWrapHeading = Math.abs(headingDiff) > LONGITUDE_THRESHOLD;
          const adjustedHeadingDiff = shouldWrapHeading
            ? (headingDiff > 0 ? headingDiff - FULL_CIRCLE : headingDiff + FULL_CIRCLE)
            : headingDiff;
          
          // Create an optimized animation function
          return {
            type: pattern.type,
            duration,
            animateFn: (rawProgress: number, easedProgress: number) => {
              // Separate tilt and heading animations with pre-calculated values
              let tilt, heading;
              
              // Tilt in first phase, then rotate
              if (rawProgress < 0.4) {
                // Normalize progress for tilt phase (0-0.4 becomes 0-1)
                const tiltProgress = Easing[easingFn](rawProgress / 0.4);
                tilt = startTilt + tiltDiff * tiltProgress;
                heading = startHeading;
              } else {
                // Heading in second phase (pre-calculated for efficiency)
                const headingProgress = Easing[easingFn]((rawProgress - 0.4) / 0.6);
                tilt = pattern.maxTilt;
                heading = startHeading + adjustedHeadingDiff * headingProgress;
                
                // Normalize heading only once at the end
                if (heading >= FULL_CIRCLE) heading -= FULL_CIRCLE;
                else if (heading < 0) heading += FULL_CIRCLE;
              }
              
              return {
                tilt,
                heading,
                zoom: options.zoom,
                center: options.center
              };
            }
          };
        }
        
        // Orbit pattern - pre-calculate orbital values
        else if (pattern.type === 'orbit') {
          const duration = pattern.duration ?? pattern.cycles * 10000;
          const tilt = pattern.tilt;
          const radius = pattern.radius;
          
          // Pre-calculate constants for orbit calculations
          const cyclesX360 = pattern.cycles * FULL_CIRCLE;
          const radiusX07 = radius * 0.7; // Earth's oblateness adjustment
          const radiansConversion = Math.PI / 180;
          
          // Pre-calculate center coordinates for faster access
          const centerLat = options.center.lat;
          const centerLng = options.center.lng;
          
          // Create lookup tables for sin/cos of common angles to avoid recalculation
          const sinLookup: Record<number, number> = {};
          const cosLookup: Record<number, number> = {};
          
          // Pre-compute common angles for orbit position
          for (let i = 0; i < 360; i += 15) {
            const radians = i * radiansConversion;
            sinLookup[i] = Math.sin(radians);
            cosLookup[i] = Math.cos(radians);
          }
          
          // Helper to get sin/cos values (uses lookup where possible)
          const fastSin = (deg: number): number => {
            const normDeg = Math.floor(deg % 360);
            return sinLookup[normDeg] !== undefined 
              ? sinLookup[normDeg] 
              : Math.sin(deg * radiansConversion);
          };
          
          const fastCos = (deg: number): number => {
            const normDeg = Math.floor(deg % 360);
            return cosLookup[normDeg] !== undefined 
              ? cosLookup[normDeg] 
              : Math.cos(deg * radiansConversion);
          };
          
          return {
            type: pattern.type,
            duration,
            animateFn: (rawProgress: number) => {
              // Calculate orbit position using optimized trig functions
              const angle = startHeading + (rawProgress * cyclesX360);
              
              // Use fast sin/cos and pre-calculated values
              const lat = centerLat + fastSin(angle) * radiusX07;
              const lng = centerLng + fastCos(angle) * radius;
              
              return {
                tilt,
                heading: angle % FULL_CIRCLE, // Normalized heading
                zoom: options.zoom,
                center: { lat, lng }
              };
            }
          };
        }
        
        // Fly to pattern - pre-calculate flight path
        else if (pattern.type === 'flyTo') {
          const duration = pattern.duration ?? 3000;
          
          // Pre-calculate path parameters only once
          const startPoint = { ...options.center };
          const endPoint = { ...pattern.target };
          
          // Create optimized interpolation function
          const interpolateCenterFn = getInterpolateLatLngFn(startPoint, endPoint);
          
          // Calculate distance once
          const latDiff = endPoint.lat - startPoint.lat;
          const lngDiff = endPoint.lng - startPoint.lng;
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          
          // Pre-calculate zoom parameters
          const midZoom = Math.max(options.zoom - distance * 2, 8);
          const startZoom = options.zoom;
          const zoomDiff1 = midZoom - startZoom;
          const zoomDiff2 = pattern.finalZoom - midZoom;
          
          // Pre-calculate tilt parameters
          const tiltMidpoint = startTilt + 10;
          const tiltDiff1 = tiltMidpoint - startTilt;
          const tiltDiff2 = pattern.finalTilt - tiltMidpoint;
          
          // Pre-calculate heading difference
          const headingDiff = pattern.finalHeading - startHeading;
          
          return {
            type: pattern.type,
            duration,
            animateFn: (rawProgress: number, easedProgress: number) => {
              // Get center position using pre-calculated function
              const center = interpolateCenterFn(easedProgress);
              
              // Calculate phase-specific progress values with pre-computed diffs
              let zoom, tilt, heading;
              
              // First half - zoom out
              if (rawProgress < 0.5) {
                const zoomProgress = Easing.easeOutQuad(rawProgress * 2);
                zoom = startZoom + zoomDiff1 * zoomProgress;
                tilt = rawProgress < 0.7 
                  ? startTilt + tiltDiff1 * (rawProgress / 0.7)
                  : tiltMidpoint;
                heading = startHeading;
              } 
              // Second half - zoom in
              else {
                const secondHalfProgress = (rawProgress - 0.5) * 2;
                const zoomProgress = 1 - Easing.easeInQuad(secondHalfProgress);
                zoom = midZoom + zoomDiff2 * (1 - zoomProgress);
                
                tilt = rawProgress < 0.7
                  ? tiltMidpoint
                  : tiltMidpoint + tiltDiff2 * ((rawProgress - 0.7) / 0.3);
                  
                heading = startHeading + headingDiff * secondHalfProgress;
              }
              
              return { center, zoom, tilt, heading };
            }
          };
        }
        
        // Custom path following control points - pre-calculate segment interpolation
        else if (pattern.type === 'customPath') {
          const duration = pattern.duration ?? 5000;
          const points = pattern.controlPoints;
          
          // Skip processing if not enough points
          if (points.length < 2) {
            return {
              type: 'default',
              duration: 100,
              animateFn: () => ({
                tilt: startTilt,
                heading: startHeading,
                zoom: options.zoom,
                center: options.center
              })
            };
          }
          
          // Pre-calculate segment interpolation functions
          type SegmentInterpolators = {
            centerFn: (progress: number) => google.maps.LatLngLiteral;
            zoomDiff: number;
            tiltDiff: number;
            headingDiff: number;
            startZoom: number;
            startTilt: number;
            startHeading: number;
          };
          
          const segmentInterpolators: SegmentInterpolators[] = [];
          
          // Create interpolation functions for each segment
          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            segmentInterpolators.push({
              centerFn: getInterpolateLatLngFn(p1.pos, p2.pos),
              zoomDiff: p2.zoom - p1.zoom,
              tiltDiff: p2.tilt - p1.tilt,
              headingDiff: p2.heading - p1.heading,
              startZoom: p1.zoom,
              startTilt: p1.tilt,
              startHeading: p1.heading
            });
          }
          
          // Normalize total points for progress calculation
          const totalSegments = points.length - 1;
          
          return {
            type: pattern.type,
            duration,
            animateFn: (rawProgress: number, easedProgress: number) => {
              // Find the current segment based on overall progress
              const segmentIndex = Math.min(
                Math.floor(rawProgress * totalSegments),
                totalSegments - 1
              );
              
              // Calculate segment-local progress
              const segmentProgress = (rawProgress * totalSegments) - segmentIndex;
              const segmentEased = Easing[easingFn](segmentProgress);
              
              // Get pre-calculated interpolators for this segment
              const {
                centerFn,
                zoomDiff,
                tiltDiff,
                headingDiff,
                startZoom,
                startTilt,
                startHeading
              } = segmentInterpolators[segmentIndex];
              
              // Calculate all values using optimized functions
              return {
                center: centerFn(segmentEased),
                zoom: startZoom + zoomDiff * segmentEased,
                tilt: startTilt + tiltDiff * segmentEased,
                heading: startHeading + headingDiff * segmentEased
              };
            }
          };
        }
        
        // Default fallback pattern
        return {
          type: 'default',
          duration: 3000,
          animateFn: () => ({
            tilt: startTilt,
            heading: startHeading,
            zoom: options.zoom,
            center: options.center
          })
        };
      };
      
      // Set up animation pattern once with optimized calculations
      const animationPattern = setupAnimationPattern();
      const duration = animationPattern.duration;
      const easingFunction = Easing[easingFn];
      
      // Perceptible change detection - avoid rendering imperceptible changes
      const MIN_PERCEPTIBLE_CHANGE = 0.001;
      
      // Check if camera changes are significant enough to warrant an update
      const isPerceptibleChange = (
        newParams: google.maps.CameraOptions, 
        currentMapOptions: typeof mapOptions
      ): boolean => {
        // Using nullable coalescing to handle undefined values safely
        const newZoom = newParams.zoom ?? 0;
        const newTilt = newParams.tilt ?? 0;
        const newHeading = newParams.heading ?? 0;
        
        return (
          Math.abs(newZoom - currentMapOptions.zoom) > MIN_PERCEPTIBLE_CHANGE ||
          Math.abs(newTilt - currentMapOptions.tilt) > MIN_PERCEPTIBLE_CHANGE ||
          Math.abs(newHeading - currentMapOptions.heading) > MIN_PERCEPTIBLE_CHANGE
        );
      };
      
      // Optimized animation loop with throttling and perceptible change detection
      // Following Google Maps WebGL documentation pattern
      const animationLoop = () => {
        if (!animationActive) return;
        
        const currentTime = performance.now();
        
        // Throttle updates for better performance (but only if not near end)
        const elapsedSinceLastUpdate = currentTime - lastUpdateTime;
        const isNearCompletion = (currentTime - startTime) > (duration * 0.9);
        
        if (!isNearCompletion && elapsedSinceLastUpdate < MIN_UPDATE_INTERVAL) {
          return; // Skip this frame for performance
        }
        
        // Calculate progress
        const elapsed = currentTime - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        
        // Apply easing function
        const easedProgress = easingFunction(rawProgress);
        
        // Get camera parameters using the optimized animation function
        const newCameraParams = animationPattern.animateFn(rawProgress, easedProgress);
        
        // Only update if change is perceptible
        if (isPerceptibleChange(newCameraParams, mapOptions)) {
          // Update the camera to new position
          map.moveCamera(newCameraParams);
          
          // Redraw the WebGL overlay
          maybeRedraw();
          
          // Update mapOptions to reflect current camera state
          // This follows the pattern shown in Google Maps documentation
          mapOptions.zoom = newCameraParams.zoom ?? mapOptions.zoom;
          mapOptions.tilt = newCameraParams.tilt ?? mapOptions.tilt;
          mapOptions.heading = newCameraParams.heading ?? mapOptions.heading;
          
          // Handle center with type conversion if needed
          if (newCameraParams.center) {
            // Convert LatLng to LatLngLiteral if needed
            const center = newCameraParams.center;
            if ('lat' in center && 'lng' in center && typeof center.lat === 'number' && typeof center.lng === 'number') {
              // It's already a LatLngLiteral
              mapOptions.center = {
                lat: center.lat,
                lng: center.lng
              };
            } else if (typeof center.lat === 'function' && typeof center.lng === 'function') {
              // It's a LatLng object, convert to LatLngLiteral
              mapOptions.center = {
                lat: center.lat(),
                lng: center.lng()
              };
            }
          }
          
          // Call onUpdate callback if provided
          if (options.onUpdate) {
            options.onUpdate(newCameraParams);
          }
          
          // Update last update time
          lastUpdateTime = currentTime;
        }
        
        // Check if animation is complete
        if (rawProgress >= 1) {
          // Ensure final frame is exact target position
          const finalParams = animationPattern.animateFn(1, 1);
          
          // Force center to be LatLngLiteral
          const finalCenter = finalParams.center;
          if (finalCenter) {
            const finalLatLng: google.maps.LatLngLiteral = 
              ('lat' in finalCenter && 'lng' in finalCenter && typeof finalCenter.lat === 'number' && typeof finalCenter.lng === 'number')
                ? { lat: finalCenter.lat, lng: finalCenter.lng }
                : (typeof finalCenter.lat === 'function' && typeof finalCenter.lng === 'function')
                  ? { lat: finalCenter.lat(), lng: finalCenter.lng() }
                  : mapOptions.center;
                  
            // Final camera position with corrected types
            const finalCameraOptions: google.maps.CameraOptions = {
              center: finalLatLng,
              zoom: finalParams.zoom,
              tilt: finalParams.tilt,
              heading: finalParams.heading
            };
            
            map.moveCamera(finalCameraOptions);
            maybeRedraw();
          }
          
          // Stop the animation loop
          renderer.setAnimationLoop(null);
          
          // Call completion callback if provided
          if (options.onComplete) {
            options.onComplete();
          }
        }
      };
      
      // Start animation using Three.js animation loop for optimal performance
      renderer.setAnimationLoop(animationLoop);
      
      // Return a function to stop the animation
      return () => {
        animationActive = false;
        renderer.setAnimationLoop(null);
      };
    },
    [map, maybeRedraw]
  );

  /**
   * Animate to a route view with simplified fluid motion
   * Just centers the route without complex zoom or tilt effects
   */
  const animateToRoute = useCallback((routePoints: Array<{lat: number, lng: number}>, priorArrivalAnimation: boolean = false) => {
    if (!map || !routePoints || routePoints.length < 2) return;
    
    // Calculate center point of the entire route for better overall view
    let sumLat = 0;
    let sumLng = 0;
    
    // Sum all coordinates
    routePoints.forEach(point => {
      sumLat += point.lat;
      sumLng += point.lng;
    });
    
    // Calculate average (center point)
    const centerLat = sumLat / routePoints.length;
    const centerLng = sumLng / routePoints.length;
    const routeCenter = { lat: centerLat, lng: centerLng };
    
    try {
      // Get current camera state
      const center = map.getCenter();
      if (!center) {
        // If we can't get the center, use a direct animation
        map.moveCamera({
          center: routeCenter,
          zoom: 14, // Wider view to show more of route
          tilt: 0,
          heading: 0
        });
        maybeRedraw();
        return;
      }
      
      const currentCenter = { 
        lat: center.lat(), 
        lng: center.lng() 
      };
      const currentZoom = map.getZoom() || 14;
      const currentTilt = map.getTilt() || 0;
      const currentHeading = map.getHeading() || 0;
      
      // Single simple fluid animation to route view
      animateSequence([
        // Starting position
        {
          center: currentCenter,
          zoom: currentZoom,
          tilt: currentTilt,
          heading: currentHeading,
          durationMs: 0
        },
        // Transition directly to route center view
        {
          center: routeCenter,
          zoom: 14, // Wider view to show more of route
          tilt: 0, // No tilt
          heading: 0, // No heading change
          durationMs: 800,
          easingFn: 'easeOutCubic'
        }
      ]);
    } catch (error) {
      // Fallback in case of any errors
      console.warn("Error in animateToRoute, using fallback animation:", error);
      if (map) {
        map.moveCamera({
          center: routeCenter,
          zoom: 14,
          tilt: 0,
          heading: 0
        });
        maybeRedraw();
      }
    }
  }, [map, animateSequence, maybeRedraw]);

  /**
   * State tracking for animations between steps
   */
  const bookingAnimationStateRef = useRef<{
    lastStep: number;
    lastDepId: number | null;
    lastArrId: number | null;
    stationAnimationComplete: boolean;
  }>({
    lastStep: 0,
    lastDepId: null,
    lastArrId: null,
    stationAnimationComplete: false,
  });

  /**
   * Track if we've manually set location via locate me or search
   * This helps prevent unwanted resets to default view
   */
  const manualLocationSetRef = useRef<boolean>(false);
  
  // Update manual location flag when user or search location changes
  useEffect(() => {
    if (userLocation || searchLocation) {
      manualLocationSetRef.current = true;
    }
  }, [userLocation, searchLocation]);
  
  /**
   * Watch booking steps to decide where to animate
   * Simplified for more fluid camera movements
   */
  useEffect(() => {
    if (!map) return;
    
    // No stations - only reset if we haven't manually set a location
    if (!depId && !arrId) {
      // Skip resetView if the user has manually set a location
      if (!manualLocationSetRef.current) {
        resetView();
      }
      bookingAnimationStateRef.current.stationAnimationComplete = false;
      return;
    }

    // Step 1 or 2 => highlight departure station
    if ((bookingStep === 1 || bookingStep === 2) && depId) {
      // Call animateToStation with isDeparture=true (isArrival=false)
      animateToStation(depId, false);
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: depId,
        lastArrId: arrId,
        stationAnimationComplete: false
      };
      // We've moved to a station, so we're no longer in manual location mode
      manualLocationSetRef.current = false;
    }

    // Step 3 => arrival station selection - animate to station
    if (bookingStep === 3 && arrId) {
      // Animate to arrival station
      animateToStation(arrId, true); // isArrival=true
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: depId,
        lastArrId: arrId,
        stationAnimationComplete: true
      };
      // We've moved to a station, so we're no longer in manual location mode
      manualLocationSetRef.current = false;
    }
    
    // Step 4 => route view after arrival station selected
    if (bookingStep === 4 && depId && arrId) {
      if (routeCoords?.length > 1) {
        // Use simplified route animation
        animateToRoute(routeCoords, false);
      } else {
        // fallback if no route - still use arrival animation
        animateToStation(arrId, true);
      }
      
      // Reset state
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: depId,
        lastArrId: arrId,
        stationAnimationComplete: false
      };
      // We've moved to a route, so we're no longer in manual location mode
      manualLocationSetRef.current = false;
    }
    
    // Handle when clear departure station is clicked (returning to step 1)
    if (bookingStep === 1 && 
        bookingAnimationStateRef.current.lastStep > 1 && 
        !depId && 
        bookingAnimationStateRef.current.lastDepId) {
      resetView();
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: null,
        lastArrId: null,
        stationAnimationComplete: false
      };
    }
    
    // Handle when clear arrival station is clicked (returning to step 3)
    if (bookingStep === 3 && 
        bookingAnimationStateRef.current.lastStep > 3 && 
        !arrId && 
        bookingAnimationStateRef.current.lastArrId) {
      if (depId) {
        animateToStation(depId, false);
      } else {
        resetView();
      }
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: depId,
        lastArrId: null,
        stationAnimationComplete: false
      };
    }
    
    // Handle "Pickup car here" button (advancing to step 3)
    if (bookingStep === 3 && 
        bookingAnimationStateRef.current.lastStep === 2 && 
        depId) {
      // When user presses "Pickup car here", get the station
      const station = stations.find((s) => s.id === depId);
      if (station) {
        const [lng, lat] = station.geometry.coordinates;
        const targetCenter = { lat, lng };
        
        try {
          // Get current camera position
          const center = map.getCenter();
          if (!center) {
            // If we can't get the center, use a direct animation
            map.moveCamera({
              center: targetCenter,
              zoom: 14, // Zoom out by 1 level from station view (15→14)
              tilt: 0,  // Reset tilt to 0
              heading: 0
            });
            maybeRedraw();
          } else {
            const currentCenter = { 
              lat: center.lat(), 
              lng: center.lng() 
            };
            const currentZoom = map.getZoom() || 15;
            const currentTilt = map.getTilt() || 45;
            const currentHeading = map.getHeading() || 0;
            
            // Create a simple fluid animation with tilt returning to 0 and zoom out
            animateSequence([
              // Starting position (current map state)
              {
                center: currentCenter,
                zoom: currentZoom,
                tilt: currentTilt,
                heading: currentHeading,
                durationMs: 0 // Start immediately
              },
              // Zoom out and remove tilt
              {
                center: targetCenter,
                zoom: 14, // Zoom out by 1 level
                tilt: 0,  // Reset tilt to 0
                heading: 0,
                durationMs: 800,
                easingFn: 'easeOutCubic'
              }
            ]);
          }
        } catch (error) {
          console.warn("Error in Pickup car animation, using fallback:", error);
          if (map) {
            map.moveCamera({
              center: targetCenter,
              zoom: 14,
              tilt: 0,
              heading: 0
            });
            maybeRedraw();
          }
        }
      }
      
      bookingAnimationStateRef.current = {
        lastStep: bookingStep,
        lastDepId: depId,
        lastArrId: null,
        stationAnimationComplete: true
      };
    }
  }, [map, bookingStep, depId, arrId, routeCoords, resetView, animateToStation, animateToRoute]);

  /**
   * Animation lock mechanism to prevent concurrent animations
   */
  const animationLockRef = useRef<string | null>(null);
  const resetLockTimeout = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Helper function to manage animation lock
   */
  const acquireAnimationLock = useCallback((source: string, durationMs: number = 2000): boolean => {
    // If lock is held by the same source, allow it
    if (animationLockRef.current === source) return true;
    
    // If there's an active lock by another source, deny
    if (animationLockRef.current !== null) return false;
    
    // Set the lock
    animationLockRef.current = source;
    
    // Clear any existing timeout
    if (resetLockTimeout.current) {
      clearTimeout(resetLockTimeout.current);
    }
    
    // Set timeout to release lock
    resetLockTimeout.current = setTimeout(() => {
      animationLockRef.current = null;
      resetLockTimeout.current = null;
    }, durationMs);
    
    return true;
  }, []);
  
  // Store previous locations to detect changes
  const prevLocationsRef = useRef<{
    searchLocation: google.maps.LatLngLiteral | null;
    userLocation: google.maps.LatLngLiteral | null;
  }>({
    searchLocation: null,
    userLocation: null
  });
  
  // searchLocation changes (from search bar or tapping on map)
  // This is the primary way users navigate the map
  useEffect(() => {
    if (!searchLocation) return;
    
    // Skip if no actual change in location
    if (prevLocationsRef.current.searchLocation && 
        prevLocationsRef.current.searchLocation.lat === searchLocation.lat &&
        prevLocationsRef.current.searchLocation.lng === searchLocation.lng) {
      return;
    }
    
    // Update previous location reference
    prevLocationsRef.current.searchLocation = searchLocation;
    
    // Mark that user has manually set a location (prevents automatic resets)
    manualLocationSetRef.current = true;
    
    // Search location animations take priority
    if (acquireAnimationLock('search', 1000)) {
      // Animate with a slightly tighter zoom for search
      animateToLocation(searchLocation, 15);
    }
  }, [searchLocation, acquireAnimationLock, animateToLocation]);
  
  // Event listener for locate-me button events
  useEffect(() => {
    if (!map) return;
    
    const handleLocationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        location: google.maps.LatLngLiteral;
        source: string;
        forceAnimation?: boolean;
      }>;
      
      // Only respond to locate-me button events
      if (customEvent.detail.source === 'locate-me-button') {
        const location = customEvent.detail.location;
        const forceAnimation = customEvent.detail.forceAnimation;
        
        // Update cache reference
        prevLocationsRef.current.userLocation = location;
        
        // Mark that user has manually set a location
        manualLocationSetRef.current = true;
        
        // Either force animation or check for location change
        const hasLocationChanged = 
          !prevLocationsRef.current.userLocation || 
          prevLocationsRef.current.userLocation.lat !== location.lat ||
          prevLocationsRef.current.userLocation.lng !== location.lng;
        
        // Animate if forced or if location has changed
        if ((forceAnimation || hasLocationChanged) && acquireAnimationLock('user', 1000)) {
          console.log("Animating camera to user location", forceAnimation ? "(forced)" : "");
          animateToLocation(location, 15);
        }
      }
    };
    
    // Listen for the custom location event
    window.addEventListener('user-location-updated', handleLocationUpdate);
    
    return () => {
      window.removeEventListener('user-location-updated', handleLocationUpdate);
    };
  }, [map, acquireAnimationLock, animateToLocation]);
  
  // userLocation changes (for other sources than locate-me button)
  useEffect(() => {
    if (!userLocation || !map) return;
    
    // Skip if no actual change in location
    if (prevLocationsRef.current.userLocation && 
        prevLocationsRef.current.userLocation.lat === userLocation.lat &&
        prevLocationsRef.current.userLocation.lng === userLocation.lng) {
      return;
    }
    
    // Update previous location reference
    prevLocationsRef.current.userLocation = userLocation;
    
    // Mark that user has manually set a location (prevents automatic resets)
    manualLocationSetRef.current = true;
    
    // Only animate if no other animation is in progress
    // This case handles programmatic location updates, not from locate-me button
    if (acquireAnimationLock('user', 1000)) {
      // Use a wider zoom for user location to show more context
      animateToLocation(userLocation, 15);
    }
  }, [userLocation, map, acquireAnimationLock, animateToLocation]);

  // Animation cleanup - ensure all animations and timeouts are properly canceled on unmount
  useEffect(() => {
    // Create a cleanup function that will run when the component unmounts
    return () => {
      // Clean up any animation lock timeout
      if (resetLockTimeout.current) {
        clearTimeout(resetLockTimeout.current);
        resetLockTimeout.current = null;
      }
      
      // Release animation lock
      animationLockRef.current = null;
      
      // Clear caches to prevent memory leaks
      memoLatLngCache.clear();
      headingCache.clear();
    };
  }, []);

  // Return whichever methods you'd like to expose
  return {
    resetView,
    animateToStation,
    animateToLocation,
    animateSequence,
    animateCamera,
    createFluidAnimation
  };
}