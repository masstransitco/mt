import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIREBASE_URL = 
  'https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.splat?alt=media&token=fe72cbcf-4a26-42b4-b307-211fe431f641';

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    setIsLoading(true);
    setError(null);

    const containerEl = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    containerEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(65, containerEl.clientWidth / containerEl.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const viewer = new GaussianSplats3D.Viewer({
      renderer,
      camera,
      useBuiltInControls: true,
      selfDrivenMode: true,
      gpuAcceleratedSort: true,
      antialiased: true,
      maxSplatCount: 500000,
      initialPointSize: 10,  // Added to help with initial visibility
      shaderMode: 'highQuality', // Added to ensure best rendering
    });
    viewerRef.current = viewer;

    const loadScene = async () => {
      try {
        console.log('Starting to load scene...');
        
        // Fetch raw data
        const response = await fetch(FIREBASE_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        // Get the data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        console.log('Received buffer size:', arrayBuffer.byteLength);
        
        // Create file-like object
        const file = new File([arrayBuffer], 'scene.splat', {
          type: 'application/octet-stream'
        });
        
        // Create object URL
        const url = URL.createObjectURL(file);
        console.log('Created URL:', url);
        
        // Load the scene
        await viewer.addSplatScene(url);
        console.log('Scene loaded successfully');
        
        // Clean up
        URL.revokeObjectURL(url);

        setIsLoading(false);

        // Start render loop
        const animate = () => {
          if (viewerRef.current && isOpen) {
            viewerRef.current.update();
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };
        animate();

      } catch (err: any) {
        console.error('Failed to load splat scene:', err);
        setError(`Failed to load the 3D scene: ${err.message}`);
        setIsLoading(false);
      }
    };

    loadScene();

    const handleResize = () => {
      if (!containerRef.current || !viewerRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      rendererRef.current.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (viewerRef.current) {
        // Clean up viewer
        viewerRef.current = null;
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        if (rendererRef.current.domElement.parentElement) {
          rendererRef.current.domElement.parentElement.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>×</button>
        <div ref={containerRef} className="splat-container">
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner" />
              <p>Loading 3D Scene...</p>
            </div>
          )}
          {error && (
            <div className="error-overlay">
              <p>{error}</p>
              <button onClick={onClose} className="bg-white text-black px-4 py-2 rounded mt-4 hover:bg-gray-200">
                Close
              </button>
            </div>
          )}
        </div>
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
        .loading-overlay, .error-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.8);
          color: white;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GaussianSplatModal;
