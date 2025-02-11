// GaussianSplatModal.tsx
import React, { useEffect, useRef } from 'react';
import { Viewer } from 'gle-gaussian-splat-3d';
import * as THREE from 'three';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
  splatUrl: string;
}

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
  splatUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (isOpen && containerRef.current && !viewerRef.current) {
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      const camera = new THREE.PerspectiveCamera(
        65,
        window.innerWidth / window.innerHeight,
        0.1,
        500
      );
      
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      const viewer = new Viewer({
        renderer,
        camera,
        gpuAcceleratedSort: true,
        useBuiltInControls: true,
        selfDrivenMode: true,
        backgroundColor: new THREE.Color(0x151515),
      });

      viewerRef.current = viewer;
      containerRef.current.appendChild(renderer.domElement);

      // Load the splat file
      viewer.addSplatScene(splatUrl, {
        splatAlphaRemovalThreshold: 5,
        showLoadingSpinner: true,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      });

      viewer.start();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
    };
  }, [isOpen, splatUrl]);

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
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          position: relative;
          width: 90vw;
          height: 90vh;
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
          color: white;
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
