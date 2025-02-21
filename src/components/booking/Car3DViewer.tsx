"use client";

import React, { Suspense, useRef, useEffect, useMemo, memo, useState } from "react";
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
  modelUrl: string;
  imageUrl?: string;
  width?: string | number;
  height?: string | number;
  isVisible?: boolean;
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
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any;
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  // Initial model setup
  useEffect(() => {
    if (!scene) return;

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

    if (url.includes("kona.glb")) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = 1.0 / maxDim;
      scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      box.setFromObject(scene);
      box.getCenter(center);
      scene.position.x -= center.x;
      scene.position.y -= center.y;
      scene.position.z -= center.z;
      scene.position.y -= 0.2;
    } else {
      scene.position.set(0, -0.3, 0);
    }
  }, [scene, url]);

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
      <directionalLight position={[5, 5, 5]} intensity={1.0} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
      <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" castShadow={false} />
      <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" castShadow={false} />
      <ambientLight intensity={0.3} />
    </>
  );
}

/* -------------------------------------
   Optional PostProcessing
------------------------------------- */
function PostProcessing({ interactive }: { interactive: boolean }) {
  return (
    <EffectComposer multisampling={interactive ? 4 : 0} enabled={interactive} enableNormalPass>
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
   Preloading logic with cache
------------------------------------- */
const modelsCache = new Map<string, boolean>();

/* -------------------------------------
   Main Car3DViewer component
------------------------------------- */
function Car3DViewer({
  modelUrl,
  imageUrl,
  width = "100%",
  height = "300px",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  const finalImageUrl = imageUrl ?? "/cars/fallback.png";

  useEffect(() => {
    if (!modelsCache.has(modelUrl)) {
      try {
        useGLTF.preload(modelUrl);
        modelsCache.set(modelUrl, true);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  }, [modelUrl]);

  if (!isVisible) return null;

  const containerStyles = useMemo<React.CSSProperties>(
    () => ({ width, height, overflow: "hidden", position: "relative" }),
    [width, height]
  );

  return (
    <div style={containerStyles}>
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          premultipliedAlpha: true,
          logarithmicDepthBuffer: false,
        }}
        shadows
        camera={{ position: [0, 2, 3], fov: 15 }}
        dpr={[1, 1.5]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <SceneLighting />
        <PostProcessing interactive={interactive} />
        <Environment preset="sunset" background={false} />
      

        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <CarModel url={modelUrl} interactive={interactive} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(Car3DViewer);

export function preloadCarModels(urls: string[]) {
  urls.forEach((url) => {
    if (!modelsCache.has(url)) {
      try {
        useGLTF.preload(url);
        modelsCache.set(url, true);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  });
}
