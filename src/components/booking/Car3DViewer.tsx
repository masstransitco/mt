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

/* -------------------------------------
   Type & Props
------------------------------------- */
interface Car3DViewerProps {
  /** URL/path to the GLB model */
  modelUrl: string;
  /**
   * imageUrl can be `undefined` if the parent
   * has no image. We'll handle fallback inside this component.
   */
  imageUrl?: string;
  /** Container width (default: "100%") */
  width?: string | number;
  /** Container height (default: "300px") */
  height?: string | number;
  /** If false, hides the entire 3D canvas */
  isVisible?: boolean;
  /** Enables orbit controls & postprocessing if true */
  interactive?: boolean;
}

/* -------------------------------------
   Loading indicator while model loads
------------------------------------- */
function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  );
}

/* -------------------------------------
   The actual 3D model
------------------------------------- */
function CarModel({ url, interactive }: { url: string; interactive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Use a GLTF loader hook
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any;

  // Clone so each usage can manipulate its own copy if needed
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  // Initial model setup
  useEffect(() => {
    if (!scene) return;
    // Adjust position/rotation
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

/* -------------------------------------
   Orbit controls (camera)
------------------------------------- */
function CameraSetup({ interactive }: { interactive: boolean }) {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      enabled={interactive}
      enableZoom={interactive}
      enablePan={false}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
    />
  );
}

/* -------------------------------------
   Lights & ambient
------------------------------------- */
function SceneLighting() {
  return (
    <>
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
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

/* -------------------------------------
   Optional PostProcessing
------------------------------------- */
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

/* -------------------------------------
   Optional: Preloading logic
------------------------------------- */
const modelsCache = new Map<string, boolean>();

/* -------------------------------------
   Main Car3DViewer component
------------------------------------- */
function Car3DViewer({
  modelUrl,
  imageUrl, // optional
  width = "100%",
  height = "300px",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  // Provide a fallback if 'imageUrl' is undefined
  const finalImageUrl = imageUrl ?? "/cars/fallback.png";

  // If you plan to use 'finalImageUrl' for something in the scene,
  // e.g. environment textures or screenshot placeholders, you can do so here.

  // Preload the model if not cached
  useEffect(() => {
    if (!modelsCache.has(modelUrl)) {
      try {
        // @ts-ignore
        useGLTF.preload(modelUrl);
        modelsCache.set(modelUrl, true);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  }, [modelUrl]);

  // If not visible, return nothing
  if (!isVisible) {
    return null;
  }

  // Inline styling for the container
  const containerStyles = useMemo<React.CSSProperties>(
    () => ({
      width,
      height,
      overflow: "hidden",
      position: "relative",
    }),
    [width, height]
  );

  return (
    <div style={containerStyles}>
      <Canvas
        // If you'd like to use or show finalImageUrl in some way,
        // you can pass it to background or a custom effect. Right now, it's unused.
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

        {/* Scene Lights */}
        <SceneLighting />

        {/* PostProcessing only if interactive */}
        <PostProcessing interactive={interactive} />

        {/* Optional environment */}
        <Environment preset="sunset" background={false} />
        <color attach="background" args={["#1a1a1a"]} />

        {/* Suspense for model loading */}
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <CarModel url={modelUrl} interactive={interactive} />

          {/* Preload sub-assets in the GLTF */}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(Car3DViewer);

/* -------------------------------------
   Optional helper to preload multiple URLs
------------------------------------- */
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
