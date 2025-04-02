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
   * Reset view with cinematic animation
   */
  const resetView = useCallback(() => {
    if (!map) return;
    
    try {
      // Get current camera state
      const center = map.getCenter();
      if (!center) {
        // If we can't get the center, use a default animation
        map.moveCamera({
          center: DEFAULT_CENTER,
          zoom: 13,
          tilt: 15,
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
    
      // Calculate distance to default center to determine animation style
      const distance = Math.sqrt(
        Math.pow(DEFAULT_CENTER.lat - currentCenter.lat, 2) + 
        Math.pow(DEFAULT_CENTER.lng - currentCenter.lng, 2)
      );
      
      // For minimal distance, use a simple animation
      if (distance < 0.01) {
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
            // Default view with slight tilt for perspective
            center: DEFAULT_CENTER,
            zoom: 13, // Slightly closer than default
            tilt: 15, // Light tilt for better perspective
            heading: 0,
            durationMs: 1200,
            easingFn: 'easeOutCubic'
          }
        ]);
        return;
      }
      
      // For longer distances, create a dramatic zoom-out-then-in effect
      const midZoom = Math.max(Math.min(currentZoom, 13) - 2, 9);
      
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
          // First zoom out for perspective
          center: {
            lat: currentCenter.lat + (DEFAULT_CENTER.lat - currentCenter.lat) * 0.3,
            lng: currentCenter.lng + (DEFAULT_CENTER.lng - currentCenter.lng) * 0.3
          },
          zoom: midZoom, // Zoomed out
          tilt: 40, // High tilt for dramatic effect
          heading: 0, // Reset to north
          durationMs: 900,
          easingFn: 'easeOutQuad'
        },
        {
          // Final default view position
          center: DEFAULT_CENTER,
          zoom: 13, // Slightly closer than default
          tilt: 20, // Maintain some tilt for better perspective
          heading: 0,
          durationMs: 1100,
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
          tilt: 15,
          heading: 0
        });
        maybeRedraw();
      }
    }
  }, [map, animateSequence, maybeRedraw]);

  /**
   * Move to a particular station with smooth animation and cinematic tilt
   * Now supports different behavior for departure vs arrival stations
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
          // If we can't get the center, use a simple animation
          map.moveCamera({
            center: targetCenter,
            zoom: isArrival ? 16 : 15.5, // Lower zoom for departure stations
            tilt: isArrival ? 40 : 35,   // Different tilt for departure/arrival
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
        
        // Calculate a dynamic heading that looks good
        // We'll rotate to face the station from a slight angle
        const deltaLat = targetCenter.lat - currentCenter.lat;
        const deltaLng = targetCenter.lng - currentCenter.lng;
        // Calculate angle in degrees (0° is North, increases clockwise)
        const angleToStation = (Math.atan2(deltaLng, deltaLat) * 180 / Math.PI + 360) % 360;
        // Offset the heading slightly for a more dynamic view
        // Use a smaller offset for arrival stations to reduce erratic motion
        const headingOffset = isArrival ? 30 : 45;
        const targetHeading = (angleToStation + headingOffset) % 360;
        
        // Set final zoom level - less zoomed for departure to show more context
        const finalZoom = isArrival ? 16 : 15.5;
        
        // Set final tilt - slightly lower for departure
        const finalTilt = isArrival ? 40 : 35;
        
        // Create a cinematic animation with different parameters based on station type
        animateSequence([
          // Starting position (current map state)
          {
            center: currentCenter,
            zoom: currentZoom,
            tilt: currentTilt,
            heading: currentHeading,
            durationMs: 0 // Start immediately
          },
          // First phase: Fly out a bit to get perspective
          {
            center: {
              // For arrival stations, move more directly to reduce erratic motion
              lat: currentCenter.lat + (targetCenter.lat - currentCenter.lat) * (isArrival ? 0.6 : 0.4),
              lng: currentCenter.lng + (targetCenter.lng - currentCenter.lng) * (isArrival ? 0.6 : 0.4)
            },
            zoom: Math.min(currentZoom, isArrival ? 15 : 14.5), // Different intermediate zoom
            tilt: isArrival ? 30 : 25, // Different intermediate tilt
            heading: targetHeading, // Start rotating toward target heading
            durationMs: isArrival ? 900 : 800, // Slightly longer for arrival to feel smoother
            easingFn: 'easeOutQuad'
          },
          // Final position
          {
            center: targetCenter,
            zoom: finalZoom,
            tilt: finalTilt,
            heading: targetHeading,
            durationMs: isArrival ? 1000 : 1100,
            easingFn: 'easeOutCubic'
          }
        ]);
      } catch (error) {
        // Fallback in case of any errors
        console.warn("Error in animateToStation, using fallback animation:", error);
        if (map) {
          map.moveCamera({
            center: targetCenter,
            zoom: isArrival ? 16 : 15.5,
            tilt: isArrival ? 40 : 35,
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
   * Animate to a route view with perspective tilt
   * Enhanced with a smoother transition when coming from station animation
   */
  const animateToRoute = useCallback((routePoints: Array<{lat: number, lng: number}>, priorArrivalAnimation: boolean = false) => {
    if (!map || !routePoints || routePoints.length < 2) return;
    
    // Find route midpoint - use a point slightly closer to the start to improve context
    const midIndex = Math.floor(routePoints.length * 0.4); // 40% along the route
    const midpoint = routePoints[midIndex];
    
    // Calculate route direction for heading
    // We'll use the first and last points to determine overall direction
    const startPoint = routePoints[0];
    const endPoint = routePoints[routePoints.length - 1];
    const deltaLat = endPoint.lat - startPoint.lat;
    const deltaLng = endPoint.lng - startPoint.lng;
    
    // Calculate route direction angle (0° is North, increases clockwise)
    const routeAngle = (Math.atan2(deltaLng, deltaLat) * 180 / Math.PI + 360) % 360;
    
    // We want to view the route from the side
    // Use a smaller perpendicular offset to make the transition less jarring
    const viewingAngle = (routeAngle + 70) % 360; // 70° instead of 90° for more natural view
    
    try {
      // Get current camera state
      const center = map.getCenter();
      if (!center) {
        // If we can't get the center, use a simple animation
        map.moveCamera({
          center: midpoint,
          zoom: 14.5, // Slightly wider view
          tilt: 45, // Less extreme tilt
          heading: viewingAngle
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
      
      // If we're coming right after an arrival station animation, use a more subtle transition
      if (priorArrivalAnimation) {
        // Single smooth transition to route view
        animateSequence([
          // Starting position
          {
            center: currentCenter,
            zoom: currentZoom,
            tilt: currentTilt, 
            heading: currentHeading,
            durationMs: 0
          },
          // Transition directly to a good route view
          {
            center: midpoint,
            zoom: 14.5, // Slightly wider view to show more of route
            tilt: 45, // Less extreme tilt
            heading: viewingAngle,
            durationMs: 1500, // Longer, smoother animation
            easingFn: 'easeOutCubic' 
          }
        ]);
      } else {
        // Standard two-phase animation
        animateSequence([
          // Starting position
          {
            center: currentCenter,
            zoom: currentZoom,
            tilt: currentTilt,
            heading: currentHeading,
            durationMs: 0
          },
          // Intermediate position: pull out to see more of the route
          {
            center: {
              lat: midpoint.lat + 0.0010, // Less extreme offset
              lng: midpoint.lng + 0.0010
            },
            zoom: 14, // Wider view
            tilt: 30, // Begin tilting
            heading: viewingAngle, // Rotate to view angle
            durationMs: 1000,
            easingFn: 'easeOutQuad'
          },
          // Final position with elevated tilt for dramatic route view
          {
            center: midpoint,
            zoom: 14.5, // Balance between seeing route and details
            tilt: 45, // Less extreme tilt for better usability
            heading: viewingAngle,
            durationMs: 1200,
            easingFn: 'easeOutCubic'
          }
        ]);
      }
    } catch (error) {
      // Fallback in case of any errors
      console.warn("Error in animateToRoute, using fallback animation:", error);
      if (map) {
        map.moveCamera({
          center: midpoint,
          zoom: 14.5,
          tilt: 45,
          heading: viewingAngle
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
   * Now with better handling of transitions between steps
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
      // Check if we just came from station animation
      const fromStationAnimation = 
        (bookingAnimationStateRef.current.lastStep === 3 && 
         bookingAnimationStateRef.current.lastArrId === arrId &&
         bookingAnimationStateRef.current.stationAnimationComplete);
         
      if (routeCoords?.length > 1) {
        // Use enhanced route animation with smooth transition parameter
        animateToRoute(routeCoords, fromStationAnimation);
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
  
  // userLocation changes (from Locate Me button)
  useEffect(() => {
    if (!userLocation) return;
    
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
    
    // Only animate if no search animation is in progress
    if (acquireAnimationLock('user', 1000)) {
      // Use a wider zoom for user location to show more context
      animateToLocation(userLocation, 15);
    }
  }, [userLocation, acquireAnimationLock, animateToLocation]);

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