import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { LumaSplatsThree } from "@lumaai/luma-web";

interface LumaSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LumaSplatModal: React.FC<LumaSplatModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // We'll store references to Three.js objects so we can dispose them on unmount
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const splatsRef = useRef<LumaSplatsThree | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Create basic Three.js setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("white");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // 2. Create Luma Splat object
    const splats = new LumaSplatsThree({
      source: "https://lumalabs.ai/capture/F1A8381A-AF0A-4F78-A0C1-DF4D430A950D",
      enableThreeShaderIntegration: false, // simpler, faster route
      particleRevealEnabled: true,
    });
    scene.add(splats);
    splatsRef.current = splats;

    // Rotate the model 45 degrees around the X-axis (adjust sign if needed).
    splats.rotation.x = -Math.PI / 4; // -45 degrees

    // 2a. Use the initial camera transform from the Luma file
    splats.onInitialCameraTransform = (transform) => {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      transform.decompose(position, quaternion, scale);
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      // scale can be used if you want to adjust camera distance
    };

    // 3. Add a plane with the text "Hong Kong"
    const textPlane = createTextPlane("Hong Kong");
    scene.add(textPlane);

    // 4. Start render loop
    let isCancelled = false;
    const animate = () => {
      if (isCancelled) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
    const onResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    // Cleanup on unmount or modal close
    return () => {
      isCancelled = true;
      window.removeEventListener("resize", onResize);

      // Dispose Luma splats
      if (splatsRef.current) {
        splatsRef.current.dispose();
        splatsRef.current = null;
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      // Clear scene
      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else if (obj.material) {
              obj.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
    };
  }, [isOpen]);

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

/** Helper: Creates a plane geometry with text that says `Hong Kong`. */
function createTextPlane(text: string): THREE.Mesh {
  // 1. Create a canvas and draw text on it
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 1024;
  canvas.height = 512;

  // Transparent background
  ctx.fillStyle = "rgba(255, 255, 255, 0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  ctx.fillStyle = "white";
  ctx.font = "200px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";

  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  // 2. Create plane geometry & material
  const geometry = new THREE.PlaneGeometry(5, 2.5);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.1,
    emissive: "white",
    emissiveIntensity: 2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // position & rotate as desired
  mesh.position.set(0.8, -0.9, 0);
  mesh.rotation.y = Math.PI / 2;
  mesh.scale.setScalar(0.6);

  return mesh;
}

export default LumaSplatModal;
