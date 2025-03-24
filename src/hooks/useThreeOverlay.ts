import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { StationFeature } from "@/store/stationsSlice";
import { latLngAltToVector3 } from "@/lib/geo-utils";

// Pull from Redux
import { useAppSelector } from "@/store/store";
import { selectStations3D } from "@/store/stations3DSlice";
import { selectDepartureStationId, selectArrivalStationId, selectRouteDecoded } from "@/store/bookingSlice";

interface ThreeOverlayOptions {
  onStationSelected?: (stationId: number) => void;
}

export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  options?: ThreeOverlayOptions
) {
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);

  // Scene, camera, renderer references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Mesh references - removed stationMeshesRef as we no longer show station cylinders
  const buildingMeshesRef = useRef<THREE.Mesh[]>([]);
  const buildingEdgesRef = useRef<THREE.LineSegments[]>([]);

  // Route tube reference
  const routeTubeRef = useRef<THREE.Mesh | null>(null);
  const tubeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Map anchor
  const anchorRef = useRef({ lat: 0, lng: 0, altitude: 0 });

  // Guard to ensure we only init once
  const isInitializedRef = useRef(false);

  // 3D building data
  const buildings3D = useAppSelector(selectStations3D);

  // Get station selection state from the Redux store
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Get route data for tube visualization
  const routeDecoded = useAppSelector(selectRouteDecoded);

  // Color constants
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0xCCCCCC); // Light gray
  const BUILDING_DEPARTURE_COLOR = new THREE.Color(0x3B82F6); // Blue
  const BUILDING_ARRIVAL_COLOR = new THREE.Color(0xEF4444); // Red
  const ROUTE_TUBE_COLOR = new THREE.Color(0x3B82F6); // Blue for route tube

  // Custom curve for tube geometry
  class CustomCurve extends THREE.Curve<THREE.Vector3> {
    private points: THREE.Vector3[];
    
    constructor(points: THREE.Vector3[]) {
      super();
      this.points = points;
    }
    
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
      const segment = (this.points.length - 1) * t;
      const index = Math.floor(segment);
      const alpha = segment - index;
      
      if (index >= this.points.length - 1) {
        return optionalTarget.copy(this.points[this.points.length - 1]);
      }
      
      const p0 = this.points[index];
      const p1 = this.points[index + 1];
      return optionalTarget.copy(p0).lerp(p1, alpha);
    }
  }

  // Function to create or update a route tube
  const createOrUpdateRouteTube = useCallback((path: Array<{lat: number, lng: number}>) => {
    console.log("[ThreeOverlay] Creating route tube with", path.length, "points");
    
    if (!path || path.length < 2 || !sceneRef.current || !overlayRef.current) {
      console.log("[ThreeOverlay] Cannot create tube - missing data:", {
        hasPath: !!path, 
        pathLength: path?.length, 
        hasScene: !!sceneRef.current, 
        hasOverlay: !!overlayRef.current
      });
      // Hide the tube if no valid path
      if (routeTubeRef.current) {
        routeTubeRef.current.visible = false;
      }
      return;
    }
    
    // Create material if it doesn't exist
    if (!tubeMaterialRef.current) {
      tubeMaterialRef.current = new THREE.MeshBasicMaterial({
        color: ROUTE_TUBE_COLOR,
        transparent: true,
        opacity: 0.9, // Increased opacity for visibility
        side: THREE.DoubleSide, // Ensure it's visible from all angles
      });
    }
    
    // Convert route points to Vector3 coordinates
    const points: THREE.Vector3[] = [];
    const anchor = anchorRef.current;
    
    path.forEach(({lat, lng}) => {
      const {x, y, z} = latLngAltToVector3(
        { lat, lng, altitude: 50 }, // Increased altitude for visibility
        anchor
      );
      console.log(`[ThreeOverlay] Point transformed: lat=${lat}, lng=${lng} → x=${x}, y=${y}, z=${z}`);
      points.push(new THREE.Vector3(x, y, z));
    });
    
    // Create curve and tube geometry
    const curve = new CustomCurve(points);
    const tubularSegments = Math.min(Math.max(points.length * 2, 32), 100); // Adaptive segments
    const radius = 8; // Increased tube radius for visibility
    const radialSegments = 8; // Tube resolution
    const closed = false;
    
    const tubeGeometry = new THREE.TubeGeometry(
      curve, 
      tubularSegments, 
      radius, 
      radialSegments, 
      closed
    );
    
    // Create or update the tube mesh
    if (!routeTubeRef.current) {
      const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterialRef.current);
      tubeMesh.renderOrder = 300; // Ensure it's above ground but below buildings
      tubeMesh.visible = true; // Explicitly set visible
      console.log("[ThreeOverlay] Adding tube to scene");
      sceneRef.current.add(tubeMesh);
      routeTubeRef.current = tubeMesh;
      // Request explicit redraw
      overlayRef.current.requestRedraw();
    } else {
      routeTubeRef.current.visible = true;
      routeTubeRef.current.geometry.dispose(); // Clean up old geometry
      routeTubeRef.current.geometry = tubeGeometry;
      console.log("[ThreeOverlay] Updated existing tube");
      // Request explicit redraw
      overlayRef.current.requestRedraw();
    }
  }, []);

  // Effect to update the route tube when route data changes
  useEffect(() => {
    console.log("[ThreeOverlay] Route effect - data:", {
      departureStationId, 
      arrivalStationId, 
      routePoints: routeDecoded?.length, 
      routeData: routeDecoded?.slice(0, 3) // Log first few points only to keep log readable
    });
    
    // Only create tube if both departure and arrival stations are set
    if (departureStationId && arrivalStationId && routeDecoded?.length >= 2) {
      console.log("[ThreeOverlay] Calling createOrUpdateRouteTube with path length:", routeDecoded.length);
      createOrUpdateRouteTube(routeDecoded);
    } else if (routeTubeRef.current) {
      console.log("[ThreeOverlay] Hiding route tube - missing data");
      routeTubeRef.current.visible = false;
    }
  }, [routeDecoded, departureStationId, arrivalStationId, createOrUpdateRouteTube]);

  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const inverseProjectionMatrixRef = useRef<THREE.Matrix4 | null>(null);

  // Cleanup pointer listeners
  const removePointerListenerRef = useRef<() => void>(() => {});

  // Callback for handling station/building selection
  const handleStationSelected = useCallback((stationId: number) => {
    if (options?.onStationSelected) {
      console.log("[useThreeOverlay] Calling parent callback with stationId:", stationId);
      options.onStationSelected(stationId);
    } else {
      console.warn("[useThreeOverlay] No onStationSelected callback provided");
    }
  }, [options]);

  useEffect(() => {
    if (!googleMap || isInitializedRef.current) return;
    isInitializedRef.current = true;

    console.log("[useThreeOverlay] Initializing WebGLOverlayView...");

    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    overlay.onAdd = () => {
      console.log("[useThreeOverlay] onAdd - Creating scene & camera...");

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera();
      camera.far = 100000;
      camera.updateProjectionMatrix();
      cameraRef.current = camera;

      // Decide an anchor based on map center
      const center = googleMap.getCenter();
      if (center) {
        anchorRef.current.lat = center.lat();
        anchorRef.current.lng = center.lng();
        anchorRef.current.altitude = 0;
      }
      console.log("[useThreeOverlay] Anchor set to", anchorRef.current);

      // Note: We've removed the station cylinders rendering code
      // Note: We've removed the debug markers rendering code

      // -- BUILDINGS: extrude from stations3D --
      console.log(
        "[useThreeOverlay] Creating building extrusions. Count:",
        buildings3D.length
      );

      // Filter valid lat/lng polygons
      const validBuildings = buildings3D.filter((b) => {
        const coords = b.geometry.coordinates[0];
        if (!coords || coords.length < 3) return false;
        const [lng, lat] = coords[0];
        return Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
      });
      console.log(`[useThreeOverlay] Found ${validBuildings.length} valid lat/lng buildings`);

      // Log ObjectId mapping for debugging
      console.log("[useThreeOverlay] Station ObjectId mapping:");
      stations.forEach(station => {
        console.log(`Station ${station.id} has ObjectId: ${station.properties.ObjectId}`);
      });
      
      validBuildings.forEach((building, i) => {
        try {
          const coords = building.geometry.coordinates[0];
          const buildingAltitude = 0;
          const buildingHeight =
            building.properties?.topHeight != null
              ? building.properties.topHeight
              : 250;

          const anchor = anchorRef.current;

          // Convert polygon coords to local XY
          const absolutePoints: THREE.Vector3[] = [];
          let sumX = 0,
            sumY = 0;

          coords.forEach(([lng, lat]) => {
            const { x, y } = latLngAltToVector3(
              { lat, lng, altitude: buildingAltitude },
              anchor
            );
            absolutePoints.push(new THREE.Vector3(x, y, 0));
            sumX += x;
            sumY += y;
          });

          // Average center
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
          const extrudeSettings = { depth: buildingHeight, bevelEnabled: false };
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

          // Use a consistent light gray color for all buildings as default
          const material = new THREE.MeshBasicMaterial({
            color: BUILDING_DEFAULT_COLOR,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
          });

          const buildingMesh = new THREE.Mesh(geometry, material);
          
          // Instead of wireframes, we create an edges geometry for outlines
          const edgesGeometry = new THREE.EdgesGeometry(geometry);
          const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 1 
          });
          const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          
          // Add the edges to the scene separately (not as child of mesh)
          scene.add(edges);
          buildingEdgesRef.current.push(edges);

          // store center / name
          buildingMesh.userData.centerPos = new THREE.Vector3(centerX, centerY, 0);
          buildingMesh.userData.name = building.properties?.Place || `Building ${i}`;

          // store the ObjectId for mapping to a station
          buildingMesh.userData.objectId = building.properties?.ObjectId;
          
          // Find matching station by ObjectId
          const buildingObjectId = building.properties?.ObjectId;
          console.log(`[useThreeOverlay] Building ${i} ObjectId:`, buildingObjectId);
          
          const matchingStation = stations.find(s => 
            s.properties.ObjectId === buildingObjectId
          );
          
          if (matchingStation) {
            console.log(`[useThreeOverlay] Found matching station ${matchingStation.id} for building with ObjectId ${buildingObjectId}`);
            buildingMesh.userData.stationId = matchingStation.id;
            buildingMesh.userData.isBuilding = true;
            buildingMesh.userData.objectId = buildingObjectId;
            
            // Also store the station data in the edges object
            edges.userData.stationId = matchingStation.id;
            edges.userData.isBuilding = true;
            edges.userData.objectId = buildingObjectId;
          } else {
            console.log(`[useThreeOverlay] No matching station found for building with ObjectId ${buildingObjectId}`);
            // Still store the ObjectId for debugging
            buildingMesh.userData.objectId = buildingObjectId;
            edges.userData.objectId = buildingObjectId;
          }

          scene.add(buildingMesh);
          buildingMeshesRef.current.push(buildingMesh);
        } catch (err) {
          console.error("[useThreeOverlay] Error creating building:", err);
        }
      });
    };

    overlay.onContextRestored = ({ gl }) => {
      console.log("[useThreeOverlay] onContextRestored");

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!scene || !camera) return;

      // create WebGLRenderer
      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });
      renderer.autoClear = false;
      rendererRef.current = renderer;

      // create Raycaster
      raycasterRef.current = new THREE.Raycaster();
      console.log("[useThreeOverlay] Raycaster initialized:", !!raycasterRef.current);
      inverseProjectionMatrixRef.current = new THREE.Matrix4();

      // pointer events on canvas
      const canvas = gl.canvas as HTMLCanvasElement;
      // Ensure it's on top of the map
      canvas.style.zIndex = "50";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      
      // Also ensure pointer events aren't disabled
      canvas.style.pointerEvents = "auto";
      const handlePointerDown = (ev: PointerEvent) => {
        console.log("[useThreeOverlay] Pointer event detected", ev.clientX, ev.clientY);
        pickWithRay(ev);
      };
      canvas.addEventListener("pointerdown", handlePointerDown);

      removePointerListenerRef.current = () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
      };
    };

    // the picking logic
    const pickWithRay = (ev: PointerEvent) => {
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const raycaster = raycasterRef.current;
      const invProj = inverseProjectionMatrixRef.current;
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

      // Enhanced debugging - log what objects we're checking against
      console.log(`[useThreeOverlay] Raycasting against ${buildingMeshesRef.current.length} buildings`);
      
      // Check intersections with buildings and edges
      let buildingHits = raycaster.intersectObjects(buildingMeshesRef.current, false);
      let edgeHits = raycaster.intersectObjects(buildingEdgesRef.current, false);
      
      console.log(`[useThreeOverlay] Building hits: ${buildingHits.length}, Edge hits: ${edgeHits.length}`);
      
      // Process all hits to find the closest valid one
      const hits = [...buildingHits, ...edgeHits].sort((a, b) => a.distance - b.distance);

      if (hits.length > 0) {
        const firstHit = hits[0];
        const hitObject = firstHit.object;
        const userData = hitObject.userData;
        
        console.log("[useThreeOverlay] Picked object:", userData);

        // Get stationId from the hit object
        const stationId = userData.stationId;
        
        if (stationId) {
          console.log("[useThreeOverlay] Selecting station:", stationId);
          // Use the callback to handle the station selection
          handleStationSelected(stationId);
        } else {
          console.log("[useThreeOverlay] No stationId found in hit object");
          // Check if this is a building that doesn't have station mapping
          if (userData.objectId) {
            console.log("[useThreeOverlay] Building has ObjectId but no station mapping:", userData.objectId);
          }
        }
      } else {
        console.log("[useThreeOverlay] No intersections found");
      }
    };

    overlay.onDraw = ({ gl, transformer }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (!scene || !camera || !renderer) return;

      // update camera
      const anchor = anchorRef.current;
      const camMatArr = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix.fromArray(camMatArr);

      // buildings: place them at (centerX, centerY, 0)
      buildingMeshesRef.current.forEach((bldg, index) => {
        if (bldg.userData.centerPos) {
          const c = bldg.userData.centerPos as THREE.Vector3;
          bldg.position.set(c.x, c.y, 0);
          
          // Also position the corresponding edge
          if (index < buildingEdgesRef.current.length) {
            buildingEdgesRef.current[index].position.set(c.x, c.y, 0);
          }
          
          // Update building color based on selection state
          const material = bldg.material as THREE.MeshBasicMaterial;
          const stationId = bldg.userData.stationId;
          
          if (stationId) {
            if (stationId === departureStationId) {
              material.color.copy(BUILDING_DEPARTURE_COLOR);
            } else if (stationId === arrivalStationId) {
              material.color.copy(BUILDING_ARRIVAL_COLOR);
            } else {
              material.color.copy(BUILDING_DEFAULT_COLOR);
            }
          } else {
            material.color.copy(BUILDING_DEFAULT_COLOR);
          }
        }
      });
      
      // Update tube positioning if needed
      if (routeTubeRef.current && routeTubeRef.current.visible) {
        // Make sure it's visible by adjusting z position if needed
        // routeTubeRef.current.position.z = 10; // Adjust if needed for visibility
        console.log("[ThreeOverlay] Route tube visible in onDraw");
      }

      overlay.requestRedraw();
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      renderer.setViewport(0, 0, w, h);

      renderer.render(scene, camera);
      renderer.resetState();
    };

    overlay.onContextLost = () => {
      console.log("[useThreeOverlay] onContextLost - disposing renderer");
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };

    overlay.onRemove = () => {
      console.log("[useThreeOverlay] onRemove - cleaning up...");
      const scene = sceneRef.current;

      // remove pointer events
      removePointerListenerRef.current?.();

      // Clean up route tube
      if (routeTubeRef.current) {
        scene?.remove(routeTubeRef.current);
        routeTubeRef.current.geometry.dispose();
        if (tubeMaterialRef.current) {
          tubeMaterialRef.current.dispose();
          tubeMaterialRef.current = null;
        }
        routeTubeRef.current = null;
      }

      // cleanup
      const cleanupMeshes = (meshes: THREE.Object3D[]) => {
        meshes.forEach((m) => {
          scene?.remove(m);
          if (m instanceof THREE.Mesh) {
            m.geometry.dispose();
            disposeMaterial(m.material);
          } else if (m instanceof THREE.LineSegments) {
            m.geometry.dispose();
            disposeMaterial(m.material);
          }
        });
        meshes.length = 0;
      };
      
      cleanupMeshes(buildingMeshesRef.current);
      cleanupMeshes(buildingEdgesRef.current);

      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      cameraRef.current = null;
      raycasterRef.current = null;
      inverseProjectionMatrixRef.current = null;
    };

    overlay.setMap(googleMap);

    return () => {
      console.log("[useThreeOverlay] Cleanup - removing overlay");
      overlay.setMap(null);
      overlayRef.current = null;
      isInitializedRef.current = false;
    };
  }, [googleMap, stations, buildings3D, handleStationSelected]);

  return { overlayRef };
}

/** Helper to dispose single or multiple materials. */
function disposeMaterial(mtl: THREE.Material | THREE.Material[]) {
  if (Array.isArray(mtl)) {
    mtl.forEach((sub) => sub.dispose());
  } else {
    mtl.dispose();
  }
}
