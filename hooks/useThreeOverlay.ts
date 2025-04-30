import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { StationFeature } from "@/store/stationsSlice";
import { latLngAltToVector3 } from "@/lib/geo-utils";
import { logger } from "@/lib/logger";

import { useAppSelector } from "@/store/store";
import { selectStations3D } from "@/store/stations3DSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
  selectRouteDecoded,
  selectBookingStep,
} from "@/store/bookingSlice";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { selectUserLocation } from "@/store/userSlice";
import { selectAllStations } from "@/store/stationsSlice";
import { CatmullRomCurve3 } from "three";

// Throttle function removed - no longer needed since we removed pointermove handler

// Utility hook to store latest value in a ref
// This prevents re-renders when the value changes
function useLatest<T>(value: T) {
  const ref = useRef<T>(value);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref;
}

// --- SINGLETON DracoLoader so it isn't re-instantiated on each context restore ---
const dracoLoaderSingleton = new DRACOLoader();
dracoLoaderSingleton.setDecoderPath("/draco/"); // Adjust path if needed

// Model cache with LRU eviction - safer implementation
class ModelLRUCache {
  private cache = new Map<string, THREE.Group>();
  private keys: string[] = [];
  private maxSize: number = 20; // Maximum number of models to keep
  private activelyUsed = new Set<string>(); // Track which models are actively being used

  set(key: string, model: THREE.Group): void {
    try {
      // Store only the original, not a clone
      if (this.cache.has(key)) {
        // Move key to the end (most recently used)
        this.keys = this.keys.filter(k => k !== key);
        this.keys.push(key);
      } else {
        // Add new key
        this.keys.push(key);
        // Evict oldest if needed, but only if not in active use
        this.enforceLimit();
      }
      this.cache.set(key, model);
      this.activelyUsed.add(key); // Mark as actively used
    } catch (err) {
      logger.error("[ModelLRUCache] Error setting model in cache:", err);
    }
  }

  get(key: string): THREE.Group | undefined {
    try {
      const model = this.cache.get(key);
      if (model) {
        // Move to end of keys (mark as recently used)
        this.keys = this.keys.filter(k => k !== key);
        this.keys.push(key);
        this.activelyUsed.add(key); // Mark as actively used
      }
      return model;
    } catch (err) {
      logger.error("[ModelLRUCache] Error getting model from cache:", err);
      return undefined;
    }
  }

  // Mark a model as no longer actively used
  release(key: string): void {
    this.activelyUsed.delete(key);
  }

  // Remove oldest items if we exceed the limit
  private enforceLimit(): void {
    // Only evict models that aren't actively in use
    const evictableCandidates = this.keys.filter(k => !this.activelyUsed.has(k));
    
    // If we're over the limit, try to remove evictable candidates
    while (this.keys.length > this.maxSize && evictableCandidates.length > 0) {
      const oldestEvictableIndex = this.keys.findIndex(k => !this.activelyUsed.has(k));
      if (oldestEvictableIndex >= 0) {
        const oldestKey = this.keys.splice(oldestEvictableIndex, 1)[0];
        const model = this.cache.get(oldestKey);
        if (model) {
          try {
            // Properly dispose of geometries and materials
            model.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(material => {
                    this.disposeTextures(material);
                    material.dispose();
                  });
                } else if (obj.material) {
                  this.disposeTextures(obj.material);
                  obj.material.dispose();
                }
              }
            });
          } catch (err) {
            logger.warn("[ModelLRUCache] Error disposing model:", err);
          }
        }
        this.cache.delete(oldestKey);
        logger.debug(`[ModelLRUCache] Evicted model: ${oldestKey}`);
      } else {
        // No more evictable models - break to avoid infinite loop
        break;
      }
    }
  }

  // Helper to safely dispose textures
  private disposeTextures(material: THREE.Material): void {
    try {
      const textureProps = [
        'map', 'normalMap', 'bumpMap', 'emissiveMap', 'displacementMap',
        'specularMap', 'metalnessMap', 'roughnessMap', 'alphaMap', 'aoMap'
      ];
      
      textureProps.forEach(prop => {
        const texture = (material as any)[prop];
        if (texture && texture.isTexture) {
          texture.dispose();
        }
      });
    } catch (err) {
      logger.warn("[ModelLRUCache] Error disposing textures:", err);
    }
  }

  // Safer clear function
  clear(): void {
    try {
      // Copy keys to avoid modification during iteration
      const keysToDispose = [...this.keys];
      
      // Only dispose models that aren't actively in use
      keysToDispose
        .filter(key => !this.activelyUsed.has(key))
        .forEach(key => {
          const model = this.cache.get(key);
          if (model) {
            model.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                if (obj.geometry) obj.geometry.dispose();
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(material => {
                    this.disposeTextures(material);
                    material.dispose();
                  });
                } else if (obj.material) {
                  this.disposeTextures(obj.material);
                  obj.material.dispose();
                }
              }
            });
            this.cache.delete(key);
            this.keys = this.keys.filter(k => k !== key);
          }
        });
      
      logger.debug(`[ModelLRUCache] Cleared ${keysToDispose.length} models from cache`);
    } catch (err) {
      logger.error("[ModelLRUCache] Error clearing cache:", err);
    }
  }
}

const modelCache = new ModelLRUCache();

interface ThreeOverlayOptions {
  onStationSelected?: (stationId: number) => void;
}

export function useThreeOverlay(
  googleMap: google.maps.Map | null | undefined,
  stations: StationFeature[],
  options?: ThreeOverlayOptions
) {
  // references to the Google WebGL overlay
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);

  // references for scene/camera/renderer
  const cursorRef = useRef<THREE.Group | null>(null);
  const navigationCursorRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Single array for building groups (mesh only now)
  const buildingGroupsRef = useRef<THREE.Group[]>([]);

  // Redux states with useLatest to prevent unnecessary re-renders
  const userLocationValue = useAppSelector(selectUserLocation);
  const userLocation = useLatest(userLocationValue);
  
  const bookingStepValue = useAppSelector(selectBookingStep);
  const bookingStep = useLatest(bookingStepValue);
  
  const departureStationIdValue = useAppSelector(selectDepartureStationId);
  const departureStationId = useLatest(departureStationIdValue);
  
  const arrivalStationIdValue = useAppSelector(selectArrivalStationId);
  const arrivalStationId = useLatest(arrivalStationIdValue);
  
  const allStationsValue = useAppSelector(selectAllStations);
  const allStations = useLatest(allStationsValue);
  
  const buildings3DValue = useAppSelector(selectStations3D);
  const buildings3D = useLatest(buildings3DValue);
  
  const routeDecodedValue = useAppSelector(selectRouteDecoded);
  const routeDecoded = useLatest(routeDecodedValue);

  // Route tube references
  const routeTubeRef = useRef<THREE.Mesh | null>(null);
  const tubeMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Store route data to handle "scene not ready" case
  const routeDataRef = useRef<Array<{ lat: number; lng: number }>>([]);

  // We'll store a CatmullRomCurve3 for the route so we can animate on it
  const routeCurveRef = useRef<CatmullRomCurve3 | null>(null);
  // Track the start time for our animation
  const routeStartTimeRef = useRef<number | null>(null);

  // Anchor for local coordinate transforms
  const anchorRef = useRef({ lat: 0, lng: 0, altitude: 0 });
  const isInitializedRef = useRef(false);

  // Raycaster references
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const invProjMatrixRef = useRef<THREE.Matrix4 | null>(null);
  const removePointerListenerRef = useRef<() => void>(() => {});

  // Optimization references
  const needsUpdateRef = useRef(true); // Start with true to ensure initial update
  const animationLoopActiveRef = useRef(false);
  const animateRoute = useRef<() => void>(() => {});
  const animationTimerRef = useRef<number | null>(null); // For animation heartbeat
  
  // Animation performance optimization
  const lastFrameTimeRef = useRef<number>(0);
  const targetFpsRef = useRef<number>(60); // Target 60fps for animations

  // Colors
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0x657382); // Darker gray for better contrast
  const BUILDING_SELECTED_COLOR = new THREE.Color(0xffffff); // Pure white for selected stations
  const ROUTE_TUBE_COLOR = new THREE.Color(0x3E6AE1); // Blue color for route tubes

  // Clock ref for simple animation (used for "breathing" effect)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // ------------------------------------------------
  // 1. Building extrude helper (edges removed)
  // ------------------------------------------------
  function createExtrudedBuilding(
    building: any,
    anchor: { lat: number; lng: number; altitude: number },
    defaultColor: THREE.Color,
    index: number
  ): THREE.Group {
    const coords = building.geometry.coordinates[0];
    const buildingAltitude = 0;
    const buildingHeight = building.properties?.topHeight ?? 250;

    const absolutePoints: THREE.Vector3[] = [];
    let sumX = 0;
    let sumY = 0;

    coords.forEach(([lng, lat]: [number, number]) => {
      const { x, y } = latLngAltToVector3(
        { lat, lng, altitude: buildingAltitude },
        anchor
      );
      absolutePoints.push(new THREE.Vector3(x, y, 0));
      sumX += x;
      sumY += y;
    });

    // Compute average center of all polygon points
    const centerX = sumX / coords.length;
    const centerY = sumY / coords.length;

    // Build a shape at local(0,0)
    const shape = new THREE.Shape();
    absolutePoints.forEach((pt, idx) => {
      const localX = pt.x - centerX;
      const localY = pt.y - centerY;
      if (idx === 0) {
        shape.moveTo(localX, localY);
      } else {
        shape.lineTo(localX, localY);
      }
    });
    shape.closePath();

    // Extrude geometry
    const extrudeSettings = {
      depth: buildingHeight,
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Plain opaque material (no edges, no transparency)
    const material = new THREE.MeshLambertMaterial({
      color: defaultColor,
      side: THREE.FrontSide,
    });
    const buildingMesh = new THREE.Mesh(geometry, material);

    const group = new THREE.Group();
    group.add(buildingMesh);

    // Store some userData for picking
    group.userData.centerPos = new THREE.Vector3(centerX, centerY, 0);
    group.userData.index = index;
    group.userData.buildingHeight = buildingHeight;

    const objectId = building.properties?.ObjectId;
    group.userData.objectId = objectId;
    group.userData.placeName = building.properties?.Place || `Bldg ${index}`;

    // Compute bounding box for station marker placement
    const boundingBox = new THREE.Box3().setFromPoints(absolutePoints);
    const boundingCenter = boundingBox.getCenter(new THREE.Vector3());
    const boundingSize = boundingBox.getSize(new THREE.Vector3());
    const boundingRadius = 0.5 * Math.max(boundingSize.x, boundingSize.y);

    group.userData.boundingCenter = boundingCenter;
    group.userData.boundingRadius = boundingRadius;

    return group;
  }

  // ------------------------------------------------
  // Helper function to flag scene updates
  // ------------------------------------------------
  // For most state changes, we just flag the scene as needing update and let
  // WebGLOverlayView's natural render cycle handle it. However, for animations 
  // that need to run continuously (even without user interaction), we use 
  // direct requestRedraw() calls to maintain consistent frame rates.
  // ------------------------------------------------
  const markNeedsUpdate = useCallback(() => {
    // Simply flag that state has changed - let WebGLOverlayView handle redraws
    needsUpdateRef.current = true;
  }, []);
  
  // ------------------------------------------------
  // Model loading utility with proper caching and reference tracking
  // ------------------------------------------------
  const loadModel = useCallback((url: string, onLoad: (model: THREE.Group) => void) => {
    try {
      // Check if already in cache
      const cachedModel = modelCache.get(url);
      if (cachedModel) {
        // Create a clone of the cached model - only clone on get
        const clone = cachedModel.clone();
        onLoad(clone);
        return;
      }
      
      // If not in cache, load it
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoaderSingleton);
      
      loader.load(
        url,
        (gltf) => {
          try {
            const model = gltf.scene;
            // Store original in cache, not a clone
            modelCache.set(url, model);
            // Create a clone for the caller
            onLoad(model.clone());
            markNeedsUpdate();
          } catch (err) {
            logger.error(`[useThreeOverlay] Error processing loaded model ${url}:`, err);
            // Try to provide a fallback empty group if processing fails
            onLoad(new THREE.Group());
          }
        },
        undefined,
        (err) => {
          logger.error(`[useThreeOverlay] ${url} load error:`, err);
          // Provide an empty model on error to avoid breaking the UI
          onLoad(new THREE.Group());
        }
      );
    } catch (err) {
      logger.error(`[useThreeOverlay] Critical error in loadModel for ${url}:`, err);
      // Provide an empty model on critical error
      setTimeout(() => onLoad(new THREE.Group()), 0);
    }
  }, [markNeedsUpdate]);

  // ------------------------------------------------
  // Animation control functions
  // ------------------------------------------------
  const startRouteAnimation = useCallback(() => {
    if (animationLoopActiveRef.current) return;
    
    // Double check we have a valid curve before starting animation
    if (!routeCurveRef.current) {
      logger.warn("[useThreeOverlay] Attempted to start route animation without valid curve");
      return;
    }
    
    logger.debug("[useThreeOverlay] Starting route animation");
    
    animationLoopActiveRef.current = true;
    routeStartTimeRef.current = performance.now();
    
    // Set up animation loop parameters
    const routeDurationMs = 12000;
    const CAR_FRONT = new THREE.Vector3(0, 1, 0);
    
    // Create reusable animation function with FPS throttling
    animateRoute.current = (timestamp: number = performance.now()) => {
      if (!animationLoopActiveRef.current) return;
      
      // FPS throttling for efficiency
      const timeSinceLastFrame = timestamp - lastFrameTimeRef.current;
      const targetFrameTime = 1000 / targetFpsRef.current;
      
      // Only process animation at target framerate
      if (timeSinceLastFrame >= targetFrameTime) {
        lastFrameTimeRef.current = timestamp;
        
        // Use cached refs
        const navCursor = navigationCursorRef.current;
        const curve = routeCurveRef.current;
        const overlay = overlayRef.current;
        
        if (navCursor && curve && navCursor.visible && overlay) {
          try {
            // Inline routeStartTimeRef - no need for a ref
            const elapsed = timestamp - (routeStartTimeRef.current || 0);
            const t = (elapsed % routeDurationMs) / routeDurationMs;
            
            let didUpdatePosition = false;
            
            // Check if curve has getPointAt method before calling it
            if (typeof curve.getPointAt === 'function') {
              try {
                // Create a temporary vector to hold the position
                const curvePoint = new THREE.Vector3();
                
                // Check if the curve has any valid points
                if (curve.points && curve.points.length > 0) {
                  curve.getPointAt(t, curvePoint);
                  
                  // Safely update position
                  navCursor.position.copy(curvePoint);
                  navCursor.position.z += 1; // Altitude offset
                  didUpdatePosition = true;
                  
                  // Update orientation only if getTangentAt is available
                  if (typeof curve.getTangentAt === 'function') {
                    const tangent = new THREE.Vector3();
                    curve.getTangentAt(t, tangent);
                    if (tangent.length() > 0) { // Make sure tangent is valid
                      navCursor.quaternion.setFromUnitVectors(
                        CAR_FRONT,
                        tangent.normalize()
                      );
                    }
                  }
                }
              } catch (err) {
                // If any error occurs during curve animation, log it and stop the animation
                logger.error("[useThreeOverlay] Error in curve animation:", err);
                stopRouteAnimation();
              }
            }
            
            // For animations, we need to force a redraw to ensure continuous motion
            if (didUpdatePosition) {
              // Set the update flag for consistency, though redundant with requestRedraw
              needsUpdateRef.current = true;
              // Request redraw directly for animations to maintain consistent frame rate
              overlay.requestRedraw();
            }
          } catch (err) {
            // Log the error but don't crash the animation
            console.error("[useThreeOverlay] Error in animation:", err);
          }
        }
      }
      
      // Request next frame only if animation is still active
      if (animationLoopActiveRef.current) {
        requestAnimationFrame(animateRoute.current);
      }
    };
    
    // Start the animation loop
    requestAnimationFrame(animateRoute.current);
  }, [markNeedsUpdate]);
  
  const stopRouteAnimation = useCallback(() => {
    animationLoopActiveRef.current = false;
  }, []);

  // ------------------------------------------------
  // 2. Refresh or create the route tube
  // ------------------------------------------------
  const refreshRouteTube = useCallback(() => {
    try {
      const path = routeDataRef.current;
      if (!path || path.length < 2 || !sceneRef.current || !overlayRef.current) {
        return;
      }
  
      if (!tubeMaterialRef.current) {
        tubeMaterialRef.current = new THREE.MeshStandardMaterial({
          color: ROUTE_TUBE_COLOR,
          emissive: ROUTE_TUBE_COLOR,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.9,
          side: THREE.FrontSide,
        });
      }
  
      // Convert lat/lng to Vector3
      const anchor = anchorRef.current;
      const points = path.map(({ lat, lng }) => {
        const { x, y, z } = latLngAltToVector3({ lat, lng, altitude: 0 }, anchor);
        return new THREE.Vector3(x, y, z);
      });
  
      // Only create curve if we have valid points
      if (points.length >= 2) {
        try {
          // Store the route as a CatmullRomCurve3 for our animation
          routeCurveRef.current = new CatmullRomCurve3(points, false, "catmullrom", 0.2);
          
          // Verify the curve has the required methods for animation
          if (!routeCurveRef.current.getPointAt || !routeCurveRef.current.getTangentAt) {
            logger.warn("[useThreeOverlay] Created curve is missing required methods");
            // Create a simple linear curve as fallback
            routeCurveRef.current = {
              getPointAt: (t: number, target = new THREE.Vector3()) => {
                const i = Math.floor(t * (points.length - 1));
                const j = Math.min(i + 1, points.length - 1);
                const alpha = t * (points.length - 1) - i;
                return target.copy(points[i]).lerp(points[j], alpha);
              },
              getTangentAt: (t: number, target = new THREE.Vector3()) => {
                const i = Math.floor(t * (points.length - 1));
                const j = Math.min(i + 1, points.length - 1);
                return target.copy(points[j]).sub(points[i]).normalize();
              }
            } as CatmullRomCurve3;
          }
          
          routeStartTimeRef.current = null; // reset start time so animation restarts
        } catch (error) {
          logger.error("[useThreeOverlay] Error creating CatmullRomCurve3:", error);
          routeCurveRef.current = null;
        }
    
        // Build a TubeGeometry for the route
        class CustomCurve extends THREE.Curve<THREE.Vector3> {
          private pts: THREE.Vector3[];
          constructor(pts: THREE.Vector3[]) {
            super();
            this.pts = pts;
          }
          getPoint(t: number, target = new THREE.Vector3()) {
            const segment = (this.pts.length - 1) * t;
            const index = Math.floor(segment);
            const alpha = segment - index;
            if (index >= this.pts.length - 1) {
              return target.copy(this.pts[this.pts.length - 1]);
            }
            const p0 = this.pts[index];
            const p1 = this.pts[index + 1];
            return target.copy(p0).lerp(p1, alpha);
          }
        }
    
        const curve = new CustomCurve(points);
        const tubularSegments = Math.min(Math.max(points.length * 1, 16), 50);
        const radius = 5;
        const radialSegments = 4;
        const tubeGeom = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
    
        // Safe reference check before updating tube mesh
        const scene = sceneRef.current;
        if (scene) {
          if (!routeTubeRef.current) {
            // Only create if material exists
            if (tubeMaterialRef.current) {
              const tubeMesh = new THREE.Mesh(tubeGeom, tubeMaterialRef.current);
              tubeMesh.renderOrder = 300;
              tubeMesh.visible = true;
              routeTubeRef.current = tubeMesh;
              scene.add(tubeMesh);
            }
          } else {
            routeTubeRef.current.visible = true;
            routeTubeRef.current.geometry.dispose();
            routeTubeRef.current.geometry = tubeGeom;
          }
        }
      }
  
      // Flag that state has changed - let WebGLOverlayView handle redraw timing
      markNeedsUpdate();
    } catch (error) {
      logger.warn("Error refreshing route tube:", error);
    }
  }, [ROUTE_TUBE_COLOR, markNeedsUpdate]);

  // Watch for routeDecoded changes => store path, refresh tube
  useEffect(() => {
    logger.debug(`[useThreeOverlay] Route data changed: depId=${departureStationId.current}, arrId=${arrivalStationId.current}, routeLen=${routeDecoded.current?.length || 0}, step=${bookingStep.current}`);
    
    // Use .current references for accessing Redux state
    if (!arrivalStationId.current || !departureStationId.current || !routeDecoded.current || routeDecoded.current.length < 2) {
      logger.debug(`[useThreeOverlay] Clearing route - missing required data`);
      
      // Clear the route data
      routeDataRef.current = [];
      
      // Clear route tube if it exists
      if (routeTubeRef.current && routeTubeRef.current.visible) {
        routeTubeRef.current.visible = false;
        
        // Stop any ongoing animation
        stopRouteAnimation();
      }
      
      // Reset the route curve
      routeCurveRef.current = null;
      
      // Flag that state has changed
      markNeedsUpdate();
      return;
    }
    
    // If we have valid departure and arrival stations with route data, always update
    // Use .current references for accessing Redux state
    if (departureStationId.current && arrivalStationId.current && routeDecoded.current.length >= 2) {
      logger.debug(`[useThreeOverlay] Setting route data with ${routeDecoded.current.length} points`);
      
      // Set route data from Redux using .current
      routeDataRef.current = [...routeDecoded.current];
      
      // Refresh the tube with updated route data
      refreshRouteTube();
      markNeedsUpdate();
      
      // If we're already in step 4, make sure the animation starts
      if (bookingStep.current === 4) {
        logger.debug(`[useThreeOverlay] In step 4, ensuring animation is updated`);
        // Ensure curve visibility in next frame
        setTimeout(() => {
          if (routeTubeRef.current) {
            routeTubeRef.current.visible = true;
          }
          markNeedsUpdate();
        }, 0);
      }
    }
  }, [routeDecodedValue, departureStationIdValue, arrivalStationIdValue, bookingStepValue, refreshRouteTube, markNeedsUpdate, stopRouteAnimation]);

  // ------------------------------------------------
  // 3. Station selection callback with camera animations - using CameraAnimationManager
  // ------------------------------------------------
  const handleStationSelected = useCallback(
    (stationId: number) => {
      // Use CameraAnimationManager instead of directly importing useCameraAnimation
      import("@/lib/cameraAnimationManager").then((managerModule) => {
        const cameraAnimationManager = managerModule.default;
        // Let the stationSelectionManager handle the animation through CameraAnimationManager
        import("@/lib/stationSelectionManager").then((stationManagerModule) => {
          const stationSelectionManager = stationManagerModule.default;
          stationSelectionManager.selectStation(stationId, false);
        });
      });
      
      // Also notify parent through callback for backward compatibility
      if (options?.onStationSelected) {
        options.onStationSelected(stationId);
      }
      
      // Flag that selection state has changed
      markNeedsUpdate();
    },
    [options, markNeedsUpdate]
  );

  // ------------------------------------------------
  // 4. Main useEffect to init & teardown
  // ------------------------------------------------
  // Track map event listeners
  const mapListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  
  useEffect(() => {
    // If the map changes, reset initialization state
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      isInitializedRef.current = false;
      
      // Clear model references so they're reloaded only when needed
      cursorRef.current = null;
      navigationCursorRef.current = null;
      
      // Clean up any existing map listeners
      mapListenersRef.current.forEach(listener => listener.remove());
      mapListenersRef.current = [];
    }
    
    // Exit if no map available or already initialized
    if (!googleMap || isInitializedRef.current) return;
    
    logger.debug("[useThreeOverlay] Initializing WebGLOverlayView");
    isInitializedRef.current = true;

    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    overlay.onAdd = () => {
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera();
      camera.far = 100000;
      camera.updateProjectionMatrix();
      cameraRef.current = camera;

      // If anchor not set, use the map center
      const center = googleMap.getCenter();
      if (center && anchorRef.current.lat === 0 && anchorRef.current.lng === 0) {
        anchorRef.current.lat = center.lat();
        anchorRef.current.lng = center.lng();
        anchorRef.current.altitude = 0;
      }

      // 1) Create a simple white circle cursor - CREATED ONCE in onAdd
      logger.debug("[useThreeOverlay] Creating simple white circle cursor");
      
      // Create a group to hold the cursor
      const cursorGroup = new THREE.Group();
      
      // Create an extruded circle (cylinder with minimal height)
      const circleGeometry = new THREE.CylinderGeometry(15, 15, 2, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,  // White color
        transparent: true,
        opacity: 0.8
      });
      const circle = new THREE.Mesh(circleGeometry, circleMaterial);
      
      // Create a smaller inner circle for contrast
      const innerCircleGeometry = new THREE.CylinderGeometry(5, 5, 3, 32);
      const innerCircleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF,  // Also white
        transparent: true,
        opacity: 1.0
      });
      const innerCircle = new THREE.Mesh(innerCircleGeometry, innerCircleMaterial);
      innerCircle.position.set(0, 0, 1); // Slightly above the main circle
      
      // Add circles to the group
      cursorGroup.add(circle);
      cursorGroup.add(innerCircle);
      
      // Initial position and visibility
      cursorGroup.visible = false;
      cursorGroup.rotation.set(Math.PI/2, 0, 0); // Align with ground
      
      // Add to scene
      scene.add(cursorGroup);
      cursorRef.current = cursorGroup;
      
      logger.debug("[useThreeOverlay] Simple circle cursor added to scene");
      
      // Create extruded buildings
      const validBuildings = buildings3D.current.filter((b: any) => {
        const coords = b.geometry.coordinates[0];
        if (!coords || coords.length < 3) return false;
        const [lng, lat] = coords[0];
        return Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
      });

      validBuildings.forEach((building, i) => {
        try {
          const group = createExtrudedBuilding(
            building,
            anchorRef.current,
            BUILDING_DEFAULT_COLOR,
            i
          );
          const objectId = building.properties?.ObjectId;
          // link station if matched
          const matchingStation = stations.find(
            (s) => s.properties.ObjectId === objectId
          );
          if (matchingStation) {
            group.userData.stationId = matchingStation.id;
          }
          scene.add(group);
          buildingGroupsRef.current.push(group);
        } catch (err) {
          logger.error("[useThreeOverlay] building creation error:", err);
        }
      });

      refreshRouteTube();
    };

    overlay.onContextRestored = ({ gl }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!scene || !camera) return;

      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });
      renderer.autoClear = false;
      rendererRef.current = renderer;

      // Basic lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(50, 100, 200);
      scene.add(directionalLight);

      // Reuse the single, global DracoLoader
      // Create a loader with a reference in the ref so it can persist between renders
      // This helps avoid creating redundant loaders and avoids unnecessary loading operations
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoaderSingleton);

      // The user location cursor is now created once in onAdd

      // 2) Load cursor_navigation for step 3 & route animation - use cached model loader
      if (!navigationCursorRef.current) {
        loadModel('/map/cursor_navigation.glb', (originalModel) => {
          const navCursorGroup = new THREE.Group();

          originalModel.scale.setScalar(50);
          const oldEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZXY");
          const q = new THREE.Quaternion().setFromEuler(oldEuler);
          originalModel.rotation.copy(new THREE.Euler().setFromQuaternion(q, "XYZ"));

          // Double-sided
          originalModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          });

          navCursorGroup.add(originalModel);
          navCursorGroup.visible = false;
          scene.add(navCursorGroup);
          navigationCursorRef.current = navCursorGroup;
          
          // Store the model URL in userData for easier reference during cleanup
          navCursorGroup.userData.modelUrl = '/map/cursor_navigation.glb';

          markNeedsUpdate();
        });
      }

      // Set up raycasting
      raycasterRef.current = new THREE.Raycaster();
      invProjMatrixRef.current = new THREE.Matrix4();

      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.zIndex = "50";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "auto";

      // Only create one listener per canvas instance - track with a WeakMap
      // This listener ref is tied directly to this specific instance of the overlay
      const listenerRef = new WeakMap<
        HTMLCanvasElement,
        { pointerDown: (ev: PointerEvent) => void }
      >();
      
      // Check if we already attached a listener to this canvas
      if (!listenerRef.has(canvas)) {
        // Create a clean new listener for pointer down - we only need click/tap interaction
        // We don't need to track hover/pointermove events at all
        const handlePointerDown = (ev: PointerEvent) => {
          pickWithRay(ev);
        };
        
        // Add only pointerdown listener for station selection
        canvas.addEventListener("pointerdown", handlePointerDown);
        
        // Store the handler for cleanup
        listenerRef.set(canvas, {
          pointerDown: handlePointerDown
        });
        
        // Update removal function to clean up the listener
        removePointerListenerRef.current = () => {
          const handlers = listenerRef.get(canvas);
          if (handlers) {
            canvas.removeEventListener("pointerdown", handlers.pointerDown);
            listenerRef.delete(canvas);
          }
        };
      }

      refreshRouteTube();
    };

    const pickWithRay = (ev: PointerEvent) => {
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const raycaster = raycasterRef.current;
      const invProj = invProjMatrixRef.current;
      if (!camera || !renderer || !raycaster || !invProj) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const ndcX = (x / rect.width) * 2 - 1;
      const ndcY = 1 - (y / rect.height) * 2;

      invProj.copy(camera.projectionMatrix).invert();
      const origin = new THREE.Vector3(ndcX, ndcY, 0).applyMatrix4(invProj);
      const farPos = new THREE.Vector3(ndcX, ndcY, 0.5).applyMatrix4(invProj);
      const direction = farPos.sub(origin).normalize();

      raycaster.ray.origin.copy(origin);
      raycaster.ray.direction.copy(direction);

      const hits: THREE.Intersection[] = [];
      buildingGroupsRef.current.forEach((group) => {
        // We only have a single mesh child now (no edges)
        const groupHits = raycaster.intersectObjects(group.children, false);
        groupHits.forEach((hit) => {
          (hit as any).buildingGroup = group;
        });
        hits.push(...groupHits);
      });

      if (hits.length > 0) {
        hits.sort((a, b) => a.distance - b.distance);
        const firstHit = hits[0] as any;
        const group = firstHit.buildingGroup;
        const stationId = group.userData.stationId;
        if (stationId) {
          handleStationSelected(stationId);
        } else {
          logger.debug("[useThreeOverlay] Building has no station mapping");
        }
      }
    };

    overlay.onDraw = ({ gl, transformer }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (!scene || !camera || !renderer) return;

      // Update camera projection
      const anchor = anchorRef.current;
      const camMatArr = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix.fromArray(camMatArr);

      // Only perform expensive state updates if something has changed
      if (needsUpdateRef.current) {
        // Reset the flag at the beginning of processing
        needsUpdateRef.current = false;

        // 1) Color buildings (departure/arrival) - using .current references
        buildingGroupsRef.current.forEach((group) => {
          const c = group.userData.centerPos as THREE.Vector3;
          group.position.set(c.x, c.y, 0);

          const stationId = group.userData.stationId;
          const mesh = group.children[0] as THREE.Mesh;
          const mat = mesh.material as THREE.MeshBasicMaterial;

          // Use .current for accessing Redux state
          if (stationId === departureStationId.current || stationId === arrivalStationId.current) {
            mat.color.copy(BUILDING_SELECTED_COLOR);
          } else {
            mat.color.copy(BUILDING_DEFAULT_COLOR);
          }
        });

        // 2) Update user location cursor - using .current references
        if (cursorRef.current) {
          const hasValidLocation =
            userLocation.current != null &&
            typeof userLocation.current.lat === "number" &&
            typeof userLocation.current.lng === "number";
          
          // Position cursor only when we have a valid location
          if (hasValidLocation && userLocation.current) { // Extra null check for TypeScript
            // Position update - only if location changed or not initialized
            if (!cursorRef.current.userData.initialPositionSet || 
                cursorRef.current.userData.lastLat !== userLocation.current.lat ||
                cursorRef.current.userData.lastLng !== userLocation.current.lng) {
              
              // Update position
              const { lat, lng } = userLocation.current;
              const { x, y, z } = latLngAltToVector3(
                { lat, lng, altitude: 1 },
                anchor
              );
              cursorRef.current.position.set(x, y, z);
              
              // Store location for change detection
              cursorRef.current.userData.lastLat = userLocation.current.lat;
              cursorRef.current.userData.lastLng = userLocation.current.lng;
              cursorRef.current.userData.initialPositionSet = true;
            }
            
            // Only update visibility when needed
            if (!cursorRef.current.visible) {
              cursorRef.current.visible = true;
            }
          } else if (cursorRef.current.visible) {
            // Hide cursor if no valid location
            cursorRef.current.visible = false;
          }
        }
      }

      // Updates that should run every frame regardless of needsUpdate flag
      
      // 3) Step 3 or 4: controlling navigationCursorRef - using .current references
      if (navigationCursorRef.current) {
        // Determine visibility state first but don't apply yet - using .current references
        const hasValidCurve = !!(routeCurveRef.current && 
                                typeof routeCurveRef.current.getPointAt === 'function' && 
                                typeof routeCurveRef.current.getTangentAt === 'function');
                                
        const shouldShowNavigationCursor = !!(
          (bookingStep.current === 3 && departureStationId.current != null) || 
          (bookingStep.current === 4 && hasValidCurve)
        );
        
        // If it's booking step 3 with a departure station, update position
        if (bookingStep.current === 3 && departureStationId.current != null) {
          // Only process position updates when cursor should be visible
          if (shouldShowNavigationCursor) {
            // Find station and related building - using allStations.current
            const depStation = allStations.current.find((s) => s.id === departureStationId.current);
            const buildingGroup = depStation ? 
              buildingGroupsRef.current.find((g) => g.userData.stationId === departureStationId.current) : null;
              
            if (buildingGroup) {
              // Calculate position relative to the building
              const boundingCenter = buildingGroup.userData.boundingCenter as THREE.Vector3;
              const boundingRadius = buildingGroup.userData.boundingRadius || 0;
  
              let angle = 0;
              if (userLocation.current != null && 
                  typeof userLocation.current.lat === "number" && 
                  typeof userLocation.current.lng === "number") {
                const userVec = latLngAltToVector3(
                  { lat: userLocation.current.lat, lng: userLocation.current.lng, altitude: 0 },
                  anchor
                );
                const dx = userVec.x - boundingCenter.x;
                const dy = userVec.y - boundingCenter.y;
                angle = Math.atan2(dy, dx);
              }
  
              const margin = 5;
              const offsetDist = boundingRadius + margin;
              const offsetX = boundingCenter.x + offsetDist * Math.cos(angle);
              const offsetY = boundingCenter.y + offsetDist * Math.sin(angle);
  
              // Update position
              navigationCursorRef.current.position.set(offsetX, offsetY, 0); 
  
              // Update material properties - only when visible to save performance
              const elapsed = clockRef.current.getElapsedTime();
              const speed = 1.5;
              const animationTime = elapsed * speed;
              
              // Only update materials ~5 times per second to save CPU
              if (animationTime % 0.2 < 0.02) {
                navigationCursorRef.current.traverse((child) => {
                  if (
                    child instanceof THREE.Mesh &&
                    child.material instanceof THREE.MeshStandardMaterial
                  ) {
                    child.material.emissiveIntensity =
                      0.1 + 0.1 * Math.sin(animationTime);
                  }
                });
              }
            }
          }
        } else if (bookingStep.current === 4 && hasValidCurve) {
          // Use the optimized animation manager instead of creating new animation loops
          if (routeStartTimeRef.current === null && shouldShowNavigationCursor) {
            startRouteAnimation();
          }
        }
        
        // Update visibility only when it changes
        if (navigationCursorRef.current.visible !== shouldShowNavigationCursor) {
          navigationCursorRef.current.visible = shouldShowNavigationCursor;
          
          // Start/stop animation based on visibility
          if (shouldShowNavigationCursor && bookingStep.current === 4 && hasValidCurve) {
            startRouteAnimation();
          } else if (!shouldShowNavigationCursor && animationLoopActiveRef.current) {
            stopRouteAnimation();
          }
        }
      }

      // 4) Keep route tube slightly above ground
      if (routeTubeRef.current) {
        routeTubeRef.current.position.z = 1;
      }
      
      // Render - this happens every frame
      renderer.setViewport(0, 0, gl.canvas.width, gl.canvas.height);
      renderer.render(scene, camera);
      
      renderer.resetState();
    };

    overlay.onContextLost = () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };

    overlay.onRemove = () => {
      const scene = sceneRef.current;
      const renderer = rendererRef.current;

      // Stop any running animations first
      stopRouteAnimation();
      
      // Remove event listeners
      removePointerListenerRef.current();

      // Release all cached models from activelyUsed set to allow proper LRU eviction
      // This addresses a memory leak where models were never released from the activelyUsed set
      if (navigationCursorRef.current) {
        // Release the cursor model URL from activelyUsed set
        const modelUrl = navigationCursorRef.current.userData.modelUrl || '/map/cursor_navigation.glb';
        modelCache.release(modelUrl);
      }

      // Traverse scene to find and release all cloned models
      sceneRef.current?.traverse(obj => {
        if ((obj as any).userData?.srcUrl) {
          modelCache.release((obj as any).userData.srcUrl);
        }
      });

      // Cleanup route tube
      if (routeTubeRef.current) {
        scene?.remove(routeTubeRef.current);
        if (routeTubeRef.current.geometry) {
          routeTubeRef.current.geometry.dispose();
        }
        if (tubeMaterialRef.current) {
          tubeMaterialRef.current.dispose();
          tubeMaterialRef.current = null;
        }
        routeTubeRef.current = null;
      }

      // Cleanup buildings
      buildingGroupsRef.current.forEach((group) => {
        scene?.remove(group);
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else if (child.material) {
              disposeMaterial(child.material);
            }
          }
        });
      });
      buildingGroupsRef.current = [];

      // Cleanup cursors
      if (cursorRef.current) {
        scene?.remove(cursorRef.current);
        cursorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else if (child.material) {
              disposeMaterial(child.material);
            }
          }
        });
        cursorRef.current = null;
      }
      
      if (navigationCursorRef.current) {
        scene?.remove(navigationCursorRef.current);
        navigationCursorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else if (child.material) {
              disposeMaterial(child.material);
            }
          }
        });
        navigationCursorRef.current = null;
      }

      // Reset animation state
      animationLoopActiveRef.current = false;
      routeStartTimeRef.current = null;
      
      // Properly clean up renderer resources but be careful not to break the WebGL context
      if (renderer) {
        // First dispose render lists and programs
        renderer.renderLists.dispose();
        
        // Just dispose the renderer without force-losing context
        // This is safer for Google Maps integration
        renderer.dispose();
        
        // Don't null out the domElement as it's managed by Google Maps
        
        rendererRef.current = null;
      }
      
      // Cleanup scene
      if (sceneRef.current) {
        // Remove and dispose all remaining children
        const scene = sceneRef.current;
        while (scene.children.length > 0) {
          const object = scene.children[0];
          scene.remove(object);
          
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else if (object.material) {
              disposeMaterial(object.material);
            }
          }
        }
        
        // Thoroughly dispose all scene geometries and materials
        scene.traverse(o => { 
          if ((o as any).geometry?.dispose) { 
            (o as any).geometry.dispose(); 
          } 
          if ((o as any).material) { 
            const material = (o as any).material;
            if (Array.isArray(material)) {
              material.forEach(m => m.dispose && m.dispose());
            } else if (material.dispose) {
              material.dispose();
            }
          } 
        });
        
        scene.clear();
        sceneRef.current = null;
      }
      
      
      // Clean up all references
      cameraRef.current = null;
      raycasterRef.current = null;
      invProjMatrixRef.current = null;
      overlayRef.current = null;
      isInitializedRef.current = false;
      
      // We'll let the LRU cache manage itself rather than clearing it completely
      // This avoids sudden blank maps when station selection changes
    };

    overlay.setMap(googleMap);

    return () => {
      overlay.setMap(null);
    };
  }, [
    googleMap,
    stations,
    buildings3D,
    refreshRouteTube,
    handleStationSelected,
    bookingStep,
  ]);

  // No need for idle listener - WebGLOverlayView handles map changes automatically
  useEffect(() => {
    if (!googleMap) return;
    
    // Clean up any existing listeners
    return () => {
      mapListenersRef.current.forEach(l => l.remove());
      mapListenersRef.current = [];
    };
  }, [googleMap]);

  // Flag updates when key state changes
  useEffect(() => {
    markNeedsUpdate();
  }, [departureStationIdValue, arrivalStationIdValue, markNeedsUpdate]);

  // When transitions to step 4, ensure route is visible
  useEffect(() => {
    // When transitioning specifically to step 4, ensure route is visible
    if (bookingStep.current === 4) {
      logger.debug(`[useThreeOverlay] Transition to step 4 detected`);
      
      // If we already have route data, make sure it's visible
      if (routeDataRef.current.length >= 2) {
        logger.debug(`[useThreeOverlay] Ensuring route is visible on step 4 entry`);
        
        // Force refresh the route tube and ensure visibility
        if (routeTubeRef.current) {
          routeTubeRef.current.visible = true;
        } else {
          // If tube doesn't exist yet, force create it
          refreshRouteTube();
        }
        
        // Flag that state has changed
        markNeedsUpdate();
      }
    }
  }, [bookingStepValue, refreshRouteTube, markNeedsUpdate]);

  // Handle arrival station clearing
  useEffect(() => {
    // If arrival station was cleared (changed to null)
    if (arrivalStationId.current === null) {
      // Clear the route data
      routeDataRef.current = [];
      
      // Clear route tube if it exists
      if (routeTubeRef.current) {
        routeTubeRef.current.visible = false;
      }
      
      // Reset the route curve to stop animations
      routeCurveRef.current = null;
      
      // Stop any ongoing animation
      stopRouteAnimation();
      
      // Flag that state has changed
      markNeedsUpdate();
    }
  }, [arrivalStationIdValue, markNeedsUpdate, stopRouteAnimation]);

  // Track whether animation should be running for route
  useEffect(() => {
    // Determine if animation should run
    const shouldAnimateRoute = bookingStep.current === 4 && !!routeCurveRef.current;
    
    // Start or stop the animation based on visibility
    if (shouldAnimateRoute) {
      startRouteAnimation();
    } else {
      stopRouteAnimation();
    }
    
    return () => {
      stopRouteAnimation();
    };
  }, [bookingStepValue, startRouteAnimation, stopRouteAnimation]);

  // Force cursor updates when location is updated from LocateMe button
  useEffect(() => {
    // Listen for the custom location update event 
    const handleLocationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<import("@/lib/UserLocation").LocationUpdateEvent>;
      
      // Only update if the source is a locate-me click
      if (customEvent.detail.source === "locate-me-button") {
        logger.debug("[useThreeOverlay] Handling locate-me button event");
        
        // Reset cursor data to force a fresh position update
        if (cursorRef.current) {
          // Clear cached location data to force update on next render
          cursorRef.current.userData.initialPositionSet = false;
          cursorRef.current.userData.lastLat = undefined;
          cursorRef.current.userData.lastLng = undefined;
          
          // Immediately update position for responsive UI
          const location = customEvent.detail.location;
          if (location) {
            const { x, y, z } = latLngAltToVector3(
              { lat: location.lat, lng: location.lng, altitude: 1 },
              anchorRef.current
            );
            
            // Update cursor position
            cursorRef.current.position.set(x, y, z);
            cursorRef.current.visible = true;
            
            logger.debug("[useThreeOverlay] Cursor positioned at:", location);
          }
        }
        
        // Flag that state has changed
        markNeedsUpdate();
      }
    };
    
    // Add listener for custom event
    window.addEventListener("user-location-updated", handleLocationUpdate);
    
    // Clean up
    return () => {
      window.removeEventListener("user-location-updated", handleLocationUpdate);
    };
  }, [markNeedsUpdate]);
  
  // Flag scene for update when key data changes
  useEffect(() => {
    markNeedsUpdate();
  }, [userLocationValue, bookingStepValue, departureStationIdValue, arrivalStationIdValue, markNeedsUpdate]);

  return { overlayRef };
}

// Helper to dispose materials
function disposeMaterial(mtl: THREE.Material | THREE.Material[]) {
  if (Array.isArray(mtl)) {
    mtl.forEach((sub) => sub.dispose());
  } else {
    mtl.dispose();
  }
}