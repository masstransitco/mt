import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { PMREMGenerator } from 'three/src/extras/PMREMGenerator.js';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BATCH_SIZE = 10000; // Number of points to process in each batch
const POINT_SIZE = 0.02; // Adjust based on your scene scale

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const requestIdRef = useRef<number | null>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);

  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    // Create renderer with alpha and better precision
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      precision: "highp"
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);
    sceneRef.current = scene;

    // Create camera with better near/far planes
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;

    // Optimize OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
    controls.panSpeed = 0.5;
    controlsRef.current = controls;

    // Create initial empty points system
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: POINT_SIZE,
      vertexColors: true,
      sizeAttenuation: true,
    });
    
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;
  }, []);

  const processPointsBatch = useCallback((
    geometry: THREE.BufferGeometry,
    startIdx: number,
    endIdx: number,
    positions: Float32Array,
    colors: Float32Array,
    totalPoints: number
  ) => {
    if (!pointsRef.current) return;

    const batchPositions = positions.slice(startIdx * 3, endIdx * 3);
    const batchColors = colors.slice(startIdx * 3, endIdx * 3);

    const positionAttribute = new THREE.Float32BufferAttribute(batchPositions, 3);
    const colorAttribute = new THREE.Float32BufferAttribute(batchColors, 3);

    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    
    // Update loading progress
    setLoadingProgress((endIdx / totalPoints) * 100);
    
    // Force geometry update
    geometry.computeBoundingSphere();
    pointsRef.current.geometry = geometry;
  }, []);

  const loadPLY = useCallback(async () => {
    if (!sceneRef.current) return;

    const firebasePlyURL = "https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=cc4b8455-d5ee-49a0-81c7-5f2bb0081119";

    const plyLoader = new PLYLoader();
    
    try {
      const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
        plyLoader.load(firebasePlyURL,
          (geometry) => resolve(geometry),
          (xhr) => {
            console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
          },
          reject
        );
      });

      const positions = geometry.attributes.position.array as Float32Array;
      const colors = geometry.hasAttribute('color') 
        ? geometry.attributes.color.array as Float32Array
        : new Float32Array(positions.length).fill(1.0);

      const totalPoints = positions.length / 3;
      
      // Process points in batches
      for (let i = 0; i < totalPoints; i += BATCH_SIZE) {
        const endIdx = Math.min(i + BATCH_SIZE, totalPoints);
        processPointsBatch(
          new THREE.BufferGeometry(),
          i,
          endIdx,
          positions,
          colors,
          totalPoints
        );
        // Allow render thread to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }

    } catch (err) {
      console.error("Error loading PLY:", err);
    }
  }, [processPointsBatch]);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;
    
    requestIdRef.current = requestAnimationFrame(animate);
    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    initScene();
    loadPLY();
    animate();

    return () => {
      if (requestIdRef.current) {
        cancelAnimationFrame(requestIdRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
        (pointsRef.current.material as THREE.Material).dispose();
      }
    };
  }, [isOpen, initScene, loadPLY, animate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50">
      <div className="absolute top-5 right-5 z-10 text-white">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded hover:bg-white/20"
        >
          Close
        </button>
      </div>
      {loadingProgress < 100 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xl">
          Loading: {Math.round(loadingProgress)}%
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};

export default GaussianSplatModal;
