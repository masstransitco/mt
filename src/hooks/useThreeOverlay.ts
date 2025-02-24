"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";
import { StationFeature } from "@/store/stationsSlice";
import { DISPATCH_HUB } from "@/constants/map";

// Pre-create reusable objects for calculations
const tempMatrix = new THREE.Matrix4();
const tempVector = new THREE.Vector3();

/**
 * Hook: useThreeOverlay using InstancedMesh for stations.
 * 
 * Optimized version with shared resources and proper memory management.
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

  // Memoize lights to prevent recreation
  const lights = useMemo(() => ({
    ambient: new THREE.AmbientLight(0xffffff, 0.75),
    directional: (() => {
      const light = new THREE.DirectionalLight(0xffffff, 0.25);
      light.position.set(0, 10, 50);
      return light;
    })()
  }), []);

  /**
   * Optimized helper to populate instanced meshes
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

    let counts = { grey: 0, blue: 0, red: 0 };
    
    // Clear existing maps
    stationIndexMapsRef.current = { grey: [], blue: [], red: [] };

    // Batch process stations
    stations.forEach((station) => {
      const [lng, lat] = station.geometry.coordinates;
      
      // Reuse tempVector for position calculation
      overlayRef.current!.latLngAltitudeToVector3({
        lat,
        lng,
        altitude: DISPATCH_HUB.altitude + 50,
      }, tempVector);
      
      // Reuse tempMatrix for transform
      tempMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z);

      // Optimized branching logic
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

    // Create shared geometries (if not exists)
    if (!dispatchBoxGeoRef.current) {
      dispatchBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }
    if (!stationBoxGeoRef.current) {
      stationBoxGeoRef.current = new THREE.BoxGeometry(50, 50, 50);
    }

    // Create shared materials (if not exists)
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
    const colors = ['grey', 'blue', 'red'] as const;
    const materials = {
      grey: matGreyRef.current!,
      blue: matBlueRef.current!,
      red: matRedRef.current!
    };
    const meshRefs = {
      grey: greyInstancedMeshRef,
      blue: blueInstancedMeshRef,
      red: redInstancedMeshRef
    };

    colors.forEach(color => {
      const mesh = new THREE.InstancedMesh(
        stationBoxGeoRef.current!,
        materials[color],
        maxInstances
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      meshRefs[color].current = mesh;
    });

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

      // Clear all refs
      dispatchBoxGeoRef.current = null;
      stationBoxGeoRef.current = null;
      matGreyRef.current = null;
      matBlueRef.current = null;
      matRedRef.current = null;
      dispatchMatRef.current = null;
      greyInstancedMeshRef.current = null;
      blueInstancedMeshRef.current = null;
      redInstancedMeshRef.current = null;
    };
  }, [googleMap, stations, lights]);

  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || !googleMap || stations.length === 0) return;
    populateInstancedMeshes();
    overlayRef.current?.requestRedraw();
  }, [departureStationId, arrivalStationId]);

  return {
    overlayRef,
    sceneRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
  };
}
