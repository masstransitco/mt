'use client';

import React, {
  Suspense,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  BakeShadows,
  useProgress,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface Car3DViewerProps {
  modelUrl: string;
  width?: string | number;
  height?: string | number;
  selected?: boolean;
  isVisible?: boolean; // Add visibility prop
}

/* -------------- Loading Overlay -------------- */
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

/* -------------- Car Model -------------- */
function CarModel({ url, interactive }: { url: string; interactive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: originalScene } = useGLTF(url, '/draco/', true) as any;
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  // If not interactive, rotate the model slowly
  useFrame(() => {
    if (!interactive && groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  useEffect(() => {
    if (!scene) return;

    // Rotate the entire scene so car faces a consistent direction
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

    perspectiveCam.position.set(center.x, center.y + maxDim * 0.5, center.z + distance);
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

/* -------------- Scene Lighting -------------- */
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

/* -------------- Post Processing -------------- */
function PostProcessing({ interactive }: { interactive: boolean }) {
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

const modelsCache = new Map<string, any>();

export default function Car3DViewer({
  modelUrl,
  width = '100%',
  height = '300px',
  selected = false,
  isVisible = true,
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

  // Preload models and cache them
  useEffect(() => {
    if (!modelsCache.has(modelUrl)) {
      useGLTF.preload(modelUrl);
      modelsCache.set(modelUrl, true);
    }
  }, [modelUrl]);

  const containerStyles = useMemo<React.CSSProperties>(
    () => ({
      width,
      height,
      overflow: selected ? 'hidden' : 'auto',
      pointerEvents: 'auto',
      display: isVisible ? 'block' : 'none',
    }),
    [width, height, selected, isVisible]
  );

  // Don't render canvas if not visible
  if (!isVisible) {
    return <div style={containerStyles} />;
  }

  return (
    <div style={containerStyles}>
      <Canvas
        ref={canvasRef}
        shadows
        gl={glSettings}
        orthographic={false}
        camera={{ position: [0, 2, 5], fov: 45 }}
        dpr={[1, selected ? 1.5 : 1]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <BakeShadows />
        <SceneLighting />
        <PostProcessing interactive={selected} />
        <Environment preset="studio" background={false} />
        <color attach="background" args={['#1a1a1a']} />

        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={selected} />
          <CarModel url={modelUrl} interactive={selected} />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function preloadCarModels(urls: string[]) {
  urls.forEach((url) => {
    if (!modelsCache.has(url)) {
      useGLTF.preload(url);
      modelsCache.set(url, true);
    }
  });
}
