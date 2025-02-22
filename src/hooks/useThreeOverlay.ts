"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

/**
 * Hook: useThreeOverlay (Optimized + TypeScript-friendly)
 *
 * 1) Reuses a SINGLE BoxGeometry for all station cubes.
 * 2) Reuses three Materials (grey, blue, red).
 * 3) Creates a separate single geometry/material for the dispatch cube.
 * 4) Removes large scaling to reduce potential confusion or overlap.
 * 5) Cleans up gracefully when unmounted.
 * 6) Uses typed Mesh generics to avoid casting.
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

  // Keep track of station meshes (all BoxGeometry + MeshPhongMaterial)
  const stationCubesRef = useRef<
    THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhongMaterial>[]
  >([]);

  // --- Refs for shared geometry and materials ---
  const stationBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const matGreyRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matBlueRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const matRedRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // Similarly for the dispatch cube
  const dispatchBoxGeoRef = useRef<THREE.BoxGeometry | null>(null);
  const dispatchMatRef = useRef<THREE.MeshPhongMaterial | null>(null);

  // ------------------------------------------------------------------
  // 1) Main effect to create the overlay & mesh objects
  // ------------------------------------------------------------------
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
      // @ts-expect-error: 'THREE' not officially part of the type definition
      THREE: THREE,
    });
    overlayRef.current = overlay;

    // ----------------------------------
    // Ensure shared geometry/materials
    // ----------------------------------
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

    // ----------------------------------
    // Create the "Dispatch Cube"
    // ----------------------------------
    const dispatchGeo = dispatchBoxGeoRef.current;
    const dispatchMat = dispatchMatRef.current;

    // Specify the geometry/material type generics to keep TS happy
    const dispatchCube = new THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshPhongMaterial
    >(dispatchGeo!, dispatchMat!);

    // Position the dispatch cube
    const dispatchPos = overlay.latLngAltitudeToVector3({
      lat: DISPATCH_HUB.lat,
      lng: DISPATCH_HUB.lng,
      altitude: DISPATCH_HUB.altitude + 50,
    });
    dispatchCube.position.copy(dispatchPos);
    dispatchCube.scale.set(1, 1, 1); // Optional: adjust scale as needed

    scene.add(dispatchCube);

    // ----------------------------------
    // Create Station Cubes
    // ----------------------------------
    const cubes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhongMaterial>[] = [];
    const boxGeo = stationBoxGeoRef.current;
    const greyMat = matGreyRef.current;

    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;
      const stationPos = overlay.latLngAltitudeToVector3({
        lat,
        lng,
        altitude: DISPATCH_HUB.altitude + 50,
      });

      // Reuse the same geometry and the default grey material
      const stationCube = new THREE.Mesh<
        THREE.BoxGeometry,
        THREE.MeshPhongMaterial
      >(boxGeo!, greyMat!);

      stationCube.position.copy(stationPos);
      stationCube.scale.set(1, 1, 1); // removed large scale

      // For raycasting or color updates
      stationCube.userData = { station };

      scene.add(stationCube);
      cubes.push(stationCube);
    });

    stationCubesRef.current = cubes;

    // ----------------------------------
    // Cleanup on unmount or re-run
    // ----------------------------------
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...");

      // Remove overlay from the map
      if (overlayRef.current) {
        // @ts-ignore
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }

      // If you want to reuse the shared geometry/material, do NOT dispose them here,
      // or be sure to re-initialize them next time. For now, we skip disposal:
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          // If you prefer to recreate everything each time,
          // you would dispose here, e.g.:
          // obj.geometry.dispose();
          // if (Array.isArray(obj.material)) {
          //   obj.material.forEach((m) => m.dispose());
          // } else {
          //   obj.material.dispose();
          // }
        }
      });
      scene.clear();

      stationCubesRef.current = [];
      sceneRef.current = null;
    };
  }, [googleMap, stations]);

  // ------------------------------------------------------------------
  // 2) Effect to update station cube colors if departure/arrival changes
  // ------------------------------------------------------------------
  useEffect(() => {
    const blueMat = matBlueRef.current;
    const redMat = matRedRef.current;
    const greyMat = matGreyRef.current;

    if (!stationCubesRef.current || stationCubesRef.current.length === 0) {
      return;
    }

    stationCubesRef.current.forEach((cube) => {
      const station = cube.userData?.station as StationFeature | undefined;
      if (!station) return;

      if (departureStationId !== null && station.id === departureStationId) {
        cube.material = blueMat!;
      } else if (arrivalStationId !== null && station.id === arrivalStationId) {
        cube.material = redMat!;
      } else {
        cube.material = greyMat!;
      }
    });

    // Force redraw
    overlayRef.current?.requestRedraw();
  }, [departureStationId, arrivalStationId]);

  // Return references if needed elsewhere
  return {
    overlayRef,
    sceneRef,
    stationCubesRef,
  };
}
