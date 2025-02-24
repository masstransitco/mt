"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";

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
 *   2) 3D lines for the dispatch route + booking route
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

  // Shared geometry/material refs with proper disposal tracking
  const stationBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);

  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // ---- Lines for Routes ----
  // Each route will have its own line + geometry reference for easy updates
  const dispatchRouteLineRef = useRef<THREE.Line | null>(null);
  const bookingRouteLineRef = useRef<THREE.Line | null>(null);

  // Materials for lines (we’ll keep them fairly simple)
  const dispatchLineMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const bookingLineMatRef = useRef<THREE.LineBasicMaterial | null>(null);

  // ---- Pull Decoded Routes from Redux store ----
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded);
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded);

  // Memoize lights to prevent recreation
  const lights = useMemo(() => ({
    ambient: new THREE.AmbientLight(0xffffff, 0.75),
    directional: (() => {
      const light = new THREE.DirectionalLight(0xffffff, 0.25);
      light.position.set(0, 10, 50);
      return light;
    })()
  }), []);

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

      // Reuse tempVector for position calculation
      overlayRef.current!.latLngAltitudeToVector3(
        {
          lat,
          lng,
          altitude: DISPATCH_HUB.altitude + 50,
        },
        tempVector
      );

      // Reuse tempMatrix for transform
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z);

      // Branch: color stations by departure vs arrival vs normal
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

    // Update instance counts and matrices
    greyMesh.count = counts.grey;
    blueMesh.count = counts.blue;
    redMesh.count = counts.red;

    greyMesh.instanceMatrix.needsUpdate = true;
    blueMesh.instanceMatrix.needsUpdate = true;
    redMesh.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------
  // Function: create or update a 3D line from decoded route
  // -------------------------------------------------
  function createOrUpdateLine(
    decodedPath: Array<{ lat: number; lng: number }>,
    lineRef: React.MutableRefObject<THREE.Line | null>,
    material: THREE.LineBasicMaterial,
    scene: THREE.Scene,
    overlay: ThreeJSOverlayView
  ) {
    // Convert lat/lng to Vector3 array
    const points = decodedPath.map(({ lat, lng }) => {
      overlay.latLngAltitudeToVector3({ lat, lng, altitude: 0 }, tempVector);
      return new THREE.Vector3(tempVector.x, tempVector.y, tempVector.z);
    });

    if (!lineRef.current) {
      // Create new geometry + line
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);

      // Optionally: put the line "on top" by turning off depth test
      // so cubes/stations won't hide it, or vice versa
      line.renderOrder = 9999; // big number so it’s drawn last
      material.depthTest = false; 
      material.depthWrite = false;

      lineRef.current = line;
      scene.add(line);
    } else {
      // Update existing geometry
      const geometry = lineRef.current.geometry as THREE.BufferGeometry;
      geometry.setFromPoints(points);
      geometry.computeBoundingSphere();
    }
  }

  // -------------------------------------------------
  // Initialize the overlay + scene once
  // -------------------------------------------------
  useEffect(() => {
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing Three.js overlay...");

    // Create and setup scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Add memoized lights
    scene.add(lights.ambient);
    scene.add(lights.directional);

    // Create overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error
      THREE,
    });
    overlayRef.current = overlay;

    // Create shared geometries (if not exist)
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }
    if (!stationBoxGeoRef.current) {
      stationBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }

    // Create shared materials (if not exist)
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

    // Create materials for lines
    if (!dispatchLineMatRef.current) {
      dispatchLineMatRef.current = new THREE.LineBasicMaterial({
        color: 0xf5f5f5, // light color
        linewidth: 2,    // Note: Most browsers only respect "linewidth" in WebGL contexts
      });
    }
    if (!bookingLineMatRef.current) {
      bookingLineMatRef.current = new THREE.LineBasicMaterial({
        color: 0x03a9f4, // bright-ish blue
        linewidth: 2,
      });
    }

    // Create dispatch cube
    const dispatchCube = new THREE.Mesh(
      dispatchBoxGeoRef.current,
      dispatchMatRef.current
    );
    
    // Position dispatch cube with optimized vector reuse
    overlay.latLngAltitudeToVector3({
      lat: DISPATCH_HUB.lat,
      lng: DISPATCH_HUB.lng,
      altitude: DISPATCH_HUB.altitude + 50,
    }, tempVector);
    dispatchCube.position.copy(tempVector);
    dispatchCube.scale.set(1, 1, 1);
    scene.add(dispatchCube);

    // Create InstancedMeshes with optimized setup
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
      const mesh = new THREE.InstancedMesh(
        stationBoxGeoRef.current!,
        materials[color],
        maxInstances
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      meshRefs[color].current = mesh;
    });

    // Populate station cubes initially
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

      // Clear all refs
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

      // Remove lines
      dispatchRouteLineRef.current = null;
      bookingRouteLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMap, stations.length, lights]);

  // -------------------------------------------------
  // Whenever station selection changes, re-populate cubes
  // -------------------------------------------------
  useEffect(() => {
    if (
      !sceneRef.current ||
      !overlayRef.current ||
      !googleMap ||
      stations.length === 0
    ) {
      return;
    }
    populateInstancedMeshes();
    overlayRef.current.requestRedraw();
  }, [departureStationId, arrivalStationId, stations.length]);

  // -------------------------------------------------
  // Whenever dispatch route or booking route changes, draw 3D lines
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return;

    // Create / update dispatch route line
    if (dispatchRouteDecoded && dispatchRouteDecoded.length > 0) {
      if (dispatchLineMatRef.current) {
        createOrUpdateLine(
          dispatchRouteDecoded,
          dispatchRouteLineRef,
          dispatchLineMatRef.current,
          sceneRef.current,
          overlayRef.current
        );
      }
    } else {
      // If the route is cleared, remove the line from the scene
      if (dispatchRouteLineRef.current) {
        sceneRef.current.remove(dispatchRouteLineRef.current);
        dispatchRouteLineRef.current.geometry.dispose();
        dispatchRouteLineRef.current = null;
      }
    }

    // Create / update booking route line
    if (bookingRouteDecoded && bookingRouteDecoded.length > 0) {
      if (bookingLineMatRef.current) {
        createOrUpdateLine(
          bookingRouteDecoded,
          bookingRouteLineRef,
          bookingLineMatRef.current,
          sceneRef.current,
          overlayRef.current
        );
      }
    } else {
      // If the route is cleared, remove the line
      if (bookingRouteLineRef.current) {
        sceneRef.current.remove(bookingRouteLineRef.current);
        bookingRouteLineRef.current.geometry.dispose();
        bookingRouteLineRef.current = null;
      }
    }

    overlayRef.current.requestRedraw();
  }, [dispatchRouteDecoded, bookingRouteDecoded]);

  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  };
}
