// src/components/GaussianSplatModal.tsx

import React, { useEffect, useRef } from 'react';
import { Viewer, PlyLoader, SplatLoader } from 'gle-gaussian-splat-3d';
import * as THREE from 'three';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Path to your publicly accessible point-cloud PLY file
 * (e.g., from Firebase Storage).
 */
const SPLAT_FILE_URL =
  'https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=fe72cbcf-4a26-42b4-b307-211fe431f641';

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (isOpen && containerRef.current && !viewerRef.current) {
      // Store in local variable to confirm it's non-null
      const containerEl = containerRef.current;

      const initViewer = async () => {
        try {
          // Initialize Three.js renderer
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
          });

          // Set up camera
          const camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
          );
          camera.position.set(0, 1.5, 4);
          camera.lookAt(0, 0, 0);

          // Create the Viewer
          const viewer = new Viewer({
            renderer,
            camera,
            gpuAcceleratedSort: true,
            useBuiltInControls: true,
            selfDrivenMode: false,
            backgroundColor: new THREE.Color(0x151515),
            cameraUp: [0, 1, 0], // Y-up system
          });

          viewerRef.current = viewer;
          containerEl.appendChild(renderer.domElement);

          // Convert PLY to SPLAT at runtime
          const plyLoader = new PlyLoader();
          const splatBuffer = await plyLoader.loadFromURL(SPLAT_FILE_URL, {
            positionQuantizationBits: 12,
            scaleQuantizationBits: 10,
            colorQuantizationBits: 8,
          });

          // Parse the splatBuffer into a SplatScene
          const splatLoader = new SplatLoader(splatBuffer);
          const splatScene = await splatLoader.getSplatScene();

          // Add the new scene
          viewer.addSplatScene(splatScene, {
            splatAlphaRemovalThreshold: 7,
            showLoadingSpinner: true,
            // Adjust for coordinate alignment if needed
            position: [0, -0.5, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: [1, 1, 1],
            progressCallback: (progress) => {
              console.log(`Loading: ${(progress * 100).toFixed(1)}%`);
            },
          });

          // Optional: Axes for orientation
          viewer.scene.add(new THREE.AxesHelper(2));
          viewer.start();

          // Handle window resizing
          const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
          };
          window.addEventListener('resize', onResize);

          // Cleanup resize listener if modal closes/unmounts
          return () => {
            window.removeEventListener('resize', onResize);
          };
        } catch (error) {
          console.error('Failed to load splat:', error);
          onClose();
        }
      };

      // Initialize the viewer
      initViewer();
    }

    // Cleanup on unmount or modal close
    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          ×
        </button>
        <div ref={containerRef} className="splat-container" />
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          position: relative;
          width: 95vw;
          height: 95vh;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
        }

        .close-button {
          position: absolute;
          top: 15px;
          right: 15px;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          z-index: 1;
          transition: background 0.2s;
        }
        .close-button:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .splat-container {
          width: 100%;
          height: 100%;
          touch-action: none;
        }
      `}</style>
    </div>
  );
};

export default GaussianSplatModal;