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

const CarModel = React.memo(function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, '/draco/', true);
  
  useEffect(() => {
    scene.rotation.y = Math.PI / 2;
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        if (child.material) {
          child.material.roughness = 0.4;
          child.material.metalness = 0.8;
          materials.push(child.material);
          geometries.push(child.geometry);
        }
      }
    });

    return () => {
      materials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.map?.dispose();
          material.normalMap?.dispose();
          material.roughnessMap?.dispose();
          material.metalnessMap?.dispose();
          material.emissiveMap?.dispose();
          material.alphaMap?.dispose();
        }
        material.dispose();
      });
      
      geometries.forEach(geometry => {
        geometry.dispose();
      });
    };
  }, [scene]);
  
  return <primitive object={scene} />;
});

const SceneLighting = React.memo(() => (
  <>
    <ambientLight intensity={0.5} />
    <directionalLight position={[5, 5, 5]} intensity={1.0} castShadow />
    <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" />
    <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" />
  </>
));

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
  const glSettings = useMemo(() => ({
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    preserveDrawingBuffer: true
  }), []);

  useEffect(() => {
    return () => {
      try {
        const { scene: cachedScene } = useGLTF.get(modelUrl);
        if (cachedScene) {
          cachedScene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                  if (mat instanceof THREE.MeshStandardMaterial) {
                    mat.map?.dispose();
                    mat.normalMap?.dispose();
                    mat.roughnessMap?.dispose();
                    mat.metalnessMap?.dispose();
                  }
                  mat.dispose();
                });
              } else if (object.material instanceof THREE.MeshStandardMaterial) {
                object.material.map?.dispose();
                object.material.normalMap?.dispose();
                object.material.roughnessMap?.dispose();
                object.material.metalnessMap?.dispose();
                object.material.dispose();
              }
            }
          });
        }
        useGLTF.remove(modelUrl);
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    };
  }, [modelUrl]);

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
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function preloadCarModels(urls: string[]) {
  urls.forEach(url => useGLTF.preload(url));
}
