"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";

// MeshLine imports (v1.4.0)
// @ts-expect-error
import { MeshLine, MeshLineMaterial } from "three.meshline";

// Redux + slices
import { useAppSelector } from "@/store/store";
import { StationFeature } from "@/store/stationsSlice";
import { selectRouteDecoded } from "@/store/bookingSlice";
import { selectDispatchRouteDecoded } from "@/store/dispatchSlice";

// Constants
import { DISPATCH_HUB } from "@/constants/map";

// Pre-create reusable objects for calculations
const tempMatrix = new THREE.Matrix4();
const tempVector = new THREE.Vector3();

/**
 * Hook: useThreeOverlay with:
 *   1) InstancedMesh cubes for stations
 *   2) Thick lines (MeshLine) for the dispatch route + booking route
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null
) {
  // References to the overlay and scene
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Refs for the station InstancedMeshes
  const greyInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const blueInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const redInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);

  // Station ID mapping refs
  const stationIndexMapsRef = useRef<{
    grey: number[];
    blue: number[];
    red: number[];
  }>({
    grey: [],
    blue: [],
    red: [],
  });

  // Shared geometry/material refs with proper disposal
  const stationBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);

  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // ---- MeshLine Refs for Dispatch & Booking routes ----
  // Instead of THREE.Line, we store references to MeshLine-based Mesh
  const dispatchRouteMeshRef = useRef<THREE.Mesh | null>(null);
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null);

  // Materials for our thick lines
  const dispatchLineMatRef = useRef<MeshLineMaterial | null>(null);
  const bookingLineMatRef = useRef<MeshLineMaterial | null>(null);

  // Pull Decoded Routes from Redux
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded);
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded);

  // Lights (memoized)
  const lights = useMemo(() => ({
    ambient: new THREE.AmbientLight(0xffffff, 0.75),
    directional: (() => {
      const light = new THREE.DirectionalLight(0xffffff, 0.25);
      light.position.set(0, 10, 50);
      return light;
    })()
  }), []);

  // Altitude offset so lines are above ground
  const ROUTE_ALTITUDE = 5;

  // -------------------------------------------------
  // Function: populate station cubes in instanced meshes
  // -------------------------------------------------
  function populateInstancedMeshes() {
    if (
      !greyInstancedMeshRef.current ||
      !blueInstancedMeshRef.current ||
      !redInstancedMeshRef.current ||
      !overlayRef.current
    ) {
      return;
    }

    const greyMesh = greyInstancedMeshRef.current;
    const blueMesh = blueInstancedMeshRef.current;
    const redMesh = redInstancedMeshRef.current;

    let counts = { grey: 0, blue: 0, red: 0 };

    // Clear existing maps
    stationIndexMapsRef.current = { grey: [], blue: [], red: [] };

    // Batch process stations
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;

      // Convert lat/lng to 3D coords
      overlayRef.current!.latLngAltitudeToVector3(
        { lat, lng, altitude: DISPATCH_HUB.altitude + 50 },
        tempVector
      );

      // Reuse tempMatrix for transform
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z);

      // Color stations by departure/arrival or normal
      if (station.id === departureStationId) {
        blueMesh.setMatrixAt(counts.blue, tempMatrix);
        stationIndexMapsRef.current.blue[counts.blue] = station.id;
        counts.blue++;
      } else if (station.id === arrivalStationId) {
        redMesh.setMatrixAt(counts.red, tempMatrix);
        stationIndexMapsRef.current.red[counts.red] = station.id;
        counts.red++;
      } else {
        greyMesh.setMatrixAt(counts.grey, tempMatrix);
        stationIndexMapsRef.current.grey[counts.grey] = station.id;
        counts.grey++;
      }
    });

    greyMesh.count = counts.grey;
    blueMesh.count = counts.blue;
    redMesh.count = counts.red;

    greyMesh.instanceMatrix.needsUpdate = true;
    blueMesh.instanceMatrix.needsUpdate = true;
    redMesh.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------
  // createOrUpdateMeshLine() using MeshLine geometry
  // -------------------------------------------------
  function createOrUpdateMeshLine(
    decodedPath: Array<{ lat: number; lng: number }>,
    meshRef: React.MutableRefObject<THREE.Mesh | null>,
    meshLineMaterial: MeshLineMaterial,
    scene: THREE.Scene,
    overlay: ThreeJSOverlayView
  ) {
    // Skip if route is too short
    if (!decodedPath || decodedPath.length < 2) {
      return;
    }

    // Convert lat/lng to Vector3 array
    const points: THREE.Vector3[] = decodedPath.map(({ lat, lng }) => {
      const vector = new THREE.Vector3();
      overlay.latLngAltitudeToVector3({ lat, lng, altitude: ROUTE_ALTITUDE }, vector);
      return vector;
    });

    // 1) Create or update MeshLine geometry
    const lineGeometry = new MeshLine();
    // .setPoints() can accept an array of Vector3
    lineGeometry.setPoints(points);

    if (!meshRef.current) {
      // 2) Create Mesh with MeshLine geometry + material
      const mesh = new THREE.Mesh(lineGeometry.geometry, meshLineMaterial);

      // If you want raycasting to work on these lines:
      // mesh.raycast = MeshLineRaycast; // from "three.meshline"

      // Render on top
      mesh.renderOrder = 9999;

      meshRef.current = mesh;
      scene.add(mesh);
    } else {
      // Update existing mesh geometry in place
      // We can replace the geometry entirely
      meshRef.current.geometry.dispose(); // free old geometry
      meshRef.current.geometry = lineGeometry.geometry;
    }
  }

  // -------------------------------------------------
  // Initialize overlay + scene
  // -------------------------------------------------
  useEffect(() => {
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing Three.js overlay...");

    // Create scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Add lights
    scene.add(lights.ambient);
    scene.add(lights.directional);

    // Create overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error - ignoring type mismatch
      THREE,
    });
    overlayRef.current = overlay;

    // Create shared geometries
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }
    if (!stationBoxGeoRef.current) {
      stationBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }

    // Create shared materials (dispatch + stations)
    if (!dispatchMatRef.current) {
      dispatchMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!matGreyRef.current) {
      matGreyRef.current = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!matBlueRef.current) {
      matBlueRef.current = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!matRedRef.current) {
      matRedRef.current = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        opacity: 0.8,
        transparent: true,
      });
    }

    // Create thick line materials via MeshLineMaterial
    if (!dispatchLineMatRef.current) {
      dispatchLineMatRef.current = new MeshLineMaterial({
        color: new THREE.Color(0xf5f5f5), // light color
        lineWidth: 15,                    // thick line width in world units
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      });
    }

    if (!bookingLineMatRef.current) {
      bookingLineMatRef.current = new MeshLineMaterial({
        color: new THREE.Color(0x03a9f4), // bright-ish blue
        lineWidth: 15,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      });
    }

    // Create dispatch cube
    const dispatchCube = new THREE.Mesh(dispatchBoxGeoRef.current, dispatchMatRef.current);
    overlay.latLngAltitudeToVector3(
      { lat: DISPATCH_HUB.lat, lng: DISPATCH_HUB.lng, altitude: DISPATCH_HUB.altitude + 50 },
      tempVector
    );
    dispatchCube.position.copy(tempVector);
    dispatchCube.scale.set(1, 1, 1);
    scene.add(dispatchCube);

    // Create InstancedMeshes for stations
    const maxInstances = stations.length;
    const colors = ["grey", "blue", "red"] as const;
    const materials = {
      grey: matGreyRef.current!,
      blue: matBlueRef.current!,
      red: matRedRef.current!,
    };
    const meshRefs = {
      grey: greyInstancedMeshRef,
      blue: blueInstancedMeshRef,
      red: redInstancedMeshRef,
    };

    colors.forEach((color) => {
      const mesh = new THREE.InstancedMesh(stationBoxGeoRef.current!, materials[color], maxInstances);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      meshRefs[color].current = mesh;
    });

    // Populate station cubes
    populateInstancedMeshes();
    overlay.requestRedraw();

    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...");

      // Remove overlay
      if (overlayRef.current) {
        (overlayRef.current.setMap as (map: google.maps.Map | null) => void)(null);
      }

      // Clear scene
      scene.clear();
      sceneRef.current = null;

      // Dispose geometries
      dispatchBoxGeoRef.current?.dispose();
      stationBoxGeoRef.current?.dispose();

      // Dispose materials
      matGreyRef.current?.dispose();
      matBlueRef.current?.dispose();
      matRedRef.current?.dispose();
      dispatchMatRef.current?.dispose();
      dispatchLineMatRef.current?.dispose();
      bookingLineMatRef.current?.dispose();

      // Null out references
      dispatchBoxGeoRef.current = null;
      stationBoxGeoRef.current = null;
      matGreyRef.current = null;
      matBlueRef.current = null;
      matRedRef.current = null;
      dispatchMatRef.current = null;
      dispatchLineMatRef.current = null;
      bookingLineMatRef.current = null;

      greyInstancedMeshRef.current = null;
      blueInstancedMeshRef.current = null;
      redInstancedMeshRef.current = null;

      if (dispatchRouteMeshRef.current) {
        dispatchRouteMeshRef.current.geometry.dispose();
      }
      dispatchRouteMeshRef.current = null;

      if (bookingRouteMeshRef.current) {
        bookingRouteMeshRef.current.geometry.dispose();
      }
      bookingRouteMeshRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMap, stations.length, lights]);

  // -------------------------------------------------
  // Whenever station selection changes, re-populate cubes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || !googleMap || stations.length === 0) {
      return;
    }
    populateInstancedMeshes();
    overlayRef.current.requestRedraw();
  }, [departureStationId, arrivalStationId, stations.length]);

  // -------------------------------------------------
  // Whenever routes change, draw MeshLine routes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return;

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchLineMatRef.current) {
      createOrUpdateMeshLine(
        dispatchRouteDecoded,
        dispatchRouteMeshRef,
        dispatchLineMatRef.current,
        sceneRef.current,
        overlayRef.current
      );
    } else if (dispatchRouteMeshRef.current) {
      // Clear existing mesh if route is empty/short
      sceneRef.current.remove(dispatchRouteMeshRef.current);
      dispatchRouteMeshRef.current.geometry.dispose();
      dispatchRouteMeshRef.current = null;
    }

    // Booking route
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingLineMatRef.current) {
      createOrUpdateMeshLine(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingLineMatRef.current,
        sceneRef.current,
        overlayRef.current
      );
    } else if (bookingRouteMeshRef.current) {
      // Clear existing mesh if route is empty/short
      sceneRef.current.remove(bookingRouteMeshRef.current);
      bookingRouteMeshRef.current.geometry.dispose();
      bookingRouteMeshRef.current = null;
    }

    overlayRef.current.requestRedraw();
  }, [dispatchRouteDecoded, bookingRouteDecoded]);

  // Return any refs or data you need
  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  };
}
