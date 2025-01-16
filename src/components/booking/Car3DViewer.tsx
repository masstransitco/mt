'use client';

import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three'; // Import the namespace

function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url, '/draco/');

  useEffect(() => {
    scene.traverse((child) => {
      // TypeScript: check if this child is a Mesh
      if (child instanceof THREE.Mesh) {
        // Now TS knows `child` is a Mesh, so geometry is defined
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
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
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, 5, 5]} />
        <Suspense
          fallback={
            <Html center>
              <div style={{ color: '#fff', textAlign: 'center' }}>
                Loading 3D model...
              </div>
            </Html>
          }
        >
          <OrbitControls enablePan enableZoom autoRotate />
          <CarModel url={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}
