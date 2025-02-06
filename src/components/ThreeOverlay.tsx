'use client'

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { ThreeJSOverlayView } from "@googlemaps/three";

/**
 * Example station interface
 */
interface Station {
  name: string;
  lat: number;
  lng: number;
}

interface ThreeOverlayProps {
  map: google.maps.Map;
  stations: Station[];
}

/**
 * Helper function to create a basic sphere marker.
 * You can replace this with any custom geometry (e.g. cubes, custom 3D models, etc.).
 */
function createStationMarker(color = 0xff0000) {
  const geometry = new THREE.SphereGeometry(10, 16, 16); // radius=10
  const material = new THREE.MeshPhongMaterial({ color, emissive: 0x222222 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Helper function to create a basic THREE.js Scene with lighting, etc.
 */
function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  // Example lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(100, 200, 300);
  dirLight.castShadow = true;
  scene.add(dirLight);

  return scene;
}

/**
 * ThreeOverlay - Renders 3D station markers in the same coordinate space as Google Maps
 */
export function ThreeOverlay({ map, stations }: ThreeOverlayProps) {
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!map) return;

    console.log("Initializing ThreeOverlay...");

    // 1) Create a THREE.js scene
    const scene = createScene();
    sceneRef.current = scene;

    // 2) Create our overlay
    const overlay = new ThreeJSOverlayView({
      map,
      scene,
      anchor: new google.maps.LatLng(0, 0), // Will be updated once we have stations
      three: {
        camera: {
          fov: 45,
          near: 1,
          far: 2000,
        },
        contextAttributes: {
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false,
          stencil: true,
          depth: true,
          powerPreference: "high-performance",
        },
      },
    });

    overlay.setMap(map);

    // 3) Start an animation loop once the overlay is added
    overlay.onAdd = () => {
      console.log("ThreeOverlay added to map");
      const animate = () => {
        // Update any animations or dynamic properties here
        overlay.requestRedraw();
        requestAnimationFrame(animate);
      };
      animate();
    };

    // 4) Create a WebGL renderer when the context is ready
    overlay.onContextRestored = ({ gl }: { gl: WebGLRenderingContext }) => {
      console.log("WebGL context restored in ThreeOverlay");
      if (!gl) return;

      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas,
        context: gl,
        ...gl.getContextAttributes(),
      });

      renderer.autoClear = false;
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      rendererRef.current = renderer;
    };

    // 5) Render loop on each map frame
    overlay.onDraw = ({ gl, transformer }) => {
      const camera = overlay.getCamera();
      if (!camera || !rendererRef.current || !sceneRef.current) return;

      // Example: anchor + altitude = 100
      // This is a minimal example. 
      // You can refine how you compute the transform based on your usage.
      const latLngAlt = {
        lat: overlay.anchor.lat(),
        lng: overlay.anchor.lng(),
        altitude: 100,
      };

      // The transformer handles projection from LatLngAlt -> matrix
      const matrix = transformer.fromLatLngAltitude(latLngAlt);
      camera.projectionMatrix.fromArray(matrix);

      // Render the scene
      rendererRef.current.render(sceneRef.current, camera);
      rendererRef.current.resetState();
      overlay.requestRedraw();
    };

    overlayRef.current = overlay;

    // Cleanup
    return () => {
      console.log("Cleaning up ThreeOverlay...");
      overlay.setMap(null);

      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (obj.material instanceof THREE.Material) {
              obj.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [map]);

  /**
   * On stations change, re-generate marker meshes in the scene.
   */
  useEffect(() => {
    if (!sceneRef.current || !overlayRef.current || stations.length === 0) return;

    console.log("Rendering 3D station markers:", stations);

    // Clear old station meshes
    sceneRef.current.children
      .filter((child) => child.userData.isStation)
      .forEach((child) => {
        sceneRef.current?.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

    // For simplicity, anchor to the first station
    const [firstStation] = stations;
    if (!firstStation) return;

    overlayRef.current.anchor = new google.maps.LatLng(firstStation.lat, firstStation.lng);

    // Convert lat/lng differences to approximate meter offsets from anchor
    const anchorLat = firstStation.lat;
    const anchorLng = firstStation.lng;
    stations.forEach((station) => {
      const dLat = station.lat - anchorLat;
      const dLng = station.lng - anchorLng;

      // Rough conversion: ~111,000 meters per degree of lat,
      // and ~111,000 * cos(lat) for degrees of lng
      const xOffset = dLng * 111000 * Math.cos((anchorLat * Math.PI) / 180);
      const yOffset = 0; // you could raise/lower station if desired
      const zOffset = -dLat * 111000;

      // Create a 3D marker
      const marker = createStationMarker(0x0088ff);
      marker.position.set(xOffset, yOffset, zOffset);
      marker.userData.isStation = true;

      // Optionally store the station name, etc. for reference
      marker.userData.stationName = station.name;

      // Add to the scene
      sceneRef.current?.add(marker);
    });

    // Request an immediate redraw
    overlayRef.current.requestRedraw();
  }, [stations]);

  return null;
}
