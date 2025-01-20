'use client';

import React, {
  Suspense,
  useRef,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  Preload,
  useProgress,
  AdaptiveDpr,
  AdaptiveEvents,
  BakeShadows,
} from '@react-three/drei';
import {
  EffectComposer,
  SSAO,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

/* ------------------- Loading Overlay -------------------- */
function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: '#fff', textAlign: 'center' }}>
        Loading 3D model... {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

/* ------------------- Camera and Controls ---------------- */
function CameraSetup({ interactive }: { interactive: boolean }) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<OrbitControls>(null);
  const onceRef = useRef(false);

  // Auto-fit the camera around the loaded scene (only runs once).
  useEffect(() => {
    if (onceRef.current) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = Math.abs(maxDim / Math.sin(fovRad / 2)) * 0.4;

    camera.position.set(center.x, center.y + maxDim * 0.5, center.z + distance);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
    onceRef.current = true;
  }, [camera, scene]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      // Disable user controls if not interactive
      enabled={interactive}
    />
  );
}

/* -------------------- 3D Car Model ----------------------- */
function CarModel({
  url,
  interactive,
}: {
  url: string;
  interactive: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // `useGLTF` caches internally, so the same URL won't be re-fetched.
  const { scene } = useGLTF(url, '/draco/', true) as any;

  // If not interactive, we optionally do a slow rotation in the render loop.
  useFrame(() => {
    if (!interactive && groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  // Minimal setup once the model is loaded:
  useEffect(() => {
    if (!scene) return;

    // Rotate model to face a consistent direction
    scene.rotation.y = Math.PI / 2;

    // Optionally tweak materials
    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();

        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.4;
          child.material.metalness = 0.8;
        }
      }
    });
  }, [scene]);

  return scene ? <primitive ref={groupRef} object={scene} /> : null;
}

/* ----------------- Scene Lighting Setup ----------------- */
function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" />
      <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" />
    </>
  );
}

/* ------------------- Post Processing -------------------- */
function PostProcessing({ interactive }: { interactive: boolean }) {
  // Only enable the postprocessing if interactive (selected)
  return (
    <EffectComposer multisampling={interactive ? 8 : 0} enabled={interactive}>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={interactive ? 31 : 0}
        radius={5}
        intensity={30}
        luminanceInfluence={0.5}
        color={new THREE.Color(0x000000)}
        distanceScaling
        depthAwareUpsampling
        worldDistanceThreshold={1}
        worldDistanceFalloff={1}
        worldProximityThreshold={1}
        worldProximityFalloff={1}
      />
    </EffectComposer>
  );
}

/* ------------------- Main Viewer Comp ------------------- */
export interface Car3DViewerProps {
  modelUrl: string;
  width?: string | number;
  height?: string | number;
  selected?: boolean; // "interactive" concept
}

/**
 * Car3DViewer
 *
 * - If `selected` is true, orbit controls + postprocessing are enabled.
 * - Otherwise, the model is still visible but is less GPU-intensive.
 */
export default function Car3DViewer({
  modelUrl,
  width = '100%',
  height = '300px',
  selected = false,
}: Car3DViewerProps) {
  const glSettings = useMemo(
    () => ({
      antialias: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance' as WebGLPowerPreference,
    }),
    []
  );

  // Preload model
  useEffect(() => {
    // Preload the model so it’s cached by useGLTF:
    useGLTF.preload(modelUrl);
  }, [modelUrl]);

  return (
    <div
      style={{
        width,
        height,
        // If not selected, remove pointer events so it's not interactive
        pointerEvents: selected ? 'auto' : 'none',
      }}
    >
      <Canvas
        shadows
        gl={glSettings}
        camera={{ position: [0, 2, 5], fov: 45 }}
        // Lower dpr if not selected for performance
        dpr={[1, selected ? 1.5 : 1]}
      >
        {/* Reduces overhead for unselected items */}
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <BakeShadows />

        <SceneLighting />

        {/* Interactive-based post-processing */}
        <PostProcessing interactive={selected} />

        <Environment preset="studio" background={false} />
        <color attach="background" args={['#1a1a1a']} />

        <Suspense fallback={<LoadingScreen />}>
          {/* The camera/controls are interactive only if selected */}
          <CameraSetup interactive={selected} />

          <CarModel url={modelUrl} interactive={selected} />

          {/* Preload all current used assets for better performance */}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ------------------ Utility Preloader ------------------- */
export function preloadCarModels(urls: string[]) {
  urls.forEach((url) => useGLTF.preload(url));
}
