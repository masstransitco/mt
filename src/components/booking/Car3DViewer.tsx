'use client';

import React, { Suspense, useRef, useEffect, useMemo, memo } from 'react';
import Image from 'next/image';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  useProgress,
} from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import LoadingOverlay from '@/components/ui/loading-overlay';

interface Car3DViewerProps {
  modelUrl: string;
  imageUrl: string;
  width?: string | number;
  height?: string | number;
  selected?: boolean;
  isVisible?: boolean;
}

function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  );
}

function CarModel({ url, interactive }: { url: string; interactive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF(url, '/draco/', true) as any;
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  useEffect(() => {
    if (!scene) return;
    // Initial rotation and material adjustments.
    scene.position.set(0, -0.8, 0);
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

function CameraSetup({ interactive }: { interactive: boolean }) {
  const { camera, scene } = useMemo(() => {
    // Return the default camera and scene from the fiber context.
    return { camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene() };
  }, []);
  return <OrbitControls
  enableDamping
  dampingFactor={0.05}
  enableZoom={false}
  minPolarAngle={0}
  maxPolarAngle={Math.PI / 2}
  enablePan={false}   // Disable panning
/>;
}

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
      <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" castShadow={false} />
      <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" castShadow={false} />
      <ambientLight intensity={0.3} />
    </>
  );
}

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

// Use a simple cache to avoid reloading the same model.
const modelsCache = new Map<string, boolean>();

function Car3DViewer({
  modelUrl,
  imageUrl,
  width = '100%',
  height = '300px',
  selected = false,
  isVisible = true,
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create isolated WebGL settings with a unique id.
  const glSettings = useMemo(
    () => ({
      antialias: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance' as WebGLPowerPreference,
      premultipliedAlpha: false,
      logarithmicDepthBuffer: true,
      // Generate a unique id based on the modelUrl.
      id: `car-3d-viewer-${modelUrl.split('/').pop()}`,
    }),
    [modelUrl]
  );

  useEffect(() => {
    if (selected && !modelsCache.has(modelUrl)) {
      // Preload the model if selected.
      // (Assumes useGLTF.preload is available.)
      // @ts-ignore
      useGLTF.preload(modelUrl);
      modelsCache.set(modelUrl, true);
    }
  }, [modelUrl, selected]);

  const containerStyles = useMemo<React.CSSProperties>(
    () => ({
      width,
      height,
      overflow: selected ? 'hidden' : 'auto',
      pointerEvents: 'auto',
      display: isVisible ? 'block' : 'none',
      position: 'relative',
    }),
    [width, height, selected, isVisible]
  );

  if (!isVisible) {
    return null;
  }

  if (!selected) {
    return (
      <div style={containerStyles}>
        <Image
          src={imageUrl}
          alt="Car preview"
          fill
          className="object-cover rounded-lg"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={!selected}
        />
      </div>
    );
  }

  return (
    <div style={containerStyles}>
      <Canvas
        ref={canvasRef}
        gl={glSettings}
        shadows
        orthographic={false}
        camera={{ position: [0, 2, 3], fov: 15 }}
        dpr={[1, 1.2]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <SceneLighting />
        <PostProcessing interactive={true} />
        <Environment preset="sunset" background={false} />
        <color attach="background" args={['#1a1a1a']} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={true} />
          <CarModel url={modelUrl} interactive={true} />
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
      // @ts-ignore
      useGLTF.preload(url);
      modelsCache.set(url, true);
    }
  });
}
