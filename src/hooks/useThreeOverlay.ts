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
 * and this hook sets up the overlay.
 */
export function useThreeOverlay(
  googleMap: google.maps.Map | null,
  stations: StationFeature[]
) {
  // Refs to store the Three.js objects
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    // If no map or no stations, bail out
    if (!googleMap || stations.length === 0) return;

    // 1) Create Scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // 2) Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 10, 50);
    scene.add(directionalLight);

    // 3) Create Overlay
    const overlay = new ThreeJSOverlayView({
      map: googleMap,
      scene,
      anchor: DISPATCH_HUB,
      // @ts-expect-error
      THREE,
    });
    overlayRef.current = overlay;

    // 4) Dispatch Cube
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

    // 5) Station Cubes
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

    // Cleanup when stations/map changes or unmount
    return () => {
      // Remove overlay from map
      if (overlayRef.current) {
        (overlayRef.current as any).setMap(null);
      overlayRef.current = null;
      }
      // Dispose all geometry/material
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

  return {
    overlayRef,
    sceneRef,
    stationCubesRef,
  };
}
