"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

/**
 * Custom hook that sets up the Three.js overlay whenever a map instance is ready,
 * plus a list of stations to display as cubes.
 *
 * Returns references to the overlay, the scene, and an array of station-cube meshes.
 * Usage:
 *   const { overlayRef, sceneRef, stationCubesRef } =
 *       useThreeOverlay(mapRef.current, stations);
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[]
) {
  // Refs to hold overlay, scene, and station cubes
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    // If no map or no stations, do nothing
    if (!googleMap || stations.length === 0) return;

    // 1) Create the Scene
    const scene = new THREE.Scene();
    scene.background = null; // Make it transparent
    sceneRef.current = scene;

    // 2) Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 10, 50);
    scene.add(directionalLight);

    // 3) Create the overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error
      THREE,
    });
    overlayRef.current = overlay;

    // 4) Add a "dispatch cube" at DISPATCH_HUB
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

    // 5) For each station, add a "station cube"
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
        color: 0xcccccc,
        opacity: 0.8,
        transparent: true,
      });
      const stationCube = new THREE.Mesh(stationCubeGeo, stationCubeMat);

      stationCube.position.copy(stationCubePos);
      stationCube.scale.set(2.1, 2.1, 2.1);
      stationCube.userData = { station };
      scene.add(stationCube);
      cubes.push(stationCube);
    });
    stationCubesRef.current = cubes;

    // CLEANUP when component unmounts or map/stations changes
    return () => {
      // Remove the overlay from the map
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }

      // Dispose geometry/materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
      scene.clear();
      sceneRef.current = null;
      stationCubesRef.current = [];
    };
  }, [googleMap, stations]);

  return {
    overlayRef,
    sceneRef,
    stationCubesRef,
  };
}
