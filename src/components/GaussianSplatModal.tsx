import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
// Three.js Examples imports
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { PMREMGenerator } from "three/examples/jsm/pmrem/PMREMGenerator.js";

const SplatViewerModal = ({ onClose }) => {
  const mountRef = useRef(null); // Reference to the DOM container
  const [loading, setLoading] = useState(true);

  // We'll store renderer, scene, camera, controls as refs so we can clean up
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationIdRef = useRef(null);

  const initScene = useCallback(async () => {
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

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Optional: Load an HDR environment map for reflections
    // (Remove or modify if you don't have an HDR file)
    const pmremGenerator = new PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Example environment map load (omit if you don’t have one):
    try {
      const hdrLoader = new RGBELoader();
      // Replace with your actual .hdr file path (or remove this block if you don't need environment lighting)
      const hdrMap = await hdrLoader.loadAsync(
        "path/to/environment.hdr"
      );
      const envMap = pmremGenerator.fromEquirectangular(hdrMap).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();
    } catch (err) {
      console.warn("Failed to load environment HDR:", err);
    }

    // Load the PLY file from Firebase
    // Replace with your actual Firebase URL:
    const plyUrl =
      "https://firebasestorage.googleapis.com/v0/b/masstransitcompany.firebasestorage.app/o/icc.ply?alt=media&token=cc4b8455-d5ee-49a0-81c7-5f2bb0081119";

    const plyLoader = new PLYLoader();
    plyLoader.load(
      plyUrl,
      (geometry) => {
        if (!geometry.hasAttribute("color")) {
          // Provide a default color if the PLY has no color attribute
          const numVertices = geometry.attributes.position.count;
          const colors = new Float32Array(numVertices * 3);
          for (let i = 0; i < numVertices; i++) {
            colors[i * 3 + 0] = 1.0;
            colors[i * 3 + 1] = 1.0;
            colors[i * 3 + 2] = 1.0;
          }
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        }

        // Compute normals for basic lighting (if needed)
        geometry.computeVertexNormals();

        // Create base plane geometry for each splat
        const baseGeometry = new THREE.PlaneBufferGeometry(1, 1);

        // Simple shader material example
        const material = new THREE.ShaderMaterial({
          uniforms: {
            envMap: { value: scene.environment },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
              // Billboard transformation in the vertex shader 
              // (For more advanced usage, you might add an instancePosition attribute.)
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
              // We can access cameraPosition directly (built-in in Three.js)
              vec3 N = normalize(vNormal);
              vec3 V = normalize(cameraPosition - vPosition);
              vec3 R = reflect(-V, N);
              
              // Basic reflection from the envMap
              vec3 envColor = vec3(0.0);
              if (envMap != null) {
                envColor = textureCube(envMap, R).rgb;
              }

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
        const instancedMesh = new THREE.InstancedMesh(
          baseGeometry,
          material,
          numInstances
        );

        // Set up instance transforms
        const dummy = new THREE.Object3D();
        const splatScale = 0.05;

        for (let i = 0; i < numInstances; i++) {
          dummy.position.set(
            geometry.attributes.position.getX(i),
            geometry.attributes.position.getY(i),
            geometry.attributes.position.getZ(i)
          );
          dummy.lookAt(camera.position);
          dummy.scale.set(splatScale, splatScale, splatScale);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        scene.add(instancedMesh);

        // Hide loading overlay
        setLoading(false);
      },
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error("Error loading PLY from Firebase:", error);
        setLoading(false);
      }
    );
  }, []);

  // ** Initialize scene once on component mount
  useEffect(() => {
    initScene();

    // Cleanup on unmount
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [initScene]);

  // ** Animation loop
  const animate = useCallback(() => {
    animationIdRef.current = requestAnimationFrame(animate);

    if (!rendererRef.current || !cameraRef.current || !sceneRef.current || !controlsRef.current) return;

    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  // ** Start animation once the scene is ready
  useEffect(() => {
    // Start rendering
    animate();
  }, [animate]);

  // ** Resize handling
  useEffect(() => {
    function handleResize() {
      if (!cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
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
          Loading...
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

export default SplatViewerModal;
