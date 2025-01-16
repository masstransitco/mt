'use client';
import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  useGLTF, 
  Html, 
  Environment,
} from '@react-three/drei';
import { 
  EffectComposer,
  SSAO,
  NormalPass,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, '/draco/');
  
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
        if (child.material) {
          child.material.roughness = 0.4;
          child.material.metalness = 0.8;
        }
      }
    });
  }, [scene]);
  
  return <primitive object={scene} />;
}

interface Car3DViewerProps {
  modelUrl: string;
  width?: string;
  height?: string;
}

export default function Car3DViewer({
  modelUrl,
  width = '100%',
  height = '300px'
}: Car3DViewerProps) {
  return (
    <div style={{ width, height }}>
      <Canvas
        shadows
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        camera={{ position: [0, 2, 5], fov: 45 }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1.0}
          castShadow
        />
        <directionalLight 
          position={[-5, 5, -5]} 
          intensity={0.25}
          color="#FFE4B5"
        />
        <directionalLight 
          position={[0, -5, 0]} 
          intensity={0.15}
          color="#4169E1"
        />
        <EffectComposer>
          <NormalPass />
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={30}
            radius={0.037}
            intensity={0.911}
            bias={0.0012}
            color={new THREE.Color(0x000000)}
            worldDistanceThreshold={1}
            worldDistanceFalloff={1}
            worldProximityThreshold={1}
            worldProximityFalloff={1}
            rings={7}
            depthAwareUpsampling={true}
          />
        </EffectComposer>
        <Environment preset="studio" background={false} />
        <color attach="background" args={['#1a1a1a']} />
        <Suspense
          fallback={
            <Html center>
              <div style={{ color: '#fff', textAlign: 'center' }}>
                Loading 3D model...
              </div>
            </Html>
          }
        >
          <OrbitControls 
            enablePan 
            enableZoom 
            autoRotate 
            autoRotateSpeed={0.5}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0}
          />
          <CarModel url={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}
