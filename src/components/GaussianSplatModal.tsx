import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Original Firebase URL that we'll pass through the proxy
const FIREBASE_URL = 
  'https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.splat?alt=media&token=fe72cbcf-4a26-42b4-b307-211fe431f641';

// Create the proxied URL
const PROXIED_PLY_URL = `/api/splat?url=${encodeURIComponent(FIREBASE_URL)}`;

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GaussianSplats3D.Viewer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const containerEl = containerRef.current;
    const renderWidth = containerEl.clientWidth;
    const renderHeight = containerEl.clientHeight;

    setIsLoading(true);
    setError(null);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    rendererRef.current = renderer;
    renderer.setSize(renderWidth, renderHeight);
    containerEl.appendChild(renderer.domElement);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(65, renderWidth / renderHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Configure viewer
    const viewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      renderer,
      camera,
      useBuiltInControls: true,
      ignoreDevicePixelRatio: true,
      gpuAcceleratedSort: true,
      sharedMemoryForWorkers: true,
      integerBasedSort: true,
      halfPrecisionCovariancesOnGPU: true,
      dynamicScene: false,
      webXRMode: GaussianSplats3D.WebXRMode.None,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Progressive,
      antialiased: true,
      focalAdjustment: 0.33,
      logLevel: GaussianSplats3D.LogLevel.Debug,
      splatAlphaRemovalThreshold: 1,
      skipLoaderChecks: true,
      initialScale: 1.0,
      initialPosition: new THREE.Vector3(0, 0, 0),
      initialRotation: new THREE.Euler(Math.PI, 0, 0)
    });
    viewerRef.current = viewer;

    // Load scene through proxy
    const loadScene = async () => {
      try {
        // First verify the proxy endpoint is accessible
        const checkResponse = await fetch(PROXIED_PLY_URL, { method: 'HEAD' });
        if (!checkResponse.ok) {
          throw new Error(`Failed to access proxy: ${checkResponse.statusText}`);
        }

        // Load the scene through the proxy
        await viewer.addSplatScene(PROXIED_PLY_URL);

        // Start render loop
        const update = () => {
          if (viewerRef.current) {
            viewerRef.current.update();
            requestAnimationFrame(update);
          }
        };
        requestAnimationFrame(update);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to load splat scene:', err);
        setError(
          'Failed to load the 3D scene. Please try again later.'
        );
        setIsLoading(false);
      }
    };

    loadScene();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !viewerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Clear the viewer reference
      viewerRef.current = null;
      
      // Dispose of the renderer and remove canvas
      if (rendererRef.current) {
        rendererRef.current.dispose();
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
        <button className="close-button" onClick={onClose}>
          ×
        </button>
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
              <button onClick={onClose}>Close</button>
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
