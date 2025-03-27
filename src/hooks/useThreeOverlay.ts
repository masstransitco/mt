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
import { selectUserLocation } from "@/store/userSlice";
import { selectAllStations } from "@/store/stationsSlice";

// NEW: We'll import CatmullRomCurve3 for the route animation
import { CatmullRomCurve3 } from "three";

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
  const navigationCursorRef = useRef<THREE.Group | null>(null); // Holds cursor_navigation.glb
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Single array for building groups (mesh + edges)
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

  // NEW: We'll store a CatmullRomCurve3 for the route so we can animate on it
  const routeCurveRef = useRef<CatmullRomCurve3 | null>(null);
  // NEW: Track the start time for our animation
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
  const BUILDING_DEPARTURE_COLOR = new THREE.Color(0x00ff00); // green
  const BUILDING_ARRIVAL_COLOR = new THREE.Color(0x0000ff);   // blue
  const ROUTE_TUBE_COLOR = new THREE.Color(0xffffff);         // white

  // Clock ref for simple animation (used for "breathing" effect)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

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

  // -----------------------
  // 2. Refresh or create the route tube
  // -----------------------
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

    // NEW: Also store the route as a CatmullRomCurve3 for our animation
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

  // Watch for routeDecoded changes => store path, refresh tube
  useEffect(() => {
    if (departureStationId && arrivalStationId && routeDecoded?.length >= 2) {
      routeDataRef.current = routeDecoded;
    } else {
      routeDataRef.current = [];
    }
    refreshRouteTube();
  }, [routeDecoded, departureStationId, arrivalStationId, refreshRouteTube]);

  // -----------------------
  // 3. Station selection callback
  // -----------------------
  const handleStationSelected = useCallback(
    (stationId: number) => {
      if (options?.onStationSelected) {
        options.onStationSelected(stationId);
      }
    },
    [options]
  );

  // -----------------------
  // 4. Main useEffect to init & teardown
  // -----------------------
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

      const loader = new GLTFLoader();

      // 1) Load user location "cursor.glb"
      loader.load(
        "/map/cursor.glb",
        (gltf) => {
          const originalModel = gltf.scene;
          const cursorGroup = new THREE.Group();

          // Scale, rotation
          originalModel.scale.setScalar(15);
          const oldEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZXY");
          const q = new THREE.Quaternion().setFromEuler(oldEuler);
          originalModel.rotation.copy(new THREE.Euler().setFromQuaternion(q, "XYZ"));

          // Double-sided, slight emissive
          originalModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.emissive = new THREE.Color(0x276ef1);
                child.material.emissiveIntensity = 0.4;
                child.material.metalness = 0;
                child.material.roughness = 0.6;
              }
            }
          });

          cursorGroup.add(originalModel);
          cursorGroup.visible = false;
          scene.add(cursorGroup);
          cursorRef.current = cursorGroup;

          overlayRef.current?.requestRedraw();
        },
        undefined,
        (err) => console.error("[useThreeOverlay] cursor.glb load error:", err)
      );

      // 2) Load "cursor_navigation.glb" for step 3 & route animation
      loader.load(
        "/map/cursor_navigation.glb",
        (gltf) => {
          const originalModel = gltf.scene;
          const navCursorGroup = new THREE.Group();

          originalModel.scale.setScalar(50);
          const oldEuler = new THREE.Euler(Math.PI / 2, 0, Math.PI, "ZXY");
          const q = new THREE.Quaternion().setFromEuler(oldEuler);
          originalModel.rotation.copy(new THREE.Euler().setFromQuaternion(q, "XYZ"));

          // Double-sided, slight emissive
          originalModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.emissive = new THREE.Color(0x276ef1);
                child.material.emissiveIntensity = 0.4;
                child.material.metalness = 0;
                child.material.roughness = 0.6;
              }
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
          console.error("[useThreeOverlay] cursor_navigation.glb error:", err)
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
      if (cursorRef.current) {
        const hasValidLocation =
          userLocation &&
          typeof userLocation.lat === "number" &&
          typeof userLocation.lng === "number";

        cursorRef.current.visible = !!hasValidLocation;
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
              child.material.emissiveIntensity =
                0.1 + 0.1 * Math.sin(elapsed * breathingSpeed);
            }
          });
        }
      }

      // 3) Step 3: place navigation cursor near the departure station
      //    Step 4: animate navigation cursor along route
      if (navigationCursorRef.current) {
        if (bookingStep === 3 && departureStationId != null) {
          // Place the cursor at the side of the building
          const depStation = allStations.find((s) => s.id === departureStationId);
          if (depStation) {
            // Look up the extruded building group for this station
            const buildingGroup = buildingGroupsRef.current.find(
              (g) => g.userData.stationId === departureStationId
            );
            if (buildingGroup) {
              const boundingCenter = buildingGroup.userData.boundingCenter as THREE.Vector3;
              const boundingRadius = buildingGroup.userData.boundingRadius || 0;

              let angle = 0;
              if (userLocation) {
                const userVec = latLngAltToVector3(
                  { lat: userLocation.lat, lng: userLocation.lng, altitude: 0 },
                  anchor
                );
                // direction from building center -> user
                const dx = userVec.x - boundingCenter.x;
                const dy = userVec.y - boundingCenter.y;
                angle = Math.atan2(dy, dx);
              }

              // 5m margin outside building
              const margin = 5;
              const offsetDist = boundingRadius + margin;
              const offsetX = boundingCenter.x + offsetDist * Math.cos(angle);
              const offsetY = boundingCenter.y + offsetDist * Math.sin(angle);

              navigationCursorRef.current.position.set(offsetX, offsetY, 0);
              navigationCursorRef.current.visible = true;

              // Optional breathing effect
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
            } else {
              navigationCursorRef.current.visible = false;
            }
          } else {
            navigationCursorRef.current.visible = false;
          }
        } 
        else if (bookingStep === 4) {
          // NEW: Animate the navigation cursor along the route
          if (routeCurveRef.current) {
            navigationCursorRef.current.visible = true;

            // If we haven't set the start time yet, set it now
            if (routeStartTimeRef.current === null) {
              routeStartTimeRef.current = performance.now();
            }
            const elapsed = performance.now() - routeStartTimeRef.current;
            const routeDurationMs = 12000; // total animation time
            const t = (elapsed % routeDurationMs) / routeDurationMs;

            // Position
            routeCurveRef.current.getPointAt(t, navigationCursorRef.current.position);
            // Slight altitude offset to ride "on top" of tube
            navigationCursorRef.current.position.z += 50;

            // Orientation
            const tangent = new THREE.Vector3();
            routeCurveRef.current.getTangentAt(t, tangent);
            const CAR_FRONT = new THREE.Vector3(0, 1, 0);
            navigationCursorRef.current.quaternion.setFromUnitVectors(
              CAR_FRONT,
              tangent.normalize()
            );
          }
        } else {
          // Hide the nav cursor in other steps
          navigationCursorRef.current.visible = false;
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
          } else if (child instanceof THREE.LineSegments) {
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