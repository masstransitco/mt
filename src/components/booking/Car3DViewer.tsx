"use client";

import React, { Suspense, useRef, useEffect, useMemo, memo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

import LoadingOverlay from "@/components/ui/loading-overlay";

// -------------------------------------
// Types
// -------------------------------------
interface Car3DViewerProps {
  modelUrl: string;           // Path to the model
  imageUrl: string;           // Unused now, but kept if you still want it
  width?: string | number;
  height?: string | number;
  isVisible?: boolean;        // If false, completely hide the component
  interactive?: boolean;      // <--- NEW: controls orbit/panning/zoom
}

// -------------------------------------
// Loading State
// -------------------------------------
function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  );
}

// -------------------------------------
// The main 3D model component
// -------------------------------------
function CarModel({ url, interactive }: { url: string; interactive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Load the scene from cache or fetch if not loaded
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any;

  // Make a clone so each card can have its own transformation if needed
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  // Initial setup of the model
  useEffect(() => {
    if (!scene) return;
    scene.position.set(0, -0.2, 0);
    scene.rotation.y = Math.PI / 2;
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

// -------------------------------------
// Camera + Controls
// -------------------------------------
function CameraSetup({ interactive }: { interactive: boolean }) {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      // Make these props conditional on "interactive"
      enabled={interactive}
      enableZoom={interactive}
      enablePan={false} // Keep panning disabled or conditionally set it
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
    />
  );
}

// -------------------------------------
// Scene Lighting
// -------------------------------------
function SceneLighting() {
  return (
    <>
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.25}
        color="#FFE4B5"
        castShadow={false}
      />
      <directionalLight
        position={[0, -5, 0]}
        intensity={0.15}
        color="#4169E1"
        castShadow={false}
      />
      <ambientLight intensity={0.3} />
    </>
  );
}

// -------------------------------------
// PostProcessing
// -------------------------------------
function PostProcessing({ interactive }: { interactive: boolean }) {
  return (
    <EffectComposer
      multisampling={interactive ? 4 : 0}
      enabled={interactive}
      enableNormalPass
    >
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={interactive ? 16 : 0}
        radius={3}
        intensity={20}
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

// -------------------------------------
// Optional: simple cache to avoid repeated preload calls
// -------------------------------------
const modelsCache = new Map<string, boolean>();

/**
 * Car3DViewer: Always renders the 3D model, only interactive if `interactive={true}`.
 */
function Car3DViewer({
  modelUrl,
  imageUrl, // no longer used in this example
  width = "100%",
  height = "300px",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Once we see a modelUrl, optionally preload it if not in cache:
  useEffect(() => {
    if (!modelsCache.has(modelUrl)) {
      try {
        // @ts-ignore - if you have useGLTF.preload
        useGLTF.preload(modelUrl);
        modelsCache.set(modelUrl, true);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  }, [modelUrl]);

  const containerStyles = useMemo<React.CSSProperties>(
    () => ({
      width,
      height,
      overflow: "hidden",
      pointerEvents: "auto",
      display: isVisible ? "block" : "none",
      position: "relative",
    }),
    [width, height, isVisible]
  );

  // If not visible, return null to remove from layout
  if (!isVisible) {
    return null;
  }

  // Render the 3D scene in a <Canvas> for *all* cards,
  // with user interaction only if `interactive` is true.
  return (
    <div style={containerStyles}>
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          premultipliedAlpha: false,
          logarithmicDepthBuffer: true,
        }}
        shadows
        camera={{ position: [0, 2, 3], fov: 15 }}
        dpr={[1, 1.2]}
      >
        {/* Adaptive performance */}
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        {/* Lights */}
        <SceneLighting />

        {/* Optional post-processing. Enabled only when interactive=true */}
        <PostProcessing interactive={interactive} />

        {/* Env + background */}
        <Environment preset="sunset" background={false} />
        <color attach="background" args={["#1a1a1a"]} />

        {/* Suspense handles model loading progress */}
        <Suspense fallback={<LoadingScreen />}>
          {/* Only interactive if user says so */}
          <CameraSetup interactive={interactive} />

          {/* The model itself */}
          <CarModel url={modelUrl} interactive={interactive} />

          {/* Preload sub-assets in the GLTF */}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(Car3DViewer);

/**
 * Optional utility if you want to preload multiple model URLs at once
 * without having to rely on each card's effect:
 */
export function preloadCarModels(urls: string[]) {
  urls.forEach((url) => {
    if (!modelsCache.has(url)) {
      try {
        // @ts-ignore
        useGLTF.preload(url);
        modelsCache.set(url, true);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  });
}
