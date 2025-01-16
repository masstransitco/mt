'use client';

import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';

function CarModel({ url }: { url: string }) {
  // Load the model, specifying the Draco decoder path if needed
  const { scene } = useGLTF(url, '/draco/');

  // Compute bounding info to remove "Missing min/max" warnings.
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
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
        
        {/* Use Suspense with a valid R3F fallback to avoid "Div is not part of the THREE namespace!" */}
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
