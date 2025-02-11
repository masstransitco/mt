// src/components/GaussianSplatModal.tsx

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSplatModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the user clicks "×" close button */
  onClose: () => void;
}

/**
 * Your Firebase-hosted .ply file
 */
const PLY_FILE_URL = 
  'https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=1aa07b53-eb82-48fc-8441-fa386e172312';

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const containerEl = containerRef.current;
    const renderWidth = containerEl.clientWidth;
    const renderHeight = containerEl.clientHeight;

    // 1) Create a WebGL renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(renderWidth, renderHeight);
    containerEl.appendChild(renderer.domElement);

    // 2) Create a PerspectiveCamera
    const camera = new THREE.PerspectiveCamera(65, renderWidth / renderHeight, 0.1, 500);
    // Example camera positions from the library docs—tweak as needed
    camera.position.set(-1, -4, 6);
    camera.up.set(0, -1, -0.6).normalize();
    camera.lookAt(new THREE.Vector3(0, 4, 0));

    // 3) Create the GaussianSplat3D Viewer
    const viewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      renderer,
      camera,
      useBuiltInControls: false,
      ignoreDevicePixelRatio: false,
      gpuAcceleratedSort: true,
      enableSIMDInSort: true,
      sharedMemoryForWorkers: true,
      integerBasedSort: true,
      halfPrecisionCovariancesOnGPU: true,
      dynamicScene: false,
      webXRMode: GaussianSplats3D.WebXRMode.None,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      antialiased: false,
      focalAdjustment: 1.0,
      logLevel: GaussianSplats3D.LogLevel.None,
      sphericalHarmonicsDegree: 0,
      enableOptionalEffects: false,
      plyInMemoryCompressionLevel: 2,
      freeIntermediateSplatData: false,
    });
    viewerRef.current = viewer;

    // Define the animation loop
    const update = () => {
      if (!viewerRef.current) return;
      viewerRef.current.update(); // Renders the splats
      requestAnimationFrame(update);
    };

    // 4) Load the .ply file from Firebase
    viewer
      .addSplatScene(PLY_FILE_URL)
      .then(() => {
        // Once loaded, start rendering
        requestAnimationFrame(update);
      })
      .catch((err: any) => {
        console.error('Failed to load splat scene:', err);
      });

    // Cleanup when unmounting or closing
    return () => {
      // Dispose viewer if needed
      viewerRef.current = null;
      renderer.dispose();
      // Remove canvas from DOM
      containerEl.removeChild(renderer.domElement);
    };
  }, [isOpen]);

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
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
        }
        .modal-content {
          position: relative;
          width: 80vw;
          height: 80vh;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
        }
        .close-button {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: #fff;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          z-index: 1;
        }
        .splat-container {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default GaussianSplatModal;