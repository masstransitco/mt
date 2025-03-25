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
} from "@/store/bookingSlice";

// -----------------------
// 1. Building extrude helper
// -----------------------
/**
 * Creates a THREE.Group that has:
 *   - A Mesh (extruded shape)
 *   - An Edges line mesh
 * Both share the same center anchor so you can position the group at once.
 *
 * @param building - The 3D feature with polygon geometry
 * @param anchor - The anchor lat/lng/alt for local coordinate conversion
 * @param defaultColor - A default color for the building
 * @param index - Optional numeric index (e.g. for debugging)
 */
function createExtrudedBuilding(
  building: any, // or your Station3DFeature type
  anchor: { lat: number; lng: number; altitude: number },
  defaultColor: THREE.Color,
  index: number
): THREE.Group {
  const coords = building.geometry.coordinates[0];
  const buildingAltitude = 0;
  const buildingHeight = building.properties?.topHeight ?? 250;

  // Convert polygon coords to local XY
  const absolutePoints: THREE.Vector3[] = [];
  let sumX = 0,
    sumY = 0;

  coords.forEach(([lng, lat]: [number, number]) => {
    const { x, y } = latLngAltToVector3(
      { lat, lng, altitude: buildingAltitude },
      anchor
    );
    absolutePoints.push(new THREE.Vector3(x, y, 0));
    sumX += x;
    sumY += y;
  });

  // Compute average center
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

  // Create the mesh
  const material = new THREE.MeshBasicMaterial({
    color: defaultColor,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const buildingMesh = new THREE.Mesh(geometry, material);

  // Create the edges
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 1,
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

  // Combine mesh + edges in a Group so we only manage one object
  const group = new THREE.Group();
  group.add(buildingMesh);
  group.add(edges);

  // Store data in group.userData
  // We'll store center position for easy re-positioning
  group.userData.centerPos = new THREE.Vector3(centerX, centerY, 0);
  group.userData.index = index;

  // Also store building details for identification
  const objectId = building.properties?.ObjectId;
  group.userData.objectId = objectId;
  group.userData.buildingHeight = buildingHeight;
  group.userData.placeName = building.properties?.Place || `Bldg ${index}`;

  return group;
}

// -----------------------
// The main hook
// -----------------------
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
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Single array for building groups (mesh + edges)
  const buildingGroupsRef = useRef<THREE.Group[]>([]);

  // Route tube references
  const routeTubeRef = useRef<THREE.Mesh | null>(null);
  const tubeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Store route data to handle “scene not ready” case
  const routeDataRef = useRef<Array<{ lat: number; lng: number }>>([]);

  // Anchor for local coordinate transforms
  const anchorRef = useRef({ lat: 0, lng: 0, altitude: 0 });

  // Track initialization
  const isInitializedRef = useRef(false);

  // 3D building data from Redux
  const buildings3D = useAppSelector(selectStations3D);

  // Station selection state
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Route data for tube visualization
  const routeDecoded = useAppSelector(selectRouteDecoded);

  // Colors
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0xcccccc); // Light gray
  const BUILDING_DEPARTURE_COLOR = new THREE.Color(0x3b82f6); // Blue
  const BUILDING_ARRIVAL_COLOR = new THREE.Color(0xef4444); // Red
  const ROUTE_TUBE_COLOR = new THREE.Color(0x3b82f6); // Blue for route tube

  // 4. Single method to “refresh or create” the route tube
  const refreshRouteTube = useCallback(() => {
    // If no route data or scene is not ready, do nothing
    const path = routeDataRef.current;
    if (
      !path ||
      path.length < 2 ||
      !sceneRef.current ||
      !overlayRef.current
    ) {
      return;
    }

    // Make sure we have a material
    if (!tubeMaterialRef.current) {
      tubeMaterialRef.current = new THREE.MeshBasicMaterial({
        color: ROUTE_TUBE_COLOR,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
    }

    // Convert lat/lng to Vector3
    const anchor = anchorRef.current;
    const points = path.map(({ lat, lng }) => {
      const { x, y, z } = latLngAltToVector3(
        { lat, lng, altitude: 5 }, // slight altitude above ground
        anchor
      );
      return new THREE.Vector3(x, y, z);
    });

    // Build a TubeGeometry
    // We'll keep the “custom curve” for smooth interpolation
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
    const tubularSegments = Math.min(Math.max(points.length * 2, 32), 100);
    const radius = 8;
    const radialSegments = 8;
    const tubeGeom = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      radialSegments,
      false
    );

    // Create or update the routeTube mesh
    if (!routeTubeRef.current) {
      // create new
      const tubeMesh = new THREE.Mesh(tubeGeom, tubeMaterialRef.current);
      tubeMesh.renderOrder = 300;
      tubeMesh.visible = true;
      routeTubeRef.current = tubeMesh;
      sceneRef.current.add(tubeMesh);
    } else {
      // update existing
      routeTubeRef.current.visible = true;
      routeTubeRef.current.geometry.dispose();
      routeTubeRef.current.geometry = tubeGeom;
    }

    // Force redraw
    overlayRef.current.requestRedraw();
  }, [ROUTE_TUBE_COLOR]);

  // Re-run refresh whenever routeDecoded changes
  useEffect(() => {
    if (departureStationId && arrivalStationId && routeDecoded?.length >= 2) {
      // Store the data in routeDataRef
      routeDataRef.current = routeDecoded;
    } else {
      routeDataRef.current = [];
    }
    // If scene is already ready, just do a refresh
    refreshRouteTube();
  }, [
    routeDecoded,
    departureStationId,
    arrivalStationId,
    refreshRouteTube,
  ]);

  // Callback for station selection
  const handleStationSelected = useCallback(
    (stationId: number) => {
      if (options?.onStationSelected) {
        options.onStationSelected(stationId);
      }
    },
    [options]
  );

  // Raycaster references
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const invProjMatrixRef = useRef<THREE.Matrix4 | null>(null);

  // pointer event removal
  const removePointerListenerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!googleMap || isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Create & set up the WebGLOverlayView
    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    overlay.onAdd = () => {
      // Initialize scene & camera
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera();
      camera.far = 100000;
      camera.updateProjectionMatrix();
      cameraRef.current = camera;

      // Decide anchor from map center
      const center = googleMap.getCenter();
      if (center) {
        anchorRef.current.lat = center.lat();
        anchorRef.current.lng = center.lng();
        anchorRef.current.altitude = 0;
      }

      // BUILDINGS: extrude from stations3D
      // Filter out invalid polygons
      const validBuildings = buildings3D.filter((b: any) => {
        const coords = b.geometry.coordinates[0];
        if (!coords || coords.length < 3) return false;
        const [lng, lat] = coords[0];
        return Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
      });

      // For each valid building, create a group
      validBuildings.forEach((building, i) => {
        try {
          const group = createExtrudedBuilding(
            building,
            anchorRef.current,
            BUILDING_DEFAULT_COLOR,
            i
          );

          // If we can find a matching station by ObjectId, store the stationId in group.userData
          const objectId = building.properties?.ObjectId;
          const matchingStation = stations.find(
            (s) => s.properties.ObjectId === objectId
          );
          if (matchingStation) {
            group.userData.stationId = matchingStation.id;
          }

          // Add group to the scene
          scene.add(group);
          buildingGroupsRef.current.push(group);
        } catch (err) {
          console.error("[useThreeOverlay] building creation error:", err);
        }
      });

      // Once building groups are added, also refresh route if we have data
      refreshRouteTube();
    };

    overlay.onContextRestored = ({ gl }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!scene || !camera) return;

      // Create a WebGL renderer
      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });
      renderer.autoClear = false;
      rendererRef.current = renderer;

      // Create Raycaster
      raycasterRef.current = new THREE.Raycaster();
      invProjMatrixRef.current = new THREE.Matrix4();

      // Ensure the canvas can receive pointer events
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.zIndex = "50";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "auto";

      // Pointer handler
      const handlePointerDown = (ev: PointerEvent) => {
        pickWithRay(ev);
      };
      canvas.addEventListener("pointerdown", handlePointerDown);
      removePointerListenerRef.current = () => {
        canvas.removeEventListener("pointerdown", handlePointerDown);
      };

      // If we already have route data, refresh the tube
      refreshRouteTube();
    };

    // Ray-picking logic
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

      // Manual approach: invert camera's projection matrix
      invProj.copy(camera.projectionMatrix).invert();
      const origin = new THREE.Vector3(ndcX, ndcY, 0).applyMatrix4(invProj);
      const farPos = new THREE.Vector3(ndcX, ndcY, 0.5).applyMatrix4(invProj);
      const direction = farPos.sub(origin).normalize();

      raycaster.ray.origin.copy(origin);
      raycaster.ray.direction.copy(direction);

      // Intersect with building groups
      // We only want hits on their children (meshes)
      const hits: THREE.Intersection[] = [];
      buildingGroupsRef.current.forEach((group) => {
        const groupHits = raycaster.intersectObjects(group.children, false);
        // If groupHits found something, store the group in the object or pass it up
        groupHits.forEach((hit) => {
          // We can attach group in the intersection for easier reference
          (hit as any).buildingGroup = group;
        });
        hits.push(...groupHits);
      });

      if (hits.length > 0) {
        // Sort by distance
        hits.sort((a, b) => a.distance - b.distance);
        const firstHit = hits[0] as any; // extended
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

      // 1) Update camera with Maps transform
      const anchor = anchorRef.current;
      const camMatArr = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix.fromArray(camMatArr);

      // 2) Position each building group
      buildingGroupsRef.current.forEach((group) => {
        const c = group.userData.centerPos as THREE.Vector3;
        group.position.set(c.x, c.y, 0);

        // Color the building based on station selection
        const stationId = group.userData.stationId;
        // group.children[0] is the main extruded mesh,
        // group.children[1] is edges
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

      // 3) If we have a route tube, position it slightly above zero
      if (routeTubeRef.current) {
        routeTubeRef.current.position.z = 10;
      }

      // 4) Render
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

      // remove pointer events
      removePointerListenerRef.current();

      // remove route tube
      if (routeTubeRef.current) {
        scene?.remove(routeTubeRef.current);
        routeTubeRef.current.geometry.dispose();
        if (tubeMaterialRef.current) {
          tubeMaterialRef.current.dispose();
          tubeMaterialRef.current = null;
        }
        routeTubeRef.current = null;
      }

      // dispose building groups
      buildingGroupsRef.current.forEach((group) => {
        scene?.remove(group);
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            disposeMaterial(child.material);
          } else if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            disposeMaterial(child.material);
          }
        });
      });
      buildingGroupsRef.current = [];

      // cleanup scene
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
      // If the component unmounts, remove overlay
      overlay.setMap(null);
    };
  }, [
    googleMap,
    stations,
    buildings3D,
    refreshRouteTube,
    handleStationSelected,
  ]);

  // Trigger a redraw if station IDs change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  }, [departureStationId, arrivalStationId]);

  return { overlayRef };
}

function disposeMaterial(mtl: THREE.Material | THREE.Material[]) {
  if (Array.isArray(mtl)) {
    mtl.forEach((sub) => sub.dispose());
  } else {
    mtl.dispose();
  }
}