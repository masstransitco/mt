'use client';
import React, { Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  useGLTF, 
  Html, 
  Environment,
  Preload,
  useProgress,
} from '@react-three/drei';
import { 
  EffectComposer,
  SSAO,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

// Loading progress component
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

// Camera adjustment component with memoization
function CameraSetup() {
  const three = useThree();
  const camera = three.camera as THREE.PerspectiveCamera;
  const { scene } = three;
  const controlsRef = useRef<any>();

  useEffect(() => {
    const adjustCamera = () => {
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;

      camera.position.set(center.x, center.y + maxDim * 0.5, center.z + cameraZ);
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    };

    const timeoutId = setTimeout(adjustCamera, 100);
    return () => clearTimeout(timeoutId);
  }, [scene, camera]);

  return <OrbitControls ref={controlsRef} />;
}

// Memoized car model component
const CarModel = React.memo(function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, '/draco/', true); // Enable progressive loading
  
  useEffect(() => {
    const materials: THREE.Material[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        if (child.material) {
          child.material.roughness = 0.4;
          child.material.metalness = 0.8;
          materials.push(child.material);
        }
      }
    });

    // Cleanup materials on unmount
    return () => {
      materials.forEach(material => material.dispose());
    };
  }, [scene]);
  
  return <primitive object={scene} />;
});

// Lighting setup component
const SceneLighting = React.memo(() => (
  <>
    <ambientLight intensity={0.5} />
    <directionalLight position={[5, 5, 5]} intensity={1.0} castShadow />
    <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" />
    <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" />
  </>
));

// Post-processing setup
const PostProcessing = React.memo(() => (
  <EffectComposer multisampling={8} enableNormalPass={true}>
    <SSAO 
      blendFunction={BlendFunction.MULTIPLY}
      samples={31}
      radius={5}
      intensity={30}
      luminanceInfluence={0.5}
      color={new THREE.Color(0x000000)}
      distanceScaling={true}
      depthAwareUpsampling={true}
      worldDistanceThreshold={1}
      worldDistanceFalloff={1}
      worldProximityThreshold={1}
      worldProximityFalloff={1}
    />
  </EffectComposer>
));

interface Car3DViewerProps {
  modelUrl: string;
  width?: string;
  height?: string;
  selected?: boolean;
}

export default function Car3DViewer({
  modelUrl,
  width = '100%',
  height = '300px',
  selected = false
}: Car3DViewerProps) {
  // Memoize canvas settings
  const glSettings = useMemo(() => ({
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    preserveDrawingBuffer: true
  }), []);

  return (
    <div style={{ width, height, pointerEvents: selected ? 'auto' : 'none' }}>
      <Canvas shadows gl={glSettings} camera={{ position: [0, 2, 5], fov: 45 }}>
        <SceneLighting />
        <PostProcessing />
        <Environment preset="studio" background={false} />
        <color attach="background" args={['#1a1a1a']} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup />
          <CarModel url={modelUrl} />
          <Preload all /> {/* Preload all assets */}
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload models for faster subsequent loads
export function preloadCarModels(urls: string[]) {
  urls.forEach(url => useGLTF.preload(url));
}
