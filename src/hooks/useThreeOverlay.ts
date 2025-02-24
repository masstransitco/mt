"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";

// We no longer import @googlemaps/three or three.meshline at top-level.
// Instead, we'll import them dynamically inside a useEffect.

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
 *   2) Thick lines (MeshLine) for the dispatch + booking routes
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null
) {
  // -- Dynamic references to the libraries once loaded
  const [GoogleMapsThree, setGoogleMapsThree] = useState<any>(null);
  const [MeshLineLib, setMeshLineLib] = useState<{
    MeshLine: any;
    MeshLineMaterial: any;
  } | null>(null);

  // Refs for the overlay and scene
  const overlayRef = useRef<any>(null); // Will become an instance of ThreeJSOverlayView
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

  // MeshLine route references (instead of THREE.Line)
  const dispatchRouteMeshRef = useRef<THREE.Mesh | null>(null);
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null);

  // MeshLine materials
  const dispatchLineMatRef = useRef<any>(null); // will store a MeshLineMaterial
  const bookingLineMatRef = useRef<any>(null);

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
    })(),
  }), []);

  // Altitude offset so lines are above ground
  const ROUTE_ALTITUDE = 5;

  // -------------------------------------------------
  // 1) Dynamically import the libraries in the browser
  // -------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR safety

    let isMounted = true;
    Promise.all([
      import("@googlemaps/three"),    // returns { ThreeJSOverlayView, ... }
      // @ts-expect-error
      import("three.meshline"),       // returns { MeshLine, MeshLineMaterial, ... }
    ])
      .then(([googleMapsThree, meshline]) => {
        if (!isMounted) return;

        // Save references in state
        setGoogleMapsThree(googleMapsThree); // will contain .ThreeJSOverlayView
        setMeshLineLib({
          MeshLine: meshline.MeshLine,
          MeshLineMaterial: meshline.MeshLineMaterial,
        });
      })
      .catch((err) => {
        console.error("Error importing dynamic libs:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------
  // 2) Create or update the scene once libraries are loaded
  // -------------------------------------------------
  useEffect(() => {
    // If the libraries aren't loaded or no map/stations yet, skip
    if (!GoogleMapsThree || !MeshLineLib) return;
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing Three.js overlay...");

    // Extract the classes from the dynamic import
    const { ThreeJSOverlayView } = GoogleMapsThree;
    const { MeshLineMaterial } = MeshLineLib;

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

    // Create shared materials for dispatch/stations
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

    // Populate station cubes initially
    populateInstancedMeshes();
    overlay.requestRedraw();

    // Cleanup
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...");

      // Remove overlay
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
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
  }, [GoogleMapsThree, MeshLineLib, googleMap, stations.length, lights]);

  // -------------------------------------------------
  // 3) Populate station cubes when station selection changes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || !googleMap || stations.length === 0) {
      return;
    }
    populateInstancedMeshes();
    overlayRef.current.requestRedraw();
  }, [departureStationId, arrivalStationId, stations.length]);

  // -------------------------------------------------
  // 4) Whenever routes change, draw MeshLine routes
  // -------------------------------------------------
  useEffect(() => {
    // If the scene or overlay isn't ready or the libs aren't loaded, skip
    if (
      !sceneRef.current ||
      !overlayRef.current ||
      !GoogleMapsThree ||
      !MeshLineLib
    ) {
      return;
    }

    const scene = sceneRef.current;
    const overlay = overlayRef.current;

    // Helpers
    const createOrUpdateMeshLine = (
      decodedPath: Array<{ lat: number; lng: number }>,
      meshRef: React.MutableRefObject<THREE.Mesh | null>,
      meshLineMaterial: any
    ) => {
      // Skip if route is too short
      if (!decodedPath || decodedPath.length < 2) return;

      const { MeshLine } = MeshLineLib;

      // Convert lat/lng to Vector3 array
      const points: THREE.Vector3[] = decodedPath.map(({ lat, lng }) => {
        const vector = new THREE.Vector3();
        overlay.latLngAltitudeToVector3({ lat, lng, altitude: ROUTE_ALTITUDE }, vector);
        return vector;
      });

      // Build the geometry
      const lineGeometry = new MeshLine();
      lineGeometry.setPoints(points);

      // If there's no existing mesh, create a new one
      if (!meshRef.current) {
        const mesh = new THREE.Mesh(lineGeometry.geometry, meshLineMaterial);
        mesh.renderOrder = 9999; // on top
        meshRef.current = mesh;
        scene.add(mesh);
      } else {
        // Update existing geometry
        meshRef.current.geometry.dispose();
        meshRef.current.geometry = lineGeometry.geometry;
      }
    };

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchLineMatRef.current) {
      createOrUpdateMeshLine(
        dispatchRouteDecoded,
        dispatchRouteMeshRef,
        dispatchLineMatRef.current
      );
    } else if (dispatchRouteMeshRef.current) {
      // Clear existing mesh if route is empty/short
      scene.remove(dispatchRouteMeshRef.current);
      dispatchRouteMeshRef.current.geometry.dispose();
      dispatchRouteMeshRef.current = null;
    }

    // Booking route
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingLineMatRef.current) {
      createOrUpdateMeshLine(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingLineMatRef.current
      );
    } else if (bookingRouteMeshRef.current) {
      // Clear existing mesh if route is empty/short
      scene.remove(bookingRouteMeshRef.current);
      bookingRouteMeshRef.current.geometry.dispose();
      bookingRouteMeshRef.current = null;
    }

    overlay.requestRedraw();
  }, [
    dispatchRouteDecoded,
    bookingRouteDecoded,
    GoogleMapsThree,
    MeshLineLib,
  ]);

  // -------------------------------------------------
  // Helper to populate station cubes
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
      overlayRef.current.latLngAltitudeToVector3(
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
  // Return any needed references
  // -------------------------------------------------
  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  };
}
