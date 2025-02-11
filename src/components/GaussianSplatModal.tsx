import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SplatLoader } from '@/lib/splat';

// Firebase storage URL for the splat file
const FIREBASE_SPLAT_URL = 'https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=1aa07b53-eb82-48fc-8441-fa386e172312';

interface GaussianSplatModalProps {
  onClose: () => void;
}

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = () => {
      if (!containerRef.current) return;

      // Initialize Scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(0x000000);

      // Initialize Camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      cameraRef.current = camera;
      camera.position.z = 5;

      // Initialize Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current = renderer;
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);

      // Initialize Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;
    };

    const loadSplat = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Create a new SplatLoader instance
        const splatLoader = new SplatLoader();
        
        // Fetch the splat file from Firebase Storage
        const response = await fetch(FIREBASE_SPLAT_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch splat file: ${response.statusText}`);
        }
        
        const splatBuffer = await response.arrayBuffer();
        
        // Load the splat data
        await splatLoader.load(splatBuffer);
        
        // Get the splat scene
        const splatScene = splatLoader.getSplatScene();
        
        if (mounted && sceneRef.current && splatScene) {
          // Add the splat scene to the Three.js scene
          sceneRef.current.add(splatScene);
          
          // Center the camera on the splat scene
          const box = new THREE.Box3().setFromObject(splatScene);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          if (cameraRef.current && controlsRef.current) {
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = cameraRef.current.fov * (Math.PI / 180);
            const cameraDistance = Math.abs(maxDim / Math.sin(fov / 2) / 2);
            
            cameraRef.current.position.copy(center);
            cameraRef.current.position.z += cameraDistance;
            cameraRef.current.lookAt(center);
            
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading splat:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load splat file');
          setIsLoading(false);
        }
      }
    };

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
    };

    init();
    loadSplat();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      // Clean up any materials, geometries, or textures
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material) => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });
      }
    };
  }, []); // No url dependency anymore since we're using constant

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="relative w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-lg">Loading splat...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-500 text-lg bg-black bg-opacity-75 p-4 rounded">
              Error: {error}
            </div>
          </div>
        )}
        
        <div ref={containerRef} className="w-full h-full" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default GaussianSplatModal;