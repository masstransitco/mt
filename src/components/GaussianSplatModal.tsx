import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { PMREMGenerator } from 'three/src/extras/PMREMGenerator.js';

interface GaussianSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GaussianSplatModal: React.FC<GaussianSplatModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);

  const initScene = useCallback(async () => {
    if (!mountRef.current) return;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Optional: Load environment map (HDR) for reflections
    try {
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();

      const hdrLoader = new RGBELoader();
      // If you have an HDR file, load it here:
      // const hdrTexture = await hdrLoader.loadAsync("path/to/environment.hdr");
      // const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      // scene.environment = envMap;
      // pmremGenerator.dispose();
    } catch (err) {
      console.warn("Failed to load HDR environment:", err);
    }

    // Load your .ply file from Firebase
    // Replace with your actual Firebase PLY URL
    const firebasePlyURL =
      "https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=cc4b8455-d5ee-49a0-81c7-5f2bb0081119";

    const plyLoader = new PLYLoader();
    plyLoader.load(
      firebasePlyURL,
      (geometry) => {
        // If no color attribute, assign default white
        if (!geometry.hasAttribute("color")) {
          const numVertices = geometry.attributes.position.count;
          const colors = new Float32Array(numVertices * 3);
          for (let i = 0; i < numVertices; i++) {
            colors[i * 3 + 0] = 1.0;
            colors[i * 3 + 1] = 1.0;
            colors[i * 3 + 2] = 1.0;
          }
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        }

        // Compute normals for basic lighting if desired
        geometry.computeVertexNormals();

        // Base plane geometry for each splat
        const baseGeometry = new THREE.PlaneGeometry(1, 1);

        // Simple shader material example
        const material = new THREE.ShaderMaterial({
          uniforms: {
            // If you set an env map above, reference it here
            envMap: { value: scene.environment },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
              vec3 newPosition = position;
              vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
              vPosition = mvPosition.xyz;
              vNormal = normalMatrix * normal;
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform samplerCube envMap;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
              vec3 N = normalize(vNormal);
              // cameraPosition is built-in in Three.js
              vec3 V = normalize(cameraPosition - vPosition);
              vec3 R = reflect(-V, N);

              // Always sample the envMap
              vec3 envColor = textureCube(envMap, R).rgb;

              vec3 baseColor = vec3(1.0);
              vec3 color = mix(baseColor, envColor, 0.5);

              gl_FragColor = vec4(color, 1.0);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });

        // Create an instanced mesh
        const numInstances = geometry.attributes.position.count;
        const instancedMesh = new THREE.InstancedMesh(baseGeometry, material, numInstances);

        // Position & scale each point
        const dummy = new THREE.Object3D();
        const splatScale = 0.05;

        for (let i = 0; i < numInstances; i++) {
          dummy.position.set(
            geometry.attributes.position.getX(i),
            geometry.attributes.position.getY(i),
            geometry.attributes.position.getZ(i)
          );
          // Make each quad face the camera
          dummy.lookAt(camera.position);
          dummy.scale.set(splatScale, splatScale, splatScale);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        scene.add(instancedMesh);

        setLoading(false);
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (err) => {
        console.error("Error loading PLY from Firebase:", err);
        setLoading(false);
      }
    );
  }, []);

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current)
      return;
    requestIdRef.current = requestAnimationFrame(animate);
    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  // Initialize scene once the modal is open
  useEffect(() => {
    if (!isOpen) return; // Only init when modal is open

    initScene();
    return () => {
      // Cleanup on unmount or close
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (requestIdRef.current) {
        cancelAnimationFrame(requestIdRef.current);
        requestIdRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat) => mat.dispose());
            } else if (obj.material instanceof THREE.Material) {
              obj.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
    };
  }, [initScene, isOpen]);

  // Start rendering once everything is ready
  useEffect(() => {
    if (!isOpen) return;
    const startRendering = () => {
      if (!requestIdRef.current) {
        animate();
      }
    };
    startRendering();
  }, [isOpen, animate]);

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

  // If modal is not open, don't render anything
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    >
      {loading && (
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
          Loading Splat...
        </div>
      )}
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
