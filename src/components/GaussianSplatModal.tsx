import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { LumaSplatsThree } from "@lumaai/luma-web";
// Import the Lucide "X" icon. Use the correct import for your setup.
import { X } from "lucide-react"; // or from "react-lucide"

interface LumaSplatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LumaSplatModal: React.FC<LumaSplatModalProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const splatsRef = useRef<LumaSplatsThree | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Basic Three.js setup
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

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // 2. Create Luma Splat object
    const splats = new LumaSplatsThree({
      source: "https://lumalabs.ai/capture/F1A8381A-AF0A-4F78-A0C1-DF4D430A950D",
      enableThreeShaderIntegration: false,
      particleRevealEnabled: true,
    });
    scene.add(splats);
    splatsRef.current = splats;

    // Rotate/Position config for later:
    splats.rotation.set(0, 0, 0);
    splats.position.set(0, 0, 0);

    // 2b. Luma’s initial camera transform – optional
    splats.onInitialCameraTransform = (transform) => {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      transform.decompose(position, quaternion, scale);
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
    };

    // 3. Add a plane with the text "Hong Kong" (rot/pos all zero for now)
    const textPlane = createTextPlane("Hong Kong");
    textPlane.position.set(0, 0, 0);
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

      if (splatsRef.current) {
        splatsRef.current.dispose();
        splatsRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
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

  // Circular close button with a Lucide "X" icon
  const closeButtonStyle: React.CSSProperties = {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1001,
    width: 40,
    height: 40,
    borderRadius: "50%",
    // Dark theme background (adjust to your preference)
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "#fff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        zIndex: 9999,
      }}
    >
      <button onClick={onClose} style={closeButtonStyle}>
        <X size={20} />
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
function createTextPlane(): THREE.Mesh {
  // 1. Create a canvas and draw text on it
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 1024;
  canvas.height = 512;

  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Title: "ICC", 70% of 200px -> 140px
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 5;
  ctx.font = "140px Helvetica"; // or "Helvetica, sans-serif"

  // Center of canvas
  const centerX = canvas.width / 2;
  let centerY = canvas.height / 2;

  // Draw "ICC"
  ctx.fillText("ICC", centerX, centerY);
  ctx.strokeText("ICC", centerX, centerY);

  // Subtitle: "1 Austin Road", 50% of 140px -> 70px
  ctx.font = "70px Helvetica";
  centerY += 100; // move down to avoid overlapping, tweak as needed
  ctx.fillText("1 Austin Road", centerX, centerY);
  ctx.strokeText("1 Austin Road", centerX, centerY);

  // 2. Create a texture from the canvas
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  // 3. Plane geometry & material
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
  mesh.scale.setScalar(0.6);
  return mesh;
}

export default LumaSplatModal;
