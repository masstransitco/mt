"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { StationFeature } from "@/store/stationsSlice";
import { latLngAltToVector3 } from "@/lib/geo-utils";

// Pull buildings from Redux
import { useAppSelector } from "@/store/store";
import { selectStations3D } from "@/store/stations3DSlice";

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

  // Mesh references
  const stationMeshesRef = useRef<THREE.Mesh[]>([]);
  const buildingMeshesRef = useRef<THREE.Mesh[]>([]);
  const debugMarkersRef = useRef<THREE.Mesh[]>([]);

  // Map anchor
  const anchorRef = useRef({ lat: 0, lng: 0, altitude: 0 });

  // Guard to ensure we only init once
  const isInitializedRef = useRef(false);

  // 3D building data
  const buildings3D = useAppSelector(selectStations3D);

  // Raycasting references
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

      // -- STATION CYLINDERS --
      console.log("[useThreeOverlay] Creating station cylinders...");
      stations.forEach((st, idx) => {
        const geom = new THREE.CylinderGeometry(10, 10, 30, 12);
        // Cylinder is Y‐axis up by default → rotate so it's Z‐axis up
        geom.rotateX(Math.PI / 2);

        const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        const mesh = new THREE.Mesh(geom, mat);

        // Store station id in the mesh for raycasting
        mesh.userData.stationId = st.id;
        mesh.userData.isStation = true;

        // We'll let mesh be updated each frame
        mesh.matrixAutoUpdate = true;
        scene.add(mesh);
        stationMeshesRef.current.push(mesh);
      });

      // -- DEBUG MARKERS --
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
      for (let i = 0; i < 5; i++) {
        const sphereGeo = new THREE.SphereGeometry(20, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: colors[i] });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);

        scene.add(sphere);
        debugMarkersRef.current.push(sphere);
      }

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

          const color = new THREE.Color(
            0.5 + Math.random() * 0.5,
            0.5 + Math.random() * 0.5,
            0.5 + Math.random() * 0.5
          );
          const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
          });

          const buildingMesh = new THREE.Mesh(geometry, material);

          // Optional wireframe
          const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
          );
          buildingMesh.add(wireframe);

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
          } else {
            console.log(`[useThreeOverlay] No matching station found for building with ObjectId ${buildingObjectId}`);
            // Still store the ObjectId for debugging
            buildingMesh.userData.objectId = buildingObjectId;
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
        // Ensure it’s on top of the map
  canvas.style.zIndex = "50";
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  

  // Also ensure pointer events aren’t disabled
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
      console.log(`[useThreeOverlay] Raycasting against ${buildingMeshesRef.current.length} buildings and ${stationMeshesRef.current.length} stations`);
      
      // Check intersections with buildings first (prioritize building selection)
      let buildingHits = raycaster.intersectObjects(buildingMeshesRef.current, true);
      console.log(`[useThreeOverlay] Building hits: ${buildingHits.length}`);
      
      // Then check stations if no building hits
      let stationHits = raycaster.intersectObjects(stationMeshesRef.current, true);
      console.log(`[useThreeOverlay] Station hits: ${stationHits.length}`);
      
      // Combined hits for processing
      const hits = [...buildingHits, ...stationHits];

      if (hits.length > 0) {
        const firstHit = hits[0];
        const hitObject = firstHit.object;
        // Navigate up to parent if we hit a child object (like wireframe)
        const targetObj = hitObject.parent && hitObject.parent.userData && hitObject.parent.userData.isBuilding
          ? hitObject.parent
          : hitObject;
        
        const userData = targetObj.userData;
        console.log("[useThreeOverlay] Picked object:", userData);

        // Get stationId either directly (for cylinders) or via mapping (for buildings)
        const stationId = userData.stationId;
        
        if (stationId) {
          console.log("[useThreeOverlay] Selecting station:", stationId);
          // Use the callback instead of directly dispatching
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

      // Position station cylinders
      stationMeshesRef.current.forEach((mesh, i) => {
        if (i < stations.length) {
          const station = stations[i];
          const [lng, lat] = station.geometry.coordinates;
          const alt = 50;
          const { x, y, z } = latLngAltToVector3(
            { lat, lng, altitude: alt },
            anchor
          );
          mesh.position.set(x, y, z);
        }
      });

      // debug markers
      const offsets = [
        { lat: 0.001, lng: 0.001 },
        { lat: 0.001, lng: -0.001 },
        { lat: -0.001, lng: -0.001 },
        { lat: -0.001, lng: 0.001 },
        { lat: 0, lng: 0 },
      ];
      debugMarkersRef.current.forEach((marker, i) => {
        if (i < offsets.length) {
          const offset = offsets[i];
          const markerLat = anchor.lat + offset.lat;
          const markerLng = anchor.lng + offset.lng;

          const { x, y, z } = latLngAltToVector3(
            { lat: markerLat, lng: markerLng, altitude: 100 },
            anchor
          );
          marker.position.set(x, y, z);
        }
      });

      // buildings: place them at (centerX, centerY, 0)
      buildingMeshesRef.current.forEach((bldg) => {
        if (bldg.userData.centerPos) {
          const c = bldg.userData.centerPos as THREE.Vector3;
          bldg.position.set(c.x, c.y, 0);
        }
      });

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

      // cleanup
      const cleanupMeshes = (meshes: THREE.Mesh[]) => {
        meshes.forEach((m) => {
          scene?.remove(m);
          m.geometry.dispose();
          disposeMaterial(m.material);
        });
        meshes.length = 0;
      };
      cleanupMeshes(stationMeshesRef.current);
      cleanupMeshes(buildingMeshesRef.current);
      cleanupMeshes(debugMarkersRef.current);

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