import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { StationFeature } from "@/store/stationsSlice";
import { latLngAltToVector3 } from "@/lib/geo-utils";

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

// --- SINGLETON DracoLoader so it isn't re-instantiated on each context restore ---
const dracoLoaderSingleton = new DRACOLoader();
dracoLoaderSingleton.setDecoderPath("/draco/"); // Adjust path if needed

interface ThreeOverlayOptions {
  onStationSelected?: (stationId: number) => void;
}

export function useThreeOverlay(
  googleMap: google.maps.Map | null,
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

  // Redux states
  const userLocation = useAppSelector(selectUserLocation);
  const bookingStep = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const allStations = useAppSelector(selectAllStations);
  const buildings3D = useAppSelector(selectStations3D);
  const routeDecoded = useAppSelector(selectRouteDecoded);

  // Route tube references
  const routeTubeRef = useRef<THREE.Mesh | null>(null);
  const tubeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);

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

  // Colors
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0xcccccc);
  const BUILDING_DEPARTURE_COLOR = new THREE.Color(0x00ff00);
  const BUILDING_ARRIVAL_COLOR = new THREE.Color(0x0000ff);
  const ROUTE_TUBE_COLOR = new THREE.Color(0xffffff);

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
  // 2. Refresh or create the route tube
  // ------------------------------------------------
  const refreshRouteTube = useCallback(() => {
    try {
      const path = routeDataRef.current;
      if (!path || path.length < 2 || !sceneRef.current || !overlayRef.current) {
        return;
      }
  
      if (!tubeMaterialRef.current) {
        tubeMaterialRef.current = new THREE.MeshBasicMaterial({
          color: ROUTE_TUBE_COLOR,
          transparent: true,
          opacity: 0.9,
          side: THREE.FrontSide,
        });
      }
  
      // Convert lat/lng to Vector3
      const anchor = anchorRef.current;
      const points = path.map(({ lat, lng }) => {
        const { x, y, z } = latLngAltToVector3({ lat, lng, altitude: 5 }, anchor);
        return new THREE.Vector3(x, y, z);
      });
  
      // Only create curve if we have valid points
      if (points.length >= 2) {
        // Store the route as a CatmullRomCurve3 for our animation
        routeCurveRef.current = new CatmullRomCurve3(points, false, "catmullrom", 0.2);
        routeStartTimeRef.current = null; // reset start time so animation restarts
    
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
  
      // Request redraw after updates
      overlayRef.current.requestRedraw();
    } catch (error) {
      console.warn("Error refreshing route tube:", error);
    }
  }, [ROUTE_TUBE_COLOR]);

  // Watch for routeDecoded changes => store path, refresh tube
  useEffect(() => {
    if (departureStationId && arrivalStationId && routeDecoded?.length >= 2) {
      routeDataRef.current = routeDecoded;
    } else {
      routeDataRef.current = [];
    }
    refreshRouteTube();
  }, [routeDecoded, departureStationId, arrivalStationId, refreshRouteTube]);

  // ------------------------------------------------
  // 3. Station selection callback - now uses stationSelectionManager
  // ------------------------------------------------
  const handleStationSelected = useCallback(
    (stationId: number) => {
      // First use our centralized selection manager
      import("@/lib/stationSelectionManager").then(module => {
        const stationSelectionManager = module.default;
        stationSelectionManager.selectStation(stationId, false);
      });
      
      // Also notify parent through callback for backward compatibility
      if (options?.onStationSelected) {
        options.onStationSelected(stationId);
      }
    },
    [options]
  );

  // ------------------------------------------------
  // 4. Main useEffect to init & teardown
  // ------------------------------------------------
  useEffect(() => {
    if (!googleMap || isInitializedRef.current) return;
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

      // Create extruded buildings
      const validBuildings = buildings3D.filter((b: any) => {
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
          console.error("[useThreeOverlay] building creation error:", err);
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
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoaderSingleton);

      // 1) Load user location \"cursor_animated\" with cache-busting
      const timestamp = Date.now(); // Add timestamp for cache busting
      loader.load(
        `/models/cursor_animated?v=${timestamp}`,
        (gltf) => {
          const originalModel = gltf.scene;
          const cursorGroup = new THREE.Group();

          // Scale, rotation
          originalModel.scale.setScalar(15);
          const oldEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZXY");
          const q = new THREE.Quaternion().setFromEuler(oldEuler);
          originalModel.rotation.copy(new THREE.Euler().setFromQuaternion(q, "XYZ"));

          // Double-sided, no extra transparency
          originalModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          });

          cursorGroup.add(originalModel);
          cursorGroup.visible = false;
          scene.add(cursorGroup);
          cursorRef.current = cursorGroup;

          overlayRef.current?.requestRedraw();
        },
        undefined,
        (err) => {
          console.error("[useThreeOverlay] /models/cursor_animated load error:", err);
          // Fallback to the original cursor if the animated one fails
          loader.load(
            `/models/cursor?v=${timestamp}`,
            (gltf) => {
              const fallbackModel = gltf.scene;
              const fallbackGroup = new THREE.Group();
              
              fallbackModel.scale.setScalar(15);
              const oldEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZXY");
              const q = new THREE.Quaternion().setFromEuler(oldEuler);
              fallbackModel.rotation.copy(new THREE.Euler().setFromQuaternion(q, "XYZ"));
              
              fallbackModel.traverse((child) => {
                if (child instanceof THREE.Mesh && child.material) {
                  child.material.side = THREE.DoubleSide;
                  child.material.needsUpdate = true;
                }
              });
              
              fallbackGroup.add(fallbackModel);
              fallbackGroup.visible = false;
              scene.add(fallbackGroup);
              cursorRef.current = fallbackGroup;
              
              overlayRef.current?.requestRedraw();
            },
            undefined,
            (fallbackErr) => console.error("[useThreeOverlay] Fallback /models/cursor load error:", fallbackErr)
          );
        }
      );

      // 2) Load \"cursor_navigation\" for step 3 & route animation with cache-busting
      loader.load(
        `/models/cursor_navigation?v=${timestamp}`,
        (gltf) => {
          const originalModel = gltf.scene;
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

          overlayRef.current?.requestRedraw();
        },
        undefined,
        (err) =>
          console.error("[useThreeOverlay] /models/cursor_navigation load error:", err)
      );

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

      const handlePointerDown = (ev: PointerEvent) => {
        pickWithRay(ev);
      };
      canvas.addEventListener("pointerdown", handlePointerDown);
      removePointerListenerRef.current = () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
      };

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
          console.log("[useThreeOverlay] Building has no station mapping");
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

      // 1) Color buildings (departure/arrival)
      buildingGroupsRef.current.forEach((group) => {
        const c = group.userData.centerPos as THREE.Vector3;
        group.position.set(c.x, c.y, 0);

        const stationId = group.userData.stationId;
        const mesh = group.children[0] as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;

        if (stationId === departureStationId) {
          mat.color.copy(BUILDING_DEPARTURE_COLOR);
        } else if (stationId === arrivalStationId) {
          mat.color.copy(BUILDING_ARRIVAL_COLOR);
        } else {
          mat.color.copy(BUILDING_DEFAULT_COLOR);
        }
      });

      // 2) Update user location cursor
      // 2) Handle user location cursor similar to building models (always update properties, update visibility last)
      if (cursorRef.current) {
        const hasValidLocation =
          userLocation &&
          typeof userLocation.lat === "number" &&
          typeof userLocation.lng === "number";

        // Always update position and animation when location is valid
        if (hasValidLocation) {
          const { lat, lng } = userLocation!;
          const { x, y, z } = latLngAltToVector3(
            { lat, lng, altitude: 10 },
            anchor
          );
          cursorRef.current.position.set(x, y, z);

          // Subtle breathing animation
          const elapsed = clockRef.current.getElapsedTime();
          const breathingSpeed = 1.5;
          cursorRef.current.traverse((child) => {
            if (
              child instanceof THREE.Mesh &&
              child.material instanceof THREE.MeshStandardMaterial
            ) {
              // example: a mild pulsing
              child.material.emissiveIntensity =
                0.1 + 0.1 * Math.sin(elapsed * breathingSpeed);
            }
          });
        }
        
        // Only update visibility at the end after all updates are done
        // This prevents flickering during property updates
        const newVisibility = !!hasValidLocation;
        if (cursorRef.current.visible !== newVisibility) {
          cursorRef.current.visible = newVisibility;
        }
      }

      // 3) Step 3 or 4: controlling navigationCursorRef - treat like a persistent 3D model
      if (navigationCursorRef.current) {
        // Determine visibility state first but don't apply yet
        // Explicit boolean type to avoid type errors
        const shouldShowNavigationCursor: boolean = !!(
          (bookingStep === 3 && departureStationId != null) || 
          (bookingStep === 4 && routeCurveRef.current)
        );
        
        let shouldUpdateVisibility = false;
        let newPosition = new THREE.Vector3();
        
        // Update position and properties without changing visibility
        if (bookingStep === 3 && departureStationId != null) {
          // Find station and related building
          const depStation = allStations.find((s) => s.id === departureStationId);
          const buildingGroup = depStation ? 
            buildingGroupsRef.current.find((g) => g.userData.stationId === departureStationId) : null;
            
          if (buildingGroup) {
            // Calculate position relative to the building
            const boundingCenter = buildingGroup.userData.boundingCenter as THREE.Vector3;
            const boundingRadius = buildingGroup.userData.boundingRadius || 0;

            let angle = 0;
            if (userLocation) {
              const userVec = latLngAltToVector3(
                { lat: userLocation.lat, lng: userLocation.lng, altitude: 0 },
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

            // Update position data without changing visibility yet
            newPosition.set(offsetX, offsetY, 0);
            navigationCursorRef.current.position.copy(newPosition);
            shouldUpdateVisibility = true;

            // Update material properties
            const elapsed = clockRef.current.getElapsedTime();
            const speed = 1.5;
            navigationCursorRef.current.traverse((child) => {
              if (
                child instanceof THREE.Mesh &&
                child.material instanceof THREE.MeshStandardMaterial
              ) {
                child.material.emissiveIntensity =
                  0.1 + 0.1 * Math.sin(elapsed * speed);
              }
            });
          }
        } else if (bookingStep === 4 && routeCurveRef.current) {
          // Route animation - don't toggle visibility directly
          shouldUpdateVisibility = true;
          
          // Only initialize animation once
          if (routeStartTimeRef.current === null && shouldShowNavigationCursor) {
            routeStartTimeRef.current = performance.now();
            
            if (rendererRef.current) {
              const routeDurationMs = 12000; // total animation time
              const CAR_FRONT = new THREE.Vector3(0, 1, 0);
              
              // Store a stable reference to ensure animation continues with same data
              const stableRouteRef = routeCurveRef.current;
              
              // Create animation loop only once
              rendererRef.current.setAnimationLoop(() => {
                // Minimal checks to avoid unnecessary state changes
                const navCursor = navigationCursorRef.current;
                if (!navCursor || !stableRouteRef) {
                  if (rendererRef.current) {
                    rendererRef.current.setAnimationLoop(null);
                    return;
                  }
                }
                
                // Don't check bookingStep here - let the outer code handle visibility
                const elapsed = performance.now() - (routeStartTimeRef.current || 0);
                const t = (elapsed % routeDurationMs) / routeDurationMs;
                
                if (navCursor && stableRouteRef) {
                  // Update position
                  stableRouteRef.getPointAt(t, navCursor.position);
                  navCursor.position.z += 50; // Altitude offset
                  
                  // Update orientation
                  const tangent = new THREE.Vector3();
                  stableRouteRef.getTangentAt(t, tangent);
                  navCursor.quaternion.setFromUnitVectors(
                    CAR_FRONT,
                    tangent.normalize()
                  );
                }
                
                // Request redraw
                overlayRef.current?.requestRedraw();
              });
            } else {
              // Fallback method (without animation loop)
              try {
                const navCursor = navigationCursorRef.current;
                const curve = routeCurveRef.current;
                
                if (curve && navCursor) {
                  const startTime = routeStartTimeRef.current;
                  const elapsed = performance.now() - startTime;
                  const routeDurationMs = 12000;
                  const t = (elapsed % routeDurationMs) / routeDurationMs;
                  
                  curve.getPointAt(t, navCursor.position);
                  navCursor.position.z += 50;

                  const tangent = new THREE.Vector3();
                  curve.getTangentAt(t, tangent);
                  const CAR_FRONT = new THREE.Vector3(0, 1, 0);
                  navCursor.quaternion.setFromUnitVectors(
                    CAR_FRONT,
                    tangent.normalize()
                  );
                }
              } catch (error) {
                console.warn("Error in route cursor fallback animation:", error);
                // Don't change visibility on error to avoid flickering
              }
            }
          }
        }
        
        // Only update visibility once, after all position/property updates
        if (shouldUpdateVisibility && navigationCursorRef.current) {
          if (navigationCursorRef.current.visible !== shouldShowNavigationCursor) {
            // Mark for visibility update
            navigationCursorRef.current.visible = shouldShowNavigationCursor;
          }
        }
      }

      // 4) Keep route tube slightly above ground
      if (routeTubeRef.current) {
        routeTubeRef.current.position.z = 10;
      }

      // Render
      overlay.requestRedraw();
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

      removePointerListenerRef.current();

      // Cleanup route tube
      if (routeTubeRef.current) {
        scene?.remove(routeTubeRef.current);
        routeTubeRef.current.geometry.dispose();
        if (tubeMaterialRef.current) {
          tubeMaterialRef.current.dispose();
          tubeMaterialRef.current = null;
        }
        routeTubeRef.current = null;
      }

      // Cleanup buildings
      buildingGroupsRef.current.forEach((group) => {
        scene?.remove(group);
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            disposeMaterial(child.material);
          }
        });
      });
      buildingGroupsRef.current = [];

      // Cleanup cursors
      if (cursorRef.current) {
        scene?.remove(cursorRef.current);
        cursorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            disposeMaterial(child.material);
          }
        });
        cursorRef.current = null;
      }
      if (navigationCursorRef.current) {
        scene?.remove(navigationCursorRef.current);
        navigationCursorRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            disposeMaterial(child.material);
          }
        });
        navigationCursorRef.current = null;
      }

      // Cleanup scene
      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      cameraRef.current = null;
      raycasterRef.current = null;
      invProjMatrixRef.current = null;
      overlayRef.current = null;
      isInitializedRef.current = false;
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

  // Force redraw if station IDs change
  useEffect(() => {
    overlayRef.current?.requestRedraw();
  }, [departureStationId, arrivalStationId]);

  // Redraw if userLocation changes
  useEffect(() => {
    if (overlayRef.current && userLocation) {
      overlayRef.current.requestRedraw();
    }
  }, [userLocation]);
  
  // Manage the animation loop with smoother transitions when booking step changes
  useEffect(() => {
    // Add debounce to prevent animation loop reset during transitions
    const transitionTimeout = setTimeout(() => {
      // Only restart animation if needed - don't immediately stop on state change
      if (bookingStep !== 4) {
        // Instead of immediately stopping, check if we're actually transitioning away from step 4
        // This prevents stopping the animation if we're transitioning to step 4
        if (routeStartTimeRef.current !== null && rendererRef.current) {
          // Allow extra time for transition before stopping
          routeStartTimeRef.current = null;
        }
      }
    }, 100); // Short debounce to prevent flicker during state transitions
    
    // Cleanup function
    return () => {
      clearTimeout(transitionTimeout);
    };
  }, [bookingStep]);

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