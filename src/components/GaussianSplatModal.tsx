import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { PMREMGenerator } from "three/src/extras/PMREMGenerator.js";

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BATCH_SIZE = 20000; // How many points to add per frame
const POINT_SIZE = 0.02;

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);

  // UI states
  const [progress, setProgress] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize THREE scene once
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

    // Create an *empty* geometry + points
    const emptyGeo = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: POINT_SIZE,
      vertexColors: true, // must be true to see per-vertex color
      sizeAttenuation: true,
    });
    const points = new THREE.Points(emptyGeo, material);
    scene.add(points);
    pointsRef.current = points;
  }, []);

  // Progressive load: read .ply via streaming fetch
  const fetchPlyFile = useCallback(
    async (fileUrl: string) => {
      setIsLoading(true);
      setProgress(0);

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const contentLengthStr = response.headers.get("content-length") || "0";
      const total = parseInt(contentLengthStr, 10) || 0;

      // We'll accumulate all chunks in a dynamic array
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response reader available");
      }

      // Read the stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          if (total) {
            setProgress(Math.floor((loaded / total) * 100));
          } else {
            // If total is unknown, just approximate or show loaded bytes
            setProgress(Math.floor(loaded / 1024)); // show KB
          }
        }
      }

      // Combine into single ArrayBuffer
      let combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return combined.buffer; // The ArrayBuffer
    },
    []
  );

  // Parse the loaded arrayBuffer with PLYLoader
  const parseGeometry = useCallback(async (data: ArrayBuffer) => {
    const plyLoader = new PLYLoader();
    // The parse method is sync, but let's wrap in a promise
    const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
      try {
        const geom = plyLoader.parse(data);
        resolve(geom);
      } catch (e) {
        reject(e);
      }
    });
    return geometry;
  }, []);

  // After we parse the geometry, add to the existing Points object in batches
  const addGeometryInBatches = useCallback(
    async (finalGeo: THREE.BufferGeometry) => {
      if (!pointsRef.current) return;

      // Check if color attribute is in bytes or floats
      if (finalGeo.hasAttribute("color")) {
        const colorAttr = finalGeo.getAttribute("color");
        // If your PLY color is stored as 0..255, then the type is likely Uint8Array
        if (colorAttr.array instanceof Uint8Array && !colorAttr.normalized) {
          // Convert to normalized attribute
          const asUint8 = colorAttr.array as Uint8Array;
          const itemSize = colorAttr.itemSize; // usually 3 or 4
          finalGeo.setAttribute(
            "color",
            new THREE.Uint8BufferAttribute(asUint8, itemSize, true /* normalized */)
          );
        }
      } else {
        // If no color, assign white
        const positionAttr = finalGeo.getAttribute("position");
        const count = positionAttr.count;
        const white = new Uint8Array(count * 3).fill(255);
        finalGeo.setAttribute(
          "color",
          new THREE.Uint8BufferAttribute(white, 3, true)
        );
      }

      const posAttr = finalGeo.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = finalGeo.getAttribute("color") as THREE.BufferAttribute;
      const totalPoints = posAttr.count;

      // We'll create a new typed array for a "batch geometry"
      // or simply reuse the same Points's geometry, appending in chunks.
      const finalPositions = posAttr.array as Float32Array | Uint32Array | Int32Array;
      // Because we re-wrote color as a Uint8BufferAttribute (normalized),
      // internally that .array might still be a Uint8Array.
      // But to do partial copy, we can interpret them carefully.

      // For progressive rendering, let's create a bigger geometry 
      // with the full size, then fill it piece by piece.
      const mergedGeometry = new THREE.BufferGeometry();
      // We'll allocate final typed arrays
      const mergedPositions = new Float32Array(totalPoints * 3);
      // For color, we must keep it as a Uint8Array if we want hardware normalization
      // or we can convert to float [0..1]. We'll do hardware normalization:
      const mergedColors = new Uint8Array(totalPoints * 3);

      // Actually create the BufferAttributes for the final geometry
      const positionAttrFinal = new THREE.BufferAttribute(mergedPositions, 3);
      // For color, use Uint8BufferAttribute (normalized)
      const colorAttrFinal = new THREE.Uint8BufferAttribute(mergedColors, 3, true);

      mergedGeometry.setAttribute("position", positionAttrFinal);
      mergedGeometry.setAttribute("color", colorAttrFinal);

      // We do a function that copies chunk from finalGeo arrays to merged arrays
      let currentIndex = 0;
      const addBatch = () => {
        if (currentIndex >= totalPoints) {
          // Done
          mergedGeometry.computeBoundingSphere();
          pointsRef.current!.geometry = mergedGeometry;
          setIsLoading(false);
          return;
        }

        const endIndex = Math.min(currentIndex + BATCH_SIZE, totalPoints);
        // Copy positions
        if (finalPositions instanceof Float32Array) {
          // copy float -> float
          mergedPositions.set(
            finalPositions.subarray(currentIndex * 3, endIndex * 3),
            currentIndex * 3
          );
        } else {
          // If for some reason it's another typed array
          for (let i = currentIndex * 3; i < endIndex * 3; i++) {
            mergedPositions[i] = finalPositions[i];
          }
        }
        // Copy colors
        const originalColorArray = colAttr.array; // possibly a Uint8Array or Float32Array
        if (originalColorArray instanceof Uint8Array) {
          mergedColors.set(
            originalColorArray.subarray(currentIndex * 3, endIndex * 3),
            currentIndex * 3
          );
        } else if (originalColorArray instanceof Float32Array) {
          // If your PLY had float color
          for (let i = currentIndex * 3; i < endIndex * 3; i++) {
            // clamp or convert float -> byte
            mergedColors[i] = Math.min(255, Math.max(0, originalColorArray[i] * 255));
          }
        }

        currentIndex = endIndex;

        // Update the geometry so we can see partial updates
        positionAttrFinal.needsUpdate = true;
        colorAttrFinal.needsUpdate = true;
        mergedGeometry.computeBoundingSphere();
        pointsRef.current!.geometry = mergedGeometry;

        requestAnimationFrame(addBatch);
      };
      requestAnimationFrame(addBatch);
    },
    []
  );

  const loadAndParsePLY = useCallback(async () => {
    if (!sceneRef.current) return;
    try {
      setIsLoading(true);
      setProgress(0);

      // 1) FETCH via your Next.js proxy
      const url = "/api/splat?url=" + encodeURIComponent(
        "https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=cc4b8455-d5ee-49a0-81c7-5f2bb0081119"
      );
      const arrayBuffer = await fetchPlyFile(url);

      // 2) PARSE .ply data
      const geometry = await parseGeometry(arrayBuffer);

      // 3) BATCH ADD geometry to scene
      await addGeometryInBatches(geometry);

    } catch (err) {
      console.error("Error loading PLY:", err);
      setIsLoading(false);
    }
  }, [fetchPlyFile, parseGeometry, addGeometryInBatches]);

  // Animation loop
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;

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

  // Initialize on open
  useEffect(() => {
    if (!isOpen) return;
    initScene();
    loadAndParsePLY();

    // Cleanup on close
    return () => {
      setIsLoading(false);
      setProgress(0);

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
        if (Array.isArray(pointsRef.current.material)) {
          pointsRef.current.material.forEach((m) => m.dispose());
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
  }, [isOpen, initScene, loadAndParsePLY]);

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
