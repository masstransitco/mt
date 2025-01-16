'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

function CarModel({ url }: { url: string }) {
  // Pass the Draco folder path as the second argument:
  const { scene } = useGLTF(url, '/draco/'); 
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
        <Suspense fallback={<div>Loading 3D model...</div>}>
          <OrbitControls enablePan enableZoom autoRotate />
          <CarModel url={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}
