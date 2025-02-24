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
 * A custom curve that interpolates between a set of points.
 * TubeGeometry requires a Curve subclass.
 */
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
      // If t is 1 or beyond, return the last point
      return optionalTarget.copy(this.points[this.points.length - 1]);
    }

    const p0 = this.points[index];
    const p1 = this.points[index + 1];
    return optionalTarget.copy(p0).lerp(p1, alpha);
  }
}

/**
 * Function: create or update a 3D TUBE from decoded route
 */
function createOrUpdateTube(
  decodedPath: Array<{ lat: number; lng: number }>,
  meshRef: React.MutableRefObject<THREE.Mesh | null>,
  material: THREE.MeshPhongMaterial,
  scene: THREE.Scene,
  overlay: ThreeJSOverlayView,
  altitude: number
) {
  // Skip if route is too short
  if (!decodedPath || decodedPath.length < 2) {
    return;
  }

  // Convert lat/lng to Vector3 array (with altitude offset)
  const points = decodedPath.map(({ lat, lng }) => {
    const vector = new THREE.Vector3();
    overlay.latLngAltitudeToVector3({ lat, lng, altitude }, vector);
    return vector;
  });

  // Build a custom curve from these points
  const curve = new CustomCurve(points);

  // Increase segments for smoother tube
  const tubularSegments = Math.max(points.length * 2, 30); // adjustable
  const radius = 8;      // thickness of the tube in world units
  const radialSegments = 6;  // how many segments around the radius
  const closed = false;   // typically false, as we have an open route

  // Create a new TubeGeometry
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    closed
  );

  if (!meshRef.current) {
    // Create a new mesh
    const mesh = new THREE.Mesh(geometry, material);

    // Ensure it’s drawn “on top”
    mesh.renderOrder = 999;
    
    meshRef.current = mesh;
    scene.add(mesh);
  } else {
    // Update existing mesh geometry
    meshRef.current.geometry.dispose();
    meshRef.current.geometry = geometry;
  }
}

/**
 * Hook: useThreeOverlay with:
 *   1) InstancedMesh cubes for stations
 *   2) 3D Tube geometry for dispatch/booking routes
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

  // Tube mesh references
  const dispatchRouteMeshRef = useRef<THREE.Mesh | null>(null);
  const bookingRouteMeshRef = useRef<THREE.Mesh | null>(null);

  // Materials for station cubes
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // Materials for tubes
  const dispatchTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const bookingTubeMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // Pull Decoded Routes from Redux
  const dispatchRouteDecoded = useAppSelector(selectDispatchRouteDecoded);
  const bookingRouteDecoded = useAppSelector(selectRouteDecoded);

  // Lights (memoized)
  const lights = useMemo(
    () => ({
      ambient: new THREE.AmbientLight(0xffffff, 0.75),
      directional: (() => {
        const light = new THREE.DirectionalLight(0xffffff, 0.25);
        light.position.set(0, 10, 50);
        return light;
      })(),
    }),
    []
  );

  // How high the route tubes float above ground
  const ROUTE_ALTITUDE = 50;

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
      // @ts-expect-error
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

    // Create shared materials for station cubes
    if (!dispatchMatRef.current) {
      dispatchMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!matGreyRef.current) {
      matGreyRef.current = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
      });
    }
    if (!matBlueRef.current) {
      matBlueRef.current = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
        opacity: 0.95,
        transparent: true,
      });
    }
    if (!matRedRef.current) {
      matRedRef.current = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        opacity: 0.95,
        transparent: true,
      });
    }

    // Create materials for route tubes
    if (!dispatchTubeMatRef.current) {
      dispatchTubeMatRef.current = new THREE.MeshPhongMaterial({
        color: 0xf5f5f5,
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!bookingTubeMatRef.current) {
      bookingTubeMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x03a9f4,
        opacity: 0.8,
        transparent: true,
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

    // Cleanup
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
      dispatchTubeMatRef.current?.dispose();
      bookingTubeMatRef.current?.dispose();

      // Null out references
      dispatchBoxGeoRef.current = null;
      stationBoxGeoRef.current = null;
      matGreyRef.current = null;
      matBlueRef.current = null;
      matRedRef.current = null;
      dispatchMatRef.current = null;
      dispatchTubeMatRef.current = null;
      bookingTubeMatRef.current = null;

      greyInstancedMeshRef.current = null;
      blueInstancedMeshRef.current = null;
      redInstancedMeshRef.current = null;

      // Remove route meshes
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
  // Whenever routes change, draw TUBE geometry routes
  // -------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return;

    // Dispatch route
    if (dispatchRouteDecoded && dispatchRouteDecoded.length >= 2 && dispatchTubeMatRef.current) {
      createOrUpdateTube(
        dispatchRouteDecoded,
        dispatchRouteMeshRef,
        dispatchTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        ROUTE_ALTITUDE
      );
    } else if (dispatchRouteMeshRef.current) {
      // Clear existing mesh if route is empty or too short
      sceneRef.current.remove(dispatchRouteMeshRef.current);
      dispatchRouteMeshRef.current.geometry.dispose();
      dispatchRouteMeshRef.current = null;
    }

    // Booking route
    if (bookingRouteDecoded && bookingRouteDecoded.length >= 2 && bookingTubeMatRef.current) {
      createOrUpdateTube(
        bookingRouteDecoded,
        bookingRouteMeshRef,
        bookingTubeMatRef.current,
        sceneRef.current,
        overlayRef.current,
        ROUTE_ALTITUDE
      );
    } else if (bookingRouteMeshRef.current) {
      // Clear existing mesh if route is empty or too short
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
