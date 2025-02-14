"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

/**
 * Encapsulates all Three.js overlay creation & disposal:
 *  - Lights
 *  - Dispatch Cube
 *  - Station Cubes
 *
 * We pass in the google Map instance + station data,
 * and this hook sets up the overlay once both are ready.
 *
 * Now also accepts selected station IDs to update cube colours:
 *  - Departure: blue (0x0000ff)
 *  - Arrival: red (0xff0000)
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null
) {
  // Refs to store the Three.js objects
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    // 1) If no map or no stations, skip initialization
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing overlay...");

    // 2) Create a new Scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // 3) Basic Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 10, 50);
    scene.add(directionalLight);

    // 4) Create Overlay
    //    Here we explicitly pass `THREE: typeof THREE`
    //    so we don't need @ts-expect-error
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error 'THREE' not in the official type def
      THREE: THREE, // Provide the imported module as "THREE"
    });
    overlayRef.current = overlay;

    // 5) Dispatch Cube
    const dispatchCubeGeo = new THREE.BoxGeometry(50, 50, 50);
    const dispatchCubeMat = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      opacity: 0.8,
      transparent: true,
    });
    const dispatchCube = new THREE.Mesh(dispatchCubeGeo, dispatchCubeMat);

    const dispatchCubePos = overlay.latLngAltitudeToVector3({
      lat: DISPATCH_HUB.lat,
      lng: DISPATCH_HUB.lng,
      altitude: DISPATCH_HUB.altitude + 50,
    });
    dispatchCube.position.copy(dispatchCubePos);
    dispatchCube.scale.set(3, 3, 3);
    scene.add(dispatchCube);

    // 6) Station Cubes
    const cubes: THREE.Mesh[] = [];
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;
      const stationCubePos = overlay.latLngAltitudeToVector3({
        lat,
        lng,
        altitude: DISPATCH_HUB.altitude + 50,
      });
      const stationCubeGeo = new THREE.BoxGeometry(50, 50, 50);
      const stationCubeMat = new THREE.MeshPhongMaterial({
        color: 0xcccccc, // default grey
        opacity: 0.8,
        transparent: true,
      });
      const stationCube = new THREE.Mesh(stationCubeGeo, stationCubeMat);
      stationCube.position.copy(stationCubePos);
      stationCube.scale.set(2.1, 2.1, 2.1);
      // Store the station data for later reference (e.g. raycasting)
      stationCube.userData = { station };
      scene.add(stationCube);
      cubes.push(stationCube);
    });
    stationCubesRef.current = cubes;

    // 7) Cleanup when stations/map changes or unmount
    return () => {
      console.log("[useThreeOverlay] Cleaning up overlay...");
      // Remove overlay from map
      if (overlayRef.current) {
        // @ts-ignore
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      // Dispose geometry/material
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
      scene.clear();
      sceneRef.current = null;
      stationCubesRef.current = [];
    };
  }, [googleMap, stations]);

  // New: Effect to update cube colours based on selected stations
  useEffect(() => {
    if (!stationCubesRef.current) return;
    stationCubesRef.current.forEach((cube) => {
      const station = cube.userData?.station;
      if (!station) return;
      // If this cube's station is the selected departure, set blue.
      if (departureStationId !== null && station.id === departureStationId) {
        (cube.material as THREE.MeshPhongMaterial).color.set(0x0000ff); // blue
      }
      // If this cube's station is the selected arrival, set red.
      else if (arrivalStationId !== null && station.id === arrivalStationId) {
        (cube.material as THREE.MeshPhongMaterial).color.set(0xff0000); // red
      } else {
        // Otherwise, revert to default grey.
        (cube.material as THREE.MeshPhongMaterial).color.set(0xcccccc);
      }
    });
  }, [departureStationId, arrivalStationId]);

  return {
    overlayRef,
    sceneRef,
    stationCubesRef,
  };
}
