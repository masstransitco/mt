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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { selectUserLocation } from '@/store/userSlice';

// -----------------------
// 1. Building extrude helper
// -----------------------
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

  const material = new THREE.MeshBasicMaterial({
    color: defaultColor,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const buildingMesh = new THREE.Mesh(geometry, material);

  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 1,
  });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

  const group = new THREE.Group();
  group.add(buildingMesh);
  group.add(edges);

  group.userData.centerPos = new THREE.Vector3(centerX, centerY, 0);
  group.userData.index = index;

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
  const cursorRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Single array for building groups (mesh + edges)
  const buildingGroupsRef = useRef<THREE.Group[]>([]);

  // Grab user location from store
  const userLocation = useAppSelector(selectUserLocation);

  // Route tube references
  const routeTubeRef = useRef<THREE.Mesh | null>(null);
  const tubeMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Store route data to handle "scene not ready" case
  const routeDataRef = useRef<Array<{ lat: number; lng: number }>>([]);

  // Anchor for local coordinate transforms (lat, lng, altitude)
  const anchorRef = useRef({ lat: 0, lng: 0, altitude: 0 });
  // Keep track of previous userLocation to prevent re-anchoring unless changed
  const prevLocationRef = useRef<google.maps.LatLngLiteral | null>(null);

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
  const BUILDING_DEFAULT_COLOR = new THREE.Color(0xcccccc);
  const BUILDING_DEPARTURE_COLOR = new THREE.Color(0x3b82f6);
  const BUILDING_ARRIVAL_COLOR = new THREE.Color(0xef4444);
  const ROUTE_TUBE_COLOR = new THREE.Color(0x3b82f6);

  // 4. Single method to "refresh or create" the route tube
  const refreshRouteTube = useCallback(() => {
    const path = routeDataRef.current;
    if (!path || path.length < 2 || !sceneRef.current || !overlayRef.current) {
      return;
    }

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
        { lat, lng, altitude: 5 },
        anchor
      );
      return new THREE.Vector3(x, y, z);
    });

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

    if (!routeTubeRef.current) {
      const tubeMesh = new THREE.Mesh(tubeGeom, tubeMaterialRef.current);
      tubeMesh.renderOrder = 300;
      tubeMesh.visible = true;
      routeTubeRef.current = tubeMesh;
      sceneRef.current.add(tubeMesh);
    } else {
      routeTubeRef.current.visible = true;
      routeTubeRef.current.geometry.dispose();
      routeTubeRef.current.geometry = tubeGeom;
    }

    overlayRef.current.requestRedraw();
  }, [ROUTE_TUBE_COLOR]);

  // Re-run refresh whenever routeDecoded changes
  useEffect(() => {
    if (departureStationId && arrivalStationId && routeDecoded?.length >= 2) {
      routeDataRef.current = routeDecoded;
    } else {
      routeDataRef.current = [];
    }
    refreshRouteTube();
  }, [routeDecoded, departureStationId, arrivalStationId, refreshRouteTube]);

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

  const removePointerListenerRef = useRef<() => void>(() => {});

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

      // Decide anchor from map center but only if not set yet
      const center = googleMap.getCenter();
      if (
        center &&
        anchorRef.current.lat === 0 &&
        anchorRef.current.lng === 0 &&
        anchorRef.current.altitude === 0
      ) {
        anchorRef.current.lat = center.lat();
        anchorRef.current.lng = center.lng();
        anchorRef.current.altitude = 0;
      }

      // BUILDINGS
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

      // Minimal ambient light so the model isn't black
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const loader = new GLTFLoader();
      loader.load(
        '/map/cursor.glb',
        (gltf) => {
          const originalModel = gltf.scene;
          console.log("[useThreeOverlay] cursor.glb loaded, scale & rotation are being set.");
          
          // Create a group to hold both the original model and its edge effect
          const cursorGroup = new THREE.Group();
          
          // Add the original model to the group
          originalModel.scale.setScalar(50);
          originalModel.rotation.set(Math.PI / 2, 0, Math.PI, 'ZXY');
          cursorGroup.add(originalModel);
          
          // Create edges for visual appeal and depth
          originalModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // Create edge geometry from the mesh
              const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
              const edgesMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000, 
                linewidth: 2,
                transparent: true,
                opacity: 0.8
              });
              
              const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
              
              // Match the exact transformation of the mesh
              edges.position.copy(child.position);
              edges.rotation.copy(child.rotation);
              edges.scale.copy(child.scale).multiplyScalar(1.02); // Slightly larger to prevent z-fighting
              
              // Use the same matrix world as the parent, ensuring proper alignment
              edges.matrixAutoUpdate = child.matrixAutoUpdate;
              if (!edges.matrixAutoUpdate) {
                edges.matrix.copy(child.matrix);
              }
              
              // Add the edges to the same parent as the mesh if it exists, otherwise to the model
              if (child.parent) {
                child.parent.add(edges);
              } else {
                originalModel.add(edges);
              }
            }
          });
          
          // Set the cursor to be initially invisible
          cursorGroup.visible = false;
          
          // Add the cursor group to the scene
          scene.add(cursorGroup);
          cursorRef.current = cursorGroup;
          
          // Initial visibility will be handled in the onDraw method
          overlayRef.current?.requestRedraw();
        },
        undefined,
        (error) => console.error('[useThreeOverlay] Cursor GLB load error:', error)
      );

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

      const anchor = anchorRef.current;
      const camMatArr = transformer.fromLatLngAltitude({
        lat: anchor.lat,
        lng: anchor.lng,
        altitude: anchor.altitude,
      });
      camera.projectionMatrix.fromArray(camMatArr);

      // Update building positions and colors
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

      // Handle cursor visibility and position in the same draw cycle
      if (cursorRef.current) {
        // Check if user location is valid
        const hasValidLocation = !!(
          userLocation && 
          typeof userLocation.lat === 'number' && 
          typeof userLocation.lng === 'number'
        );
        
        // Set visibility based on location validity
        cursorRef.current.visible = hasValidLocation;
        
        // Update position only if location is valid
        if (hasValidLocation) {
          const { lat, lng } = userLocation;
          const { x, y, z } = latLngAltToVector3(
            { lat, lng, altitude: 10 }, 
            anchor
          );
          cursorRef.current.position.set(x, y, z);
        }
      }

      if (routeTubeRef.current) {
        routeTubeRef.current.position.z = 10;
      }

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

      if (routeTubeRef.current) {
        scene?.remove(routeTubeRef.current);
        routeTubeRef.current.geometry.dispose();
        if (tubeMaterialRef.current) {
          tubeMaterialRef.current.dispose();
          tubeMaterialRef.current = null;
        }
        routeTubeRef.current = null;
      }

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
  ]);

  // Trigger a redraw if station IDs change
  useEffect(() => {
    overlayRef.current?.requestRedraw();
  }, [departureStationId, arrivalStationId]);

  // Consolidated cursor position tracking
  useEffect(() => {
    // Request a redraw whenever userLocation changes to ensure cursor updates
    if (overlayRef.current && userLocation) {
      overlayRef.current.requestRedraw();
    }
  }, [userLocation]);

  return { overlayRef };
}

function disposeMaterial(mtl: THREE.Material | THREE.Material[]) {
  if (Array.isArray(mtl)) {
    mtl.forEach((sub) => sub.dispose());
  } else {
    mtl.dispose();
  }
}