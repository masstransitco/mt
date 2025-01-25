'use client';

import React, {
  Suspense,
  useRef,
  useEffect,
  useMemo,
  memo,
} from 'react';
import Image from 'next/image';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
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
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import LoadingOverlay from '@/components/ui/loading-overlay';

interface Car3DViewerProps {
  modelUrl: string;
  imageUrl: string; // for fallback or reference
  width?: string | number;
  height?: string | number;
  selected?: boolean;
  isVisible?: boolean;
}

/* -------------- Loading Overlay -------------- */
function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  );
}

/* -------------- Car Model -------------- */
function CarModel({
  url,
  interactive,
}: {
  url: string;
  interactive: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF(url, '/draco/', true) as any;
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  useFrame(() => {
    // If not interactive, rotate the model slowly
    if (!interactive && groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  useEffect(() => {
    if (!scene) return;

    // Rotate model initially
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

/* -------------- Camera + Controls -------------- */
function CameraSetup({ interactive }: { interactive: boolean }) {
  const { camera, scene } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;

    const perspectiveCam = camera as THREE.PerspectiveCamera;
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = (perspectiveCam.fov * Math.PI) / 180;
    const distance = Math.abs(maxDim / Math.sin(fovRad / 2)) * 0.4;

    perspectiveCam.position.set(
      center.x,
      center.y + maxDim * 0.5,
      center.z + distance
    );
    perspectiveCam.lookAt(center);
    perspectiveCam.updateProjectionMatrix();

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
      enabled={interactive}
    />
  );
}

/* -------------- Scene Components -------------- */
function SceneLighting() {
  return (
    <>
      {/* Primary Directional Light with Shadows */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512} // Reduced from 1024
        shadow-mapSize-height={512} // Reduced from 1024
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      {/* Secondary Directional Lights without Shadows */}
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.25}
        color="#FFE4B5"
        castShadow={false} // Disabled shadows
      />
      <directionalLight
        position={[0, -5, 0]}
        intensity={0.15}
        color="#4169E1"
        castShadow={false} // Disabled shadows
      />
      {/* Ambient Light */}
      <ambientLight intensity={0.3} />
    </>
  );
}

/* -------------- Post Processing with SSAO -------------- */
function PostProcessing({ interactive }: { interactive: boolean }) {
  return (
    <EffectComposer
      multisampling={interactive ? 4 : 0} // Reduced from 8 to 4
      enabled={interactive}
    >
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={interactive ? 16 : 0} // Reduced from 31 to 16
        radius={3} // Reduced from 5 to 3
        intensity={20} // Reduced from 30 to 20
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

// Use a simple cache to avoid reloading the same model
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

  // WebGL settings
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

  // Preload the model if selected
  useEffect(() => {
    if (selected && !modelsCache.has(modelUrl)) {
      useGLTF.preload(modelUrl);
      modelsCache.set(modelUrl, true);
    }
  }, [modelUrl, selected]);

  // Container styling
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

  // If not visible, render nothing
  if (!isVisible) {
    return null;
  }

  // If not selected, show fallback image
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

  // Otherwise, show the 3D viewer
  return (
    <div style={containerStyles}>
      <Canvas
        ref={canvasRef}
        shadows
        gl={glSettings}
        orthographic={false}
        camera={{ position: [0, 2, 5], fov: 45 }}
        dpr={[1, 1.2]} // Reduced from [1, 1.5] to [1, 1.2]
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        {/* BakeShadows removed as shadows are handled by the primary directional light */}
        <SceneLighting />
        <PostProcessing interactive={true} />
        <Environment preset="sunset" background={false} /> {/* Changed to a lighter preset */}
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

// Helper if you want to preload multiple URLs in a batch
export function preloadCarModels(urls: string[]) {
  urls.forEach((url) => {
    if (!modelsCache.has(url)) {
      useGLTF.preload(url);
      modelsCache.set(url, true);
    }
  });
}
