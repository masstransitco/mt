import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Adjust these as needed
const BATCH_SIZE = 20000;
const POINT_SIZE = 0.02;

// Direct link to your *compressed* PLY file in Firebase:
const PLY_FILE_URL =
  "https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.splat?alt=media&token=fe72cbcf-4a26-42b4-b307-211fe431f641";

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);

  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /** Initialize an empty scene on mount */
  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      precision: "highp",
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
    controls.panSpeed = 0.5;
    controlsRef.current = controls;

    // Create an empty geometry + points
    const emptyGeo = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: POINT_SIZE,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(emptyGeo, material);
    scene.add(points);
    pointsRef.current = points;
  }, []);

  /**
   * Fetch the PLY file in streaming mode.
   * Show incremental progress from 0..100 (if content-length is available).
   */
  const fetchPlyFile = useCallback(async (url: string): Promise<ArrayBuffer> => {
    setIsLoading(true);
    setProgress(0);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const contentLengthStr = response.headers.get("content-length") || "0";
    const total = parseInt(contentLengthStr, 10) || 0;

    const chunks: Uint8Array[] = [];
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No readable stream from fetch.");
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        if (total > 0) {
          setProgress(Math.floor((loaded / total) * 100));
        } else {
          // If total is unknown, you might just show loaded KB, etc.
          setProgress(Math.floor(loaded / 1024)); 
        }
      }
    }

    // Combine into a single ArrayBuffer
    const combined = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  }, []);

  /**
   * Use Three.js PLYLoader to parse the full ArrayBuffer into a BufferGeometry.
   */
  const parsePLY = useCallback((data: ArrayBuffer): THREE.BufferGeometry => {
    const loader = new PLYLoader();
    const geometry = loader.parse(data);
    return geometry;
  }, []);

  /**
   * Convert the geometry's position/color data into a final Points geometry,
   * in batches so you see partial updates (optional).
   */
  const addGeometryInBatches = useCallback(
    (finalGeo: THREE.BufferGeometry) => {
      if (!pointsRef.current) return;

      // If there's a color attribute, check if it's 0..255
      if (finalGeo.hasAttribute("color")) {
        const colorAttr = finalGeo.getAttribute("color");
        // If it's stored as Uint8, we set normalized = true
        if (colorAttr.array instanceof Uint8Array && !colorAttr.normalized) {
          const asUint8 = colorAttr.array as Uint8Array;
          finalGeo.setAttribute(
            "color",
            new THREE.Uint8BufferAttribute(asUint8, colorAttr.itemSize, true)
          );
        }
      } else {
        // Assign white if no color
        const positions = finalGeo.getAttribute("position");
        const count = positions.count;
        const white = new Uint8Array(count * 3).fill(255);
        finalGeo.setAttribute(
          "color",
          new THREE.Uint8BufferAttribute(white, 3, true)
        );
      }

      const posAttr = finalGeo.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = finalGeo.getAttribute("color") as THREE.BufferAttribute;
      const totalPoints = posAttr.count;

      // Prepare a new geometry for our Points
      const mergedGeometry = new THREE.BufferGeometry();
      const mergedPositions = new Float32Array(totalPoints * 3);
      const mergedColors = new Uint8Array(totalPoints * 3); // normalized in GPU

      const positionAttrFinal = new THREE.BufferAttribute(mergedPositions, 3);
      const colorAttrFinal = new THREE.Uint8BufferAttribute(mergedColors, 3, true);

      mergedGeometry.setAttribute("position", positionAttrFinal);
      mergedGeometry.setAttribute("color", colorAttrFinal);

      // Copy data in small batches so we can see partial updates
      let currentIndex = 0;
      const copyBatch = () => {
        if (!pointsRef.current) return;
        if (currentIndex >= totalPoints) {
          mergedGeometry.computeBoundingSphere();
          pointsRef.current.geometry = mergedGeometry;
          setIsLoading(false);
          return;
        }

        const endIndex = Math.min(currentIndex + BATCH_SIZE, totalPoints);

        // Positions (final file data might be Float32Array)
        const srcPos = posAttr.array as Float32Array;
        mergedPositions.set(
          srcPos.subarray(currentIndex * 3, endIndex * 3),
          currentIndex * 3
        );

        // Colors 
        const srcColor = colAttr.array;
        if (srcColor instanceof Uint8Array) {
          // directly copy
          mergedColors.set(
            srcColor.subarray(currentIndex * 3, endIndex * 3),
            currentIndex * 3
          );
        } else if (srcColor instanceof Float32Array) {
          // convert float [0..1 or 0..255?] to byte
          for (let i = currentIndex * 3; i < endIndex * 3; i++) {
            mergedColors[i] = Math.min(255, Math.max(0, srcColor[i] * 255));
          }
        }

        currentIndex = endIndex;

        positionAttrFinal.needsUpdate = true;
        colorAttrFinal.needsUpdate = true;
        mergedGeometry.computeBoundingSphere();
        pointsRef.current.geometry = mergedGeometry;

        requestAnimationFrame(copyBatch);
      };
      requestAnimationFrame(copyBatch);
    },
    []
  );

  /** Orchestrate the entire load + parse + batch-render pipeline */
  const loadPlyAndDisplay = useCallback(async () => {
    try {
      setIsLoading(true);
      setProgress(0);

      // 1) Download PLY file from Firebase (direct URL).
      const data = await fetchPlyFile(PLY_FILE_URL);

      // 2) Parse with PLYLoader
      const geometry = parsePLY(data);

      // 3) Progressive geometry update
      addGeometryInBatches(geometry);
    } catch (err) {
      console.error("Error loading PLY:", err);
      setIsLoading(false);
    }
  }, [fetchPlyFile, parsePLY, addGeometryInBatches]);

  // Animation loop
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
      return;
    }
    let stopped = false;
    const animate = () => {
      if (stopped) return;
      requestAnimationFrame(animate);
      controlsRef.current!.update();
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
    };
    animate();
    return () => {
      stopped = true;
    };
  }, []);

  // On open, set up scene and load
  useEffect(() => {
    if (!isOpen) return;

    initScene();
    loadPlyAndDisplay();

    return () => {
      // Cleanup
      setIsLoading(false);
      setProgress(0);

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
        if (Array.isArray(pointsRef.current.material)) {
          pointsRef.current.material.forEach((mat) => mat.dispose());
        } else {
          (pointsRef.current.material as THREE.Material).dispose();
        }
        pointsRef.current = null;
      }

      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }
    };
  }, [isOpen, initScene, loadPlyAndDisplay]);

  // Handle resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1001,
          padding: "8px 16px",
          background: "rgba(255, 255, 255, 0.1)",
          color: "#fff",
          border: "1px solid #fff",
          cursor: "pointer",
        }}
      >
        Close
      </button>

      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            color: "#fff",
            transform: "translate(-50%, -50%)",
            fontSize: 20,
            zIndex: 1000,
          }}
        >
          Loading... {progress}%
        </div>
      )}

      <div
        ref={mountRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
};

export default GaussianSplatModal;
