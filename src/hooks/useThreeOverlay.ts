// src/hooks/useThreeOverlay.ts
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

/**
 * Hook: useThreeOverlay
 * 
 * This hook sets up and tears down a Three.js overlay on top of a Google Map.
 * It draws:
 *   - A "Dispatch Cube" at the DISPATCH_HUB coords
 *   - Smaller "Station Cubes" at each station coordinate
 * It also updates the color of each Station Cube based on whether
 * it's the selected departure station (blue) or arrival station (red).
 *
 * Props:
 *   - googleMap: the Google Map instance to attach the overlay
 *   - stations: array of StationFeature objects
 *   - departureStationId: numeric ID of the selected departure station (or null)
 *   - arrivalStationId: numeric ID of the selected arrival station (or null)
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[],
  departureStationId: number | null,
  arrivalStationId: number | null
) {
  // References to the overlay, scene, and station cubes
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    // 1) If no map or no stations, skip initialization
    if (!googleMap || stations.length === 0) return;

    console.log("[useThreeOverlay] Initializing Three.js overlay...");

    // 2) Create a new Scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // 3) Basic lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 10, 50);
    scene.add(directionalLight);

    // 4) Create the Overlay
    //    We pass in the THREE module to the constructor
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error: 'THREE' not officially part of the type definition
      THREE: THREE,
    });
    overlayRef.current = overlay;

    // 5) Dispatch Cube (green)
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

    // 6) Station Cubes (default grey)
    const cubes: THREE.Mesh[] = [];
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;

      // Convert lat/lng to a 3D position
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

      // Store station data for later reference (raycast, color updates)
      stationCube.userData = { station };

      scene.add(stationCube);
      cubes.push(stationCube);
    });
    stationCubesRef.current = cubes;

    // 7) Cleanup when stations/map changes or unmount
    return () => {
      console.log("[useThreeOverlay] Cleaning up Three.js overlay...");

      // Remove overlay from map
      if (overlayRef.current) {
        // @ts-ignore (overlay .setMap(null) is valid but not typed)
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }

      // Dispose geometry/material in the scene
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

  // 8) Effect to update cube colours based on selected stations
  useEffect(() => {
    if (!stationCubesRef.current || stationCubesRef.current.length === 0) return;

    stationCubesRef.current.forEach((cube) => {
      const station = cube.userData?.station;
      if (!station) return;

      // If this cube's station is the departure station, make it blue
      if (departureStationId !== null && station.id === departureStationId) {
        (cube.material as THREE.MeshPhongMaterial).color.set(0x0000ff);
      }
      // If this cube's station is the arrival station, make it red
      else if (arrivalStationId !== null && station.id === arrivalStationId) {
        (cube.material as THREE.MeshPhongMaterial).color.set(0xff0000);
      }
      // Otherwise, revert to default grey
      else {
        (cube.material as THREE.MeshPhongMaterial).color.set(0xcccccc);
      }
    });

    // Request a redraw so the new colors are visible
    overlayRef.current?.requestRedraw();
  }, [departureStationId, arrivalStationId]);

  return {
    overlayRef,
    sceneRef,
    stationCubesRef,
  };
}
