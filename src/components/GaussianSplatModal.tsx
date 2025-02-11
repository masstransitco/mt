import React, { useEffect, useRef } from 'react';
import { Viewer } from 'gle-gaussian-splat-3d';
import * as THREE from 'three';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPLAT_FILE_PATH = 'icc.ply';

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (isOpen && containerRef.current && !viewerRef.current) {
      const containerEl = containerRef.current;

      const initViewer = async () => {
        try {
          // Initialize Three.js renderer first
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
          });
          rendererRef.current = renderer;
          containerEl.appendChild(renderer.domElement);

          // Create camera
          const camera = new THREE.PerspectiveCamera(
            65,
            containerEl.clientWidth / containerEl.clientHeight,
            0.1,
            1000
          );
          camera.position.set(0, 1.5, 4);
          camera.lookAt(0, 0, 0);

          // Initialize viewer with explicit renderer and camera [5][6]
          const viewer = new Viewer({
            renderer,
            camera,
            gpuAcceleratedSort: true,
            useBuiltInControls: true,
            selfDrivenMode: false,
            backgroundColor: new THREE.Color(0x151515),
          });

          viewerRef.current = viewer;

          try {
            const storage = getStorage();
            const fileRef = ref(storage, SPLAT_FILE_PATH);
            const signedUrl = await getDownloadURL(fileRef);
            const proxyUrl = `/api/splat?url=${encodeURIComponent(signedUrl)}`;

            // Load file using validated method [1][2]
            await viewer.loadFile(proxyUrl, {
              splatAlphaRemovalThreshold: 7,
              halfPrecisionCovariancesOnGPU: true,
              position: [0, -0.5, 0],
              rotation: [-Math.PI / 2, 0, 0]
            });

            viewer.start();
          } catch (error) {
            console.error('Error loading splat:', error);
            onClose();
          }

          // Handle window resizing
          const onResize = () => {
            camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
          };

          window.addEventListener('resize', onResize);
          onResize();

          return () => {
            window.removeEventListener('resize', onResize);
          };
        } catch (error) {
          console.error('Failed to initialize viewer:', error);
          onClose();
        }
      };

      initViewer();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.domElement.remove();
        rendererRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-85 flex justify-center items-center">
      <div className="relative w-[95vw] h-[95vh] bg-black rounded-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 bg-white bg-opacity-15 hover:bg-opacity-25 
                   text-white rounded-full cursor-pointer z-10 transition-colors duration-200"
          aria-label="Close"
        >
          ×
        </button>
        <div
          ref={containerRef}
          className="w-full h-full touch-none"
        />
      </div>
    </div>
  );
};

export default GaussianSplatModal;
