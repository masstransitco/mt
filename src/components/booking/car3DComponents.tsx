"use client"

import { useRef, useEffect, memo, useState } from "react"
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Preload, Text } from '@react-three/drei'
import * as THREE from 'three'

// Import modelManager - will have its own browser checks
import ModelManager from '@/lib/modelManager'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Simple car park floor
const CarParkFloor = memo(() => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
    <planeGeometry args={[12, 12]} />
    <meshPhongMaterial color="#232323" shininess={5} specular="#333333" />
  </mesh>
))
CarParkFloor.displayName = "CarParkFloor"

// Refined layout with multiple parking bays
const ParkingSpots = memo(() => {
  return (
    <group position={[0, -0.245, 0]}>
      {/* Left boundary line */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-2.4, 0, 0]}>
        <planeGeometry args={[4, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Right boundary line */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[2.4, 0, 0]}>
        <planeGeometry args={[4, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Front boundary line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
        <planeGeometry args={[4.8, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Back boundary line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]}>
        <planeGeometry args={[4.8, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Middle divider line (creating two parking bays) */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <planeGeometry args={[4, 0.1]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Parking spot number '830' near the front boundary */}
      <Text
        fontSize={0.3}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 1.8]} // slight lift to avoid z-fighting
        color="#FFFFFF"
        fillOpacity={0.9}
      >
        830
      </Text>
    </group>
  )
})
ParkingSpots.displayName = "ParkingSpots"

// Car park pillars
const CarParkPillars = memo(() => (
  <group>
    <mesh position={[-4, 1, -4]} castShadow>
      <boxGeometry args={[0.4, 2.5, 0.4]} />
      <meshPhongMaterial color="#BBBBBB" />
    </mesh>
    <mesh position={[4, 1, -4]} castShadow>
      <boxGeometry args={[0.4, 2.5, 0.4]} />
      <meshPhongMaterial color="#BBBBBB" />
    </mesh>
    <mesh position={[-4, 1, 4]} castShadow>
      <boxGeometry args={[0.4, 2.5, 0.4]} />
      <meshPhongMaterial color="#BBBBBB" />
    </mesh>
    <mesh position={[4, 1, 4]} castShadow>
      <boxGeometry args={[0.4, 2.5, 0.4]} />
      <meshPhongMaterial color="#BBBBBB" />
    </mesh>
  </group>
))
CarParkPillars.displayName = "CarParkPillars"

// Car park ceiling with lights
const CarParkCeiling = memo(() => (
  <group position={[0, 2.5, 0]}>
    {/* Main ceiling */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshPhongMaterial color="#2A2A2A" />
    </mesh>

    {/* Ceiling light strips */}
    <mesh position={[0, -0.1, -2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6, 0.3]} />
      <meshStandardMaterial color="#FFFFEE" emissive="#FFFFEE" emissiveIntensity={0.8} />
    </mesh>
    <mesh position={[0, -0.1, 2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6, 0.3]} />
      <meshStandardMaterial color="#FFFFEE" emissive="#FFFFEE" emissiveIntensity={0.8} />
    </mesh>
  </group>
))
CarParkCeiling.displayName = "CarParkCeiling"

// Simple fallback car model
const SimpleCarModel = memo(() => (
  <group rotation={[0, Math.PI / 2.2, 0]} position={[0, -0.2, 0]}>
    {/* Car body base */}
    <mesh position={[0, 0.2, 0]} castShadow>
      <boxGeometry args={[1.8, 0.4, 0.8]} />
      <meshPhongMaterial color="#333333" shininess={70} />
    </mesh>
    {/* Car cabin */}
    <mesh position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1, 0.3, 0.7]} />
      <meshPhongMaterial color="#222222" shininess={100} specular="#555555" />
    </mesh>
    {/* Windshield */}
    <mesh position={[0.3, 0.55, 0]} rotation={[0, 0, -0.2]}>
      <planeGeometry args={[0.4, 0.25]} />
      <meshPhongMaterial
        color="#6688aa"
        shininess={200}
        specular="#ffffff"
        transparent
        opacity={0.7}
      />
    </mesh>
    {/* Wheels */}
    <mesh position={[0.5, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.1, 12]} />
      <meshPhongMaterial color="#111111" shininess={30} />
    </mesh>
    <mesh position={[-0.5, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.1, 12]} />
      <meshPhongMaterial color="#111111" shininess={30} />
    </mesh>
    <mesh position={[0.5, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.1, 12]} />
      <meshPhongMaterial color="#111111" shininess={30} />
    </mesh>
    <mesh position={[-0.5, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.1, 12]} />
      <meshPhongMaterial color="#111111" shininess={30} />
    </mesh>
  </group>
))
SimpleCarModel.displayName = "SimpleCarModel"

// Enhanced car model loader
const CarModel = memo(({ url, interactive }: { url: string; interactive: boolean }) => {
  const [model, setModel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const loadTimeoutRef = useRef<any>(null)
  
  useEffect(() => {    
    // Set a timeout to ensure we don't get stuck in loading state
    loadTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn(`Model load taking too long: ${url}, forcing fallback`);
        setError(true);
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    try {
      // ModelManager has its own browser checks
      const modelManagerInstance = ModelManager.getInstance();
      if (!modelManagerInstance) {
        console.warn("No ModelManager instance available, using fallback");
        setError(true);
        setLoading(false);
        return;
      }
      
      let mounted = true

      modelManagerInstance
        .getModel(url)
        .then((loadedModel) => {
          if (!mounted) return;
          
          try {
            // Positioning
            loadedModel.rotation.y = Math.PI / 2;
            loadedModel.position.y = -0.2;

            // Premium vs. basic paint helper
            const createCarPaintMaterial = (baseColor: any) => {
              if (interactive) {
                return new THREE.MeshPhysicalMaterial({
                  color: baseColor,
                  metalness: 0.9,
                  roughness: 0.2,
                  clearcoat: 0.8,
                  clearcoatRoughness: 0.2,
                  reflectivity: 1.0,
                  envMapIntensity: 1.2,
                });
              } else {
                return new THREE.MeshPhongMaterial({
                  color: baseColor,
                  shininess: 100,
                  specular: new THREE.Color(0x888888),
                  reflectivity: 0.8,
                  flatShading: false,
                });
              }
            };

            // Traverse & assign materials - in a try-catch to handle any errors
            try {
              loadedModel.traverse((child: any) => {
                try {
                  // Safe type checking using instanceof
                  const isMesh = child.type === 'Mesh' || child instanceof THREE.Mesh;
                  
                  if (isMesh && child.material) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.name.includes("interior") || child.name.includes("hidden")) return;

                    // Safe material type checking
                    const isMeshStandardMaterial = 
                      child.material.type === 'MeshStandardMaterial' || 
                      child.material instanceof THREE.MeshStandardMaterial;
                    
                    const originalColor = isMeshStandardMaterial && child.material.color
                      ? child.material.color.clone()
                      : new THREE.Color(0x111111);

                    // Basic classification
                    if (child.name.includes("body") || child.name.includes("car") || child.name.includes("hood")) {
                      child.material = createCarPaintMaterial(originalColor);
                    } else if (child.name.includes("glass") || child.name.includes("window")) {
                      child.material = new THREE.MeshPhysicalMaterial({
                        color: new THREE.Color(0x88ccff),
                        metalness: 0.0,
                        roughness: 0.1,
                        transmission: 0.9,
                        transparent: true,
                        opacity: 0.7,
                      });
                    } else if (child.name.includes("wheel") || child.name.includes("tire")) {
                      child.material = new THREE.MeshPhongMaterial({
                        color: new THREE.Color(0x222222),
                        shininess: 30,
                        specular: new THREE.Color(0x333333),
                      });
                    } else if (child.name.includes("light") || child.name.includes("lamp")) {
                      child.material = new THREE.MeshPhongMaterial({
                        color: new THREE.Color(0xffffee),
                        shininess: 100,
                        specular: new THREE.Color(0xffffff),
                        emissive: new THREE.Color(0x333322),
                      });
                    } else {
                      // Everything else
                      if (!interactive) {
                        child.material = new THREE.MeshPhongMaterial({
                          color: originalColor,
                          shininess: 50,
                          specular: new THREE.Color(0x444444),
                        });
                      } else if (isMeshStandardMaterial) {
                        child.material.envMapIntensity = 0.8;
                        child.material.roughness = Math.min(child.material.roughness || 0.5, 0.3);
                        child.material.metalness = Math.max(child.material.metalness || 0, 0.5);
                      }
                    }
                  }
                } catch (childErr) {
                  console.warn(`Error processing child in model: ${child?.name || 'unknown'}`, childErr);
                }
              });
            } catch (traverseErr) {
              console.warn(`Error traversing model: ${url}`, traverseErr);
              // Continue anyway, model might still be partially usable
            }

            // Optional black-car highlight
            try {
              if (url.includes("defaultModel") || url.includes("car2")) {
                const highlightGeometry = new THREE.PlaneGeometry(1.4, 0.6);
                const highlightMaterial = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                  transparent: true,
                  opacity: 0.15,
                  blending: THREE.AdditiveBlending,
                });
                const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
                highlight.rotation.x = -Math.PI / 2;
                highlight.position.set(0, 0.65, 0);
                loadedModel.add(highlight);
              }
            } catch (highlightErr) {
              console.warn(`Could not add highlight to car: ${url}`, highlightErr);
              // Non-critical, continue
            }

            if (loadTimeoutRef.current) {
              clearTimeout(loadTimeoutRef.current);
              loadTimeoutRef.current = null;
            }
            
            setModel(loadedModel);
            setLoading(false);
          } catch (setupErr) {
            console.error(`Error setting up loaded model: ${url}`, setupErr);
            setError(true);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(`Failed to load model: ${url}`, err);
          setError(true);
          setLoading(false);
        });

      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
        mounted = false;
        try {
          modelManagerInstance.releaseModel(url);
        } catch (releaseErr) {
          console.warn(`Error releasing model: ${url}`, releaseErr);
        }
      };
    } catch (initErr) {
      console.error(`Error initializing model loading: ${url}`, initErr);
      setError(true);
      setLoading(false);
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      };
    }
  }, [url, interactive, loading]);

  if (loading || error) {
    return <SimpleCarModel />;
  }

  return model ? <primitive object={model} /> : <SimpleCarModel />;
})
CarModel.displayName = "CarModel"

// Car Park Scene
const CarParkScene = memo(({ interactive }: { interactive: boolean }) => {
  const showFullScene = interactive

  return (
    <>
      {/* Floor always visible */}
      <CarParkFloor />
      {/* Refined multi-bay markings */}
      <ParkingSpots />

      {/* Pillars/ceiling only if interactive */}
      {showFullScene && (
        <>
          <CarParkPillars />
          <CarParkCeiling />
        </>
      )}

      {/* Subtle reflection plane, now placed just under the car */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]} scale={[2.5, 4, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#FFFFFF"
          opacity={0.02}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  )
})
CarParkScene.displayName = "CarParkScene"

// Props interface
interface Car3DComponentsProps {
  modelUrl?: string
  width?: string | number
  height?: string | number
  isVisible?: boolean
  interactive?: boolean
  backgroundColor?: string
}

// Main optimized viewer implementation
function Car3DComponents({
  modelUrl = "/cars/defaultModel.glb",
  width = "100%",
  height = "100%",
  isVisible = true,
  interactive = false,
  backgroundColor = "transparent",
}: Car3DComponentsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (isVisible) {
      // ModelManager has its own browser checks
      try {
        const modelManager = ModelManager.getInstance();
        if (modelManager) {
          // Preload models in a safe way
          modelManager.preloadModels(["/cars/defaultModel.glb"]);
          // Remove the .catch() as preloadModels internally handles errors
        }
      } catch (err) {
        console.error("ModelManager initialization error:", err);
        // Continue with component rendering even if model manager fails
      }
    }

    // Single render in non-interactive mode
    if (!interactive && canvasRef.current) {
      const timeout = setTimeout(() => {
        try {
          const event = new CustomEvent("render");
          canvasRef.current?.dispatchEvent(event);
        } catch (err) {
          console.warn("Could not dispatch render event:", err);
        }
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [isVisible, interactive])

  if (!isVisible) return null

  return (
    <div
      className={`h-full w-full relative overflow-hidden ${interactive ? "isolate" : ""}`}
      style={{
        width,
        height,
        position: interactive ? "relative" : undefined,
        zIndex: interactive ? 10 : undefined,
      }}
      onPointerDown={interactive ? (e) => e.stopPropagation() : undefined}
      onTouchStart={interactive ? (e) => e.stopPropagation() : undefined}
      onTouchMove={interactive ? (e) => e.stopPropagation() : undefined}
      onPointerMove={interactive ? (e) => e.stopPropagation() : undefined}
      onClick={interactive ? (e) => e.stopPropagation() : undefined}
    >
      {interactive && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ touchAction: "none" }}
        />
      )}
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          depth: true,
          stencil: false,
          alpha: backgroundColor === "transparent",
        }}
        shadows={interactive}
        camera={{
          position: interactive ? [3, 2, 3] : [2.5, 1.6, 2.5],
          fov: interactive ? 25 : 20,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, interactive ? 2 : 1.5]}
        frameloop={interactive ? "always" : "demand"}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor,
          touchAction: "none",
          position: "relative",
          zIndex: 1,
        }}
        className="pointer-events-auto touch-none"
        onCreated={(state) => {
          if (backgroundColor === "transparent") {
            state.scene.background = null
          } else {
            state.scene.background = new THREE.Color(backgroundColor)
          }
          
          if (interactive) {
            state.gl.shadowMap.enabled = true
            state.gl.shadowMap.type = THREE.PCFSoftShadowMap
          }
          
          if (!interactive) {
            state.gl.render(state.scene, state.camera)
          }
        }}
      >
        {interactive && <Environment preset="city" />}
        
        {/* Main lights */}
        <directionalLight
          position={[2, 4, 3]}
          intensity={0.8}
          color="#ffffff"
          castShadow={interactive}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-2, 3, -1]} intensity={0.3} color="#a0c0ff" />

        {/* Ceiling lights */}
        <spotLight
          position={[0, 3, -2]}
          angle={0.6}
          penumbra={0.5}
          intensity={1.0}
          color="#fffcea"
          distance={10}
          castShadow={interactive}
        />
        <spotLight
          position={[0, 3, 2]}
          angle={0.6}
          penumbra={0.5}
          intensity={1.0}
          color="#fffcea"
          distance={10}
          castShadow={interactive}
        />

        {/* Ambient */}
        <ambientLight intensity={0.4} color="#ffffff" />

        {/* Controls */}
        {interactive && (
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            enableZoom
            zoomSpeed={0.5}
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            rotateSpeed={0.5}
            autoRotate
            autoRotateSpeed={0.3}
            minDistance={3}
            maxDistance={8}
          />
        )}

        {/* Scene & car */}
        <CarParkScene interactive={interactive} />
        <CarModel url={modelUrl} interactive={interactive} />
        <Preload all />
      </Canvas>
    </div>
  )
}

export default Car3DComponents