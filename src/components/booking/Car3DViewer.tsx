'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

// We declare a small "model loader" sub-component 
// that uses the useGLTF hook to load and display the model.

function CarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

// The outer Car3DViewer sets up the Canvas, camera, lights, controls, etc.
interface Car3DViewerProps {
  modelUrl: string;
  width?: string;  // optional style props
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
        <ambientLight />
        <Suspense fallback={null}>
          <OrbitControls enablePan enableZoom autoRotate />
          <CarModel url={modelUrl} />
        </Suspense>
      </Canvas>
    </div>
  );
}
