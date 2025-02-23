"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

/**
 * Hook: useThreeOverlay using InstancedMesh for stations.
 *
 * - We create three InstancedMeshes (grey, blue, red) for color-coded stations.
 * - Each station is assigned to exactly one mesh based on whether it is departure, arrival, or neither.
 * - We also track a parallel "instance -> stationId" map, so you can raycast to find which station was clicked.
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

  // We keep a parallel array of station IDs for each mesh color
  // so we can map instanceId -> stationId during raycast clicks
  const stationIndexMapsRef = useRef<{
    grey: number[];
    blue: number[];
    red: number[];
  }>({
    grey: [],
    blue: [],
    red: [],
  });

  // Shared geometry for all stations
  const stationBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  // Shared materials for grey/blue/red
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // Dispatch cube geometry/material
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  /**
   * Helper to (re)populate the instanced meshes with station transforms
   * based on whether each station is departure (blue), arrival (red), or grey.
   */
  function populateInstancedMeshes() {
    if (!greyInstancedMeshRef.current || !blueInstancedMeshRef.current || !redInstancedMeshRef.current) {
      return;
    }
    if (!overlayRef.current) {
      return;
    }

    const greyMesh = greyInstancedMeshRef.current;
    const blueMesh = blueInstancedMeshRef.current;
    const redMesh = redInstancedMeshRef.current;

    // Reset counters so we can reuse the same instanced meshes each time.
    let greyIndex = 0;
    let blueIndex = 0;
    let redIndex = 0;

    // Clear out old stationIndexMaps
    stationIndexMapsRef.current.grey = [];
    stationIndexMapsRef.current.blue = [];
    stationIndexMapsRef.current.red = [];

    // For each station, compute its position matrix and place it into one of the color meshes
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;
      // Convert lat/lng to 3D coordinates
      const stationPos = overlayRef.current!.latLngAltitudeToVector3({
        lat,
        lng,
        altitude: DISPATCH_HUB.altitude + 50,
      });

      const matrix = new THREE.Matrix4();
      matrix.makeTranslation(stationPos.x, stationPos.y, stationPos.z);

      // Decide which color category the station belongs to:
      if (station.id === departureStationId) {
        // departure → blue
        blueMesh.setMatrixAt(blueIndex, matrix);
        // Record station.id in the parallel array for "blue"
        stationIndexMapsRef.current.blue[blueIndex] = station.id;
        blueIndex++;
      } else if (station.id === arrivalStationId) {
        // arrival → red
        redMesh.setMatrixAt(redIndex, matrix);
        stationIndexMapsRef.current.red[redIndex] = station.id;
        redIndex++;
      } else {
        // otherwise → grey
        greyMesh.setMatrixAt(greyIndex, matrix);
        stationIndexMapsRef.current.grey[greyIndex] = station.id;
        greyIndex++;
      }
    });

    // Indicate how many instances are actually in use
    greyMesh.count = greyIndex;
    blueMesh.count = blueIndex;
    redMesh.count = redIndex;

    // Mark them for update
    greyMesh.instanceMatrix.needsUpdate = true;
    blueMesh.instanceMatrix.needsUpdate = true;
    redMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Main effect to create the Three.js scene, overlay, lights,
   * plus the dispatch cube and instanced meshes.
   */
  useEffect(() => {
    // If no map or no stations, skip creating the overlay
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing Three.js overlay...");

    // Create the Three.js scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 10, 50);
    scene.add(directionalLight);

    // Create the overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error: 'THREE' is not officially in the type definition
      THREE: THREE,
    });
    overlayRef.current = overlay;

    // -------------------------------
    // Ensure shared geometry/material
    // -------------------------------
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }
    if (!dispatchMatRef.current) {
      dispatchMatRef.current = new THREE.MeshPhongMaterial({
        color: 0x00ff00, // green
        opacity: 0.8,
        transparent: true,
      });
    }
    if (!stationBoxGeoRef.current) {
      stationBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
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

    // ---------------------------------------
    // Create the dispatch cube as a Mesh
    // ---------------------------------------
    const dispatchCube = new THREE.Mesh(
      dispatchBoxGeoRef.current,
      dispatchMatRef.current
    );
    // Position it
    const dispatchPos = overlay.latLngAltitudeToVector3({
      lat: DISPATCH_HUB.lat,
      lng: DISPATCH_HUB.lng,
      altitude: DISPATCH_HUB.altitude + 50,
    });
    dispatchCube.position.copy(dispatchPos);
    dispatchCube.scale.set(1, 1, 1);
    scene.add(dispatchCube);

    // -------------------------------------------
    // Create the 3 InstancedMeshes for stations
    // -------------------------------------------
    const maxInstances = stations.length; // capacity for each color

    const stationGeo = stationBoxGeoRef.current!;
    const greyMat = matGreyRef.current!;
    const blueMat = matBlueRef.current!;
    const redMat = matRedRef.current!;

    // Grey
    const greyMesh = new THREE.InstancedMesh(stationGeo, greyMat, maxInstances);
    greyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(greyMesh);
    greyInstancedMeshRef.current = greyMesh;

    // Blue
    const blueMesh = new THREE.InstancedMesh(stationGeo, blueMat, maxInstances);
    blueMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(blueMesh);
    blueInstancedMeshRef.current = blueMesh;

    // Red
    const redMesh = new THREE.InstancedMesh(stationGeo, redMat, maxInstances);
    redMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(redMesh);
    redInstancedMeshRef.current = redMesh;

    // -------------------------------------------
    // Initial population of the station positions
    // -------------------------------------------
    populateInstancedMeshes();
    overlay.requestRedraw();

    // Cleanup on unmount
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...");

      if (overlayRef.current) {
        // Remove overlay from the map
        // @ts-ignore
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      scene.clear();
      sceneRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleMap, stations]);

  /**
   * Whenever departureStationId or arrivalStationId changes,
   * re-populate the instanced meshes to reflect the correct colors.
   */
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current) return;
    if (!googleMap) return;
    if (stations.length === 0) return;

    populateInstancedMeshes();
    overlayRef.current?.requestRedraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureStationId, arrivalStationId]);

  return {
    overlayRef,
    sceneRef,

    // The three InstancedMesh refs if you want to raycast them individually
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,

    // The stationIndexMapsRef for instanceId -> stationId
    stationIndexMapsRef,
  };
}
