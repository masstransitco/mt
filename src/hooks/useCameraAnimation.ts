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
 * Helper functions for interpolation (must be defined outside the hook to avoid circular dependencies)
 */
const interpolate = (start: number, end: number, progress: number): number => {
  return start + (end - start) * progress;
};

const interpolateLatLng = (
  start: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral,
  progress: number
): google.maps.LatLngLiteral => {
  // Simple direct interpolation for latitude
  const lat = interpolate(start.lat, end.lat, progress);
  
  // Handle longitude wrapping (for when the shortest path crosses the 180/-180 line)
  let lngDiff = end.lng - start.lng;
  
  // Fix wrapping (if difference is greater than 180, go the other way around)
  if (Math.abs(lngDiff) > 180) {
    lngDiff = lngDiff > 0 ? lngDiff - 360 : lngDiff + 360;
  }
  
  const lng = start.lng + lngDiff * progress;
  
  // Normalize to -180/180 range
  return { 
    lat, 
    lng: lng > 180 ? lng - 360 : lng < -180 ? lng + 360 : lng 
  };
};

const interpolateHeading = (start: number, end: number, progress: number): number => {
  // Find the shortest path (clockwise or counter-clockwise)
  let diff = end - start;
  
  // Fix wrapping
  if (Math.abs(diff) > 180) {
    diff = diff > 0 ? diff - 360 : diff + 360;
  }
  
  let heading = start + diff * progress;
  
  // Normalize to 0-360 range
  return heading >= 360 ? heading - 360 : heading < 0 ? heading + 360 : heading;
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
   * Enhanced animation sequence with easing functions and frame-rate compensation
   * Interpolates between keyframes with smooth transitions
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
      
      let currentKeyframe = 0;
      let animationActive = true;
      
      const animateBetweenKeyframes = (
        fromFrame: typeof keyframes[0],
        toFrame: typeof keyframes[0],
        onComplete: () => void
      ) => {
        // If duration is 0, just jump to the target position
        if (toFrame.durationMs <= 0) {
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
        
        const startTime = performance.now();
        const duration = toFrame.durationMs;
        
        // Get easing function (default to easeOutCubic if not specified)
        const easingFunction = Easing[toFrame.easingFn || 'easeOutCubic'];
        
        // Store starting values
        const startCenter = { ...fromFrame.center };
        const startZoom = fromFrame.zoom;
        const startTilt = fromFrame.tilt;
        const startHeading = fromFrame.heading;
        
        // Animation step function
        const step = (timestamp: number) => {
          if (!animationActive) return;
          
          // Calculate normalized progress (0-1)
          const elapsed = timestamp - startTime;
          const rawProgress = Math.min(elapsed / duration, 1);
          
          // Apply easing function
          const progress = easingFunction(rawProgress);
          
          // Interpolate all values
          const center = interpolateLatLng(startCenter, toFrame.center, progress);
          const zoom = interpolate(startZoom, toFrame.zoom, progress);
          const tilt = interpolate(startTilt, toFrame.tilt, progress);
          const heading = interpolateHeading(startHeading, toFrame.heading, progress);
          
          // Move camera to interpolated position
          map.moveCamera({
            center,
            zoom,
            tilt,
            heading
          });
          
          // Request redraw for WebGL overlay
          maybeRedraw();
          
          // Continue animation if not finished
          if (rawProgress < 1) {
            requestAnimationFrame(step);
          } else {
            onComplete();
          }
        };
        
        // Start animation
        requestAnimationFrame(step);
      };
      
      // Process keyframes sequentially
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
      
      // Function to stop animation
      const stopAnimation = () => {
        animationActive = false;
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
   * Reset view if there's no station chosen
   */
  const resetView = useCallback(() => {
    if (!map) return;
    
    // Use animateSequence for a smooth reset to default view
    const currentCenter = { 
      lat: map.getCenter().lat(), 
      lng: map.getCenter().lng() 
    };
    const currentZoom = map.getZoom() || 14;
    
    animateSequence([
      {
        // Starting position (current map state)
        center: currentCenter,
        zoom: currentZoom,
        tilt: map.getTilt() || 0,
        heading: map.getHeading() || 0,
        durationMs: 0 // Start immediately
      },
      {
        // Default vantage point
        center: DEFAULT_CENTER,
        zoom: 12,
        tilt: 0,
        heading: 0,
        durationMs: 1500, // 1.5 second smooth animation
        easingFn: 'easeOutCubic' // Smooth deceleration
      }
    ]);
  }, [map, animateSequence]);

  /**
   * Move to a particular station with smooth animation
   */
  const animateToStation = useCallback(
    (stationId: number) => {
      if (!map) return;
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;

      const [lng, lat] = station.geometry.coordinates;
      
      // Use animateSequence for smooth transition instead of direct moveCamera
      // This creates a fluid animation with easing
      const currentCenter = { 
        lat: map.getCenter().lat(), 
        lng: map.getCenter().lng() 
      };
      const currentZoom = map.getZoom() || 14;
      const targetCenter = { lat, lng };
      
      animateSequence([
        {
          // Starting position (current map state)
          center: currentCenter,
          zoom: currentZoom,
          tilt: map.getTilt() || 0,
          heading: map.getHeading() || 0,
          durationMs: 0 // Start immediately
        },
        {
          // Target position (station location)
          center: targetCenter,
          zoom: 16,
          tilt: 0,
          heading: 0,
          durationMs: 1200, // Smooth 1.2 second animation
          easingFn: 'easeOutCubic' // Smooth deceleration curve
        }
      ]);
    },
    [map, stations, animateSequence]
  );

  /**
   * User location or search location with smooth animation
   */
  const animateToLocation = useCallback(
    (loc: google.maps.LatLngLiteral, zoom: number) => {
      if (!map) return;
      
      // Use animateSequence for smooth transition to the location
      const currentCenter = { 
        lat: map.getCenter().lat(), 
        lng: map.getCenter().lng() 
      };
      const currentZoom = map.getZoom() || 14;
      
      animateSequence([
        {
          // Starting position (current map state)
          center: currentCenter,
          zoom: currentZoom,
          tilt: map.getTilt() || 0,
          heading: map.getHeading() || 0,
          durationMs: 0 // Start immediately
        },
        {
          // Target location
          center: loc,
          zoom: zoom,
          tilt: 0,
          heading: 0,
          durationMs: 1000, // 1 second animation
          easingFn: 'easeOutCubic' // Smooth deceleration
        }
      ]);
    },
    [map, animateSequence]
  );
  
  /**
   * Creates a continuous fluid animation using Three.js setAnimationLoop pattern with
   * advanced easing and motion patterns - optimized for 60FPS performance
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
      
      const startTime = performance.now();
      let animationActive = true;
      
      // Default values
      const startTilt = options.startTilt ?? 0;
      const startHeading = options.startHeading ?? 0;
      const easingFn = options.easingFn ?? 'easeOutCubic';
      
      // Create animation pattern parameters based on the selected pattern
      const setupAnimationPattern = () => {
        const pattern = options.pattern;
        
        // Tilt and rotate pattern (like the original example)
        if (pattern.type === 'tiltAndRotate') {
          const duration = pattern.duration ?? 10000; // Default 10 seconds
          
          return {
            type: pattern.type,
            startValues: {
              tilt: startTilt,
              heading: startHeading,
              zoom: options.zoom,
              center: { ...options.center }
            },
            endValues: {
              tilt: pattern.maxTilt,
              heading: pattern.maxHeading,
              zoom: options.zoom,
              center: { ...options.center }
            },
            duration,
            tiltTransitionPoint: 0.4, // Complete tilt in first 40% of animation
            animate: (progress: number, eased: number) => {
              // Separate tilt and heading animations
              let tilt, heading;
              
              // Tilt in first phase, then rotate
              if (progress < 0.4) {
                // Normalize progress for tilt phase (0-0.4 becomes 0-1)
                const tiltProgress = Easing[easingFn](progress / 0.4);
                tilt = interpolate(startTilt, pattern.maxTilt, tiltProgress);
                heading = startHeading;
              } else {
                // Heading in second phase
                // Normalize progress for heading phase (0.4-1 becomes 0-1)
                const headingProgress = Easing[easingFn]((progress - 0.4) / 0.6);
                tilt = pattern.maxTilt;
                
                // Calculate heading with proper wraparound
                const headingDiff = ((pattern.maxHeading - startHeading) + 360) % 360;
                heading = (startHeading + headingDiff * headingProgress) % 360;
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
        
        // Orbit pattern
        else if (pattern.type === 'orbit') {
          const duration = pattern.duration ?? pattern.cycles * 10000; // Default 10 seconds per cycle
          const tilt = pattern.tilt;
          const radius = pattern.radius; // Distance in degrees from center point
          
          return {
            type: pattern.type,
            duration,
            animate: (progress: number, eased: number) => {
              // Calculate orbit position - we'll complete 'cycles' number of orbits
              const angle = startHeading + (progress * pattern.cycles * 360);
              
              // Convert angle and radius to lat/lng offset
              // This is a simplified calculation - for more precision, consider proper geospatial calculations
              const lat = options.center.lat + Math.sin(angle * Math.PI / 180) * radius * 0.7; // Adjust for Earth's oblateness
              const lng = options.center.lng + Math.cos(angle * Math.PI / 180) * radius;
              
              return {
                tilt,
                heading: angle % 360, // Keep camera pointed at center
                zoom: options.zoom,
                center: { lat, lng }
              };
            }
          };
        }
        
        // Fly to pattern
        else if (pattern.type === 'flyTo') {
          const duration = pattern.duration ?? 3000; // Default 3 seconds
          
          // Calculate an arc path with a maximum altitude midway
          const startPoint = { ...options.center };
          const endPoint = { ...pattern.target };
          const distance = Math.sqrt(
            Math.pow(endPoint.lat - startPoint.lat, 2) + 
            Math.pow(endPoint.lng - startPoint.lng, 2)
          );
          
          // Determine maximum zoom out during flight based on distance
          const midZoom = Math.max(options.zoom - distance * 2, 8);
          
          return {
            type: pattern.type,
            duration,
            animate: (progress: number, eased: number) => {
              // For flyTo, we'll use a different easing for each parameter
              // For zoom, we want to quickly zoom out, then slowly zoom in (bell curve)
              const zoomProgress = progress < 0.5 
                ? Easing.easeOutQuad(progress * 2) // First half
                : 1 - Easing.easeInQuad((progress - 0.5) * 2); // Second half
                
              // Interpolate center position
              const center = {
                lat: interpolate(startPoint.lat, endPoint.lat, eased),
                lng: interpolate(startPoint.lng, endPoint.lng, eased)
              };
              
              // Zoom follows a bell curve - out then in
              const zoom = progress < 0.5
                ? interpolate(options.zoom, midZoom, zoomProgress)
                : interpolate(midZoom, pattern.finalZoom, (progress - 0.5) * 2);
              
              // Tilt and heading change mainly in the second half
              const tilt = progress < 0.7
                ? interpolate(startTilt, startTilt + 10, progress / 0.7) // Slight tilt up initially
                : interpolate(startTilt + 10, pattern.finalTilt, (progress - 0.7) / 0.3);
                
              const heading = progress < 0.5
                ? startHeading
                : interpolate(startHeading, pattern.finalHeading, (progress - 0.5) * 2);
              
              return { center, zoom, tilt, heading };
            }
          };
        }
        
        // Custom path following control points
        else if (pattern.type === 'customPath') {
          const duration = pattern.duration ?? 5000;
          const points = pattern.controlPoints;
          
          return {
            type: pattern.type,
            duration,
            animate: (progress: number, eased: number) => {
              // Find the segment we're in
              const totalPoints = points.length;
              if (totalPoints < 2) return {
                center: options.center,
                zoom: options.zoom,
                tilt: startTilt,
                heading: startHeading
              };
              
              // Calculate which segment we're in
              const segment = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 2);
              const segmentProgress = (progress * (totalPoints - 1)) - segment;
              const segmentEased = Easing[easingFn](segmentProgress);
              
              // Get points for this segment
              const p1 = points[segment];
              const p2 = points[segment + 1];
              
              // Interpolate all values
              return {
                center: {
                  lat: interpolate(p1.pos.lat, p2.pos.lat, segmentEased),
                  lng: interpolate(p1.pos.lng, p2.pos.lng, segmentEased)
                },
                zoom: interpolate(p1.zoom, p2.zoom, segmentEased),
                tilt: interpolate(p1.tilt, p2.tilt, segmentEased),
                heading: interpolate(p1.heading, p2.heading, segmentEased)
              };
            }
          };
        }
        
        // Default fallback pattern
        return {
          type: 'default',
          duration: 3000,
          animate: (progress: number) => ({
            tilt: startTilt,
            heading: startHeading,
            zoom: options.zoom,
            center: options.center
          })
        };
      };
      
      // Set up animation pattern
      const animationPattern = setupAnimationPattern();
      const duration = animationPattern.duration;
      
      // Create animation function for Three.js setAnimationLoop
      const animationLoop = () => {
        if (!animationActive) return;
        
        // Calculate elapsed time and progress
        const elapsed = performance.now() - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        
        // Use the pattern's animation function to calculate new camera params
        const easedProgress = Easing[easingFn](rawProgress);
        const cameraParams = animationPattern.animate(rawProgress, easedProgress);
        
        // Update map camera
        map.moveCamera(cameraParams);
        
        // Redraw the WebGL overlay
        maybeRedraw();
        
        // Call onUpdate callback if provided
        if (options.onUpdate) {
          options.onUpdate(cameraParams);
        }
        
        // Check if animation is complete
        if (rawProgress >= 1) {
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
   * Watch booking steps to decide where to animate
   */
  useEffect(() => {
    if (!map) return;

    // No stations => reset
    if (!depId && !arrId) {
      resetView();
      return;
    }

    // Step 1 or 2 => highlight departure
    if ((bookingStep === 1 || bookingStep === 2) && depId) {
      animateToStation(depId);
    }

    // Step 3 or 4 => if we have a route, move to approximate midpoint
    if ((bookingStep === 3 || bookingStep === 4) && depId && arrId) {
      if (routeCoords?.length > 1) {
        const midIndex = Math.floor(routeCoords.length / 2);
        const midpoint = routeCoords[midIndex];
        animateCamera(midpoint, 13, 0, 0);
      } else {
        // fallback if no route
        animateToStation(arrId);
      }
    }
  }, [map, bookingStep, depId, arrId, routeCoords, resetView, animateToStation, animateCamera]);

  /**
   * If user location changes, animate
   */
  useEffect(() => {
    if (userLocation) {
      animateToLocation(userLocation, 15);
    }
  }, [userLocation, animateToLocation]);

  /**
   * If search location changes, animate
   */
  useEffect(() => {
    if (searchLocation) {
      animateToLocation(searchLocation, 14);
    }
  }, [searchLocation, animateToLocation]);

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