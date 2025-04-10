"use client"

import { useRef, useEffect, memo, useState, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, Preload } from "@react-three/drei"
import * as THREE from "three"
import ModelManager from "@/lib/modelManager"

// Simple car park scene components
const CarParkFloor = memo(() => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
    <planeGeometry args={[12, 12]} />
    <meshPhongMaterial color="#232323" shininess={5} specular="#333333" />
  </mesh>
))
CarParkFloor.displayName = "CarParkFloor"

// Parking spot with white lines
const ParkingSpot = memo(() => (
  <group position={[0, -0.245, 0]}>
    {/* Front line */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
      <planeGeometry args={[2.5, 0.1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
    {/* Back line */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]}>
      <planeGeometry args={[2.5, 0.1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
    {/* Left line */}
    <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-1.2, 0, 0]}>
      <planeGeometry args={[4, 0.1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
    {/* Right line */}
    <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[1.2, 0, 0]}>
      <planeGeometry args={[4, 0.1]} />
      <meshBasicMaterial color="#FFFFFF" />
    </mesh>
  </group>
))
ParkingSpot.displayName = "ParkingSpot"

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
    {/* Main ceiling - enlarged from 10x10 to 14x14 */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshPhongMaterial color="#2A2A2A" />
    </mesh>

    {/* Ceiling light strips - enlarged from 6x0.3 to 8x0.4 */}
    <mesh position={[0, -0.1, -2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8, 0.4]} />
      <meshStandardMaterial color="#FFFFEE" emissive="#FFFFEE" emissiveIntensity={0.8} />
    </mesh>

    <mesh position={[0, -0.1, 2]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8, 0.4]} />
      <meshStandardMaterial color="#FFFFEE" emissive="#FFFFEE" emissiveIntensity={0.8} />
    </mesh>
  </group>
))
CarParkCeiling.displayName = "CarParkCeiling"

// Enhanced simple car model for fallbacks and loading states - standardized size and alignment
const SimpleCarModel = memo(() => {
  // Create the car with consistent dimensions to the standard GLB models
  // Length: ~3.0 units, Width: ~1.4 units, Height: ~1.0 unit
  
  // Apply a 150% scale factor to match the scaled GLB models
  const SCALE_FACTOR = 1.5
  
  return (
    <group rotation={[0, Math.PI, 0]} position={[0, 0, 0]} scale={[SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR]}>
      {/* Car body base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[2.2, 0.4, 1.2]} />
        <meshPhongMaterial color="#333333" shininess={70} />
      </mesh>
      {/* Car cabin */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.3, 0.35, 1.0]} />
        <meshPhongMaterial color="#222222" shininess={100} specular="#555555" />
      </mesh>
      {/* Windshield */}
      <mesh position={[0.5, 0.55, 0]} rotation={[0, 0, -0.2]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshPhongMaterial color="#6688aa" shininess={200} specular="#ffffff" transparent opacity={0.7} />
      </mesh>
      {/* Front grille */}
      <mesh position={[1.0, 0.2, 0]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshPhongMaterial color="#111111" shininess={50} />
      </mesh>
      {/* Wheels with better materials */}
      <mesh position={[0.7, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
        <meshPhongMaterial color="#111111" shininess={30} />
      </mesh>
      <mesh position={[-0.7, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
        <meshPhongMaterial color="#111111" shininess={30} />
      </mesh>
      <mesh position={[0.7, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
        <meshPhongMaterial color="#111111" shininess={30} />
      </mesh>
      <mesh position={[-0.7, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
        <meshPhongMaterial color="#111111" shininess={30} />
      </mesh>
      {/* Tail lights */}
      <mesh position={[-1.1, 0.3, 0.4]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[0.2, 0.1]} />
        <meshPhongMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-1.1, 0.3, -0.4]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[0.2, 0.1]} />
        <meshPhongMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
})
SimpleCarModel.displayName = "SimpleCarModel"

// Optimized CarModel component with enhanced material handling
const CarModel = memo(({ 
  url, 
  interactive,
  onModelLoaded
}: { 
  url: string; 
  interactive: boolean;
  onModelLoaded?: (model: THREE.Group) => void 
}) => {
  const [model, setModel] = useState<THREE.Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    const modelManager = ModelManager.getInstance()
    
    if (!modelManager) {
      console.error(`Failed to initialize ModelManager for model: ${url}`)
      setError(true)
      setLoading(false)
      return
    }

    // Attempt to load the model
    modelManager
      .getModel(url)
      .then((loadedModel) => {
        if (!mounted) return

        // Calculate bounding box to properly position and scale the model
        const box = new THREE.Box3().setFromObject(loadedModel)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        
        // Rotate 90 degrees (Math.PI/2) on Y axis to align with parking spot
        loadedModel.rotation.y = Math.PI
        
        // Adjust position based on bounding box
        // Keep the car's bottom at ground level and centered
        loadedModel.position.set(
          -center.x, // Center X
          -box.min.y, // Bottom at ground level
          -center.z // Center Z
        )
        
        // Scale up model by 150% (1.5x)
        const SCALE_FACTOR = 1.5
        
        // After scaling up, ensure it's not too large
        const MAX_LENGTH = 5.25 // Maximum expected car length (3.5 * 1.5)
        const MAX_WIDTH = 2.7   // Maximum expected car width (1.8 * 1.5)
        
        // Calculate appropriate scale factor (scale up by default, down if too large)
        let scaleFactor = SCALE_FACTOR
        if (size.x * SCALE_FACTOR > MAX_LENGTH || size.z * SCALE_FACTOR > MAX_WIDTH) {
          // Scale down if larger than expected
          scaleFactor = Math.min(
            MAX_LENGTH / size.x,
            MAX_WIDTH / size.z,
            SCALE_FACTOR // Don't exceed our target scale
          )
        }
        
        // Apply scaling
        loadedModel.scale.set(scaleFactor, scaleFactor, scaleFactor)
        
        // Debug info about the model size for future reference
        console.debug(`Model ${url} - Size: ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`)

        // Create high-quality car materials
        const createCarPaintMaterial = (baseColor: THREE.Color) => {
          if (interactive) {
            // Premium material for interactive mode
            return new THREE.MeshPhysicalMaterial({
              color: baseColor,
              metalness: 0.9,
              roughness: 0.2,
              clearcoat: 0.8,
              clearcoatRoughness: 0.2,
              reflectivity: 1.0,
              envMapIntensity: 1.2,
            })
          } else {
            // Optimized material for non-interactive mode
            return new THREE.MeshPhongMaterial({
              color: baseColor,
              shininess: 100,
              specular: new THREE.Color(0x888888),
              reflectivity: 0.8,
              flatShading: false,
            })
          }
        }

        // Apply enhanced materials for each part of the car
        loadedModel.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material) {
            // Enable shadows for all meshes
            child.castShadow = true
            child.receiveShadow = true

            // Skip non-visible parts or interior parts
            if (child.name.includes("interior") || child.name.includes("hidden")) {
              return
            }

            // Get original color or use black for car body
            const originalColor =
              child.material instanceof THREE.MeshStandardMaterial
                ? child.material.color.clone()
                : new THREE.Color(0x111111)

            // Determine part type and apply appropriate material
            if (child.name.includes("body") || child.name.includes("car") || child.name.includes("hood")) {
              // Body parts - use premium car paint
              child.material = createCarPaintMaterial(originalColor)
            } else if (child.name.includes("glass") || child.name.includes("window")) {
              // Glass parts
              child.material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(0x88ccff),
                metalness: 0.0,
                roughness: 0.1,
                transmission: 0.9,
                transparent: true,
                opacity: 0.7,
              })
            } else if (child.name.includes("wheel") || child.name.includes("tire")) {
              // Wheels and tires - darker with less reflection
              child.material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0x222222),
                shininess: 30,
                specular: new THREE.Color(0x333333),
              })
            } else if (child.name.includes("light") || child.name.includes("lamp")) {
              // Lights/lamps
              child.material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0xffffee),
                shininess: 100,
                specular: new THREE.Color(0xffffff),
                emissive: new THREE.Color(0x333322),
              })
            } else {
              // Default for all other parts - use original color with enhanced material
              if (!interactive) {
                // For non-interactive, use simpler material
                child.material = new THREE.MeshPhongMaterial({
                  color: originalColor,
                  shininess: 50,
                  specular: new THREE.Color(0x444444),
                })
              } else if (child.material instanceof THREE.MeshStandardMaterial) {
                // For interactive, enhance the standard material
                child.material.envMapIntensity = 0.8
                child.material.roughness = Math.min(child.material.roughness, 0.3)
                child.material.metalness = Math.max(child.material.metalness, 0.5)
              }
            }
          }
        })

        // Add subtle environmental reflection for cars
        const addReflectionPlane = (carModel: THREE.Group) => {
          // Create a large reflection plane that covers the entire ground area
          const reflectionGeometry = new THREE.PlaneGeometry(12, 12)
          const reflectionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.05,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })

          const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial)
          reflection.rotation.x = -Math.PI / 2
          
          // Position it slightly above the ground but below the car's roof
          reflection.position.set(0, 0.01, 0)
          carModel.add(reflection)
        }

        // Add reflection plane to all car models for consistent look
        addReflectionPlane(loadedModel)

        // Notify parent component about loaded model for floor adjustment
        if (onModelLoaded) {
          onModelLoaded(loadedModel)
        }
        
        setModel(loadedModel)
        setLoading(false)
      })
      .catch((err) => {
        console.error(`Failed to load model: ${url}`, err)
        setError(true)
        setLoading(false)
      })

    return () => {
      mounted = false
      modelManager.releaseModel(url)
    }
  }, [url, interactive])

  // Use simple car model while loading or on error
  if (loading || error) {
    return <SimpleCarModel />
  }

  return model ? <primitive object={model} /> : null
})
CarModel.displayName = "CarModel"

// Car Park Scene with optimized rendering
const CarParkScene = memo(({ interactive, yOffset = 0 }: { interactive: boolean, yOffset?: number }) => {
  // Only show complex scene elements in interactive mode or conditionally
  const showFullScene = interactive

  return (
    // Group all scene elements to apply a consistent y-offset
    <group position={[0, yOffset, 0]}>
      {/* Parking lot floor and lines - always show as it's critical for context */}
      <CarParkFloor />
      <ParkingSpot />

      {/* Only show pillars and ceiling in interactive mode to save performance */}
      {showFullScene && (
        <>
          <CarParkPillars />
          <CarParkCeiling />
        </>
      )}

      {/* Add subtle environmental elements */}
      {showFullScene && (
        <>
          {/* Car park painted direction arrow */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 3.5]}>
            <planeGeometry args={[1, 0.8]} />
            <meshBasicMaterial color="#FFFFFF" opacity={0.7} transparent={true} />
          </mesh>

          {/* Parking spot number */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.8, -0.24, 0]}>
            <planeGeometry args={[0.4, 0.4]} />
            <meshBasicMaterial color="#FFFFFF" opacity={0.8} transparent={true} />
          </mesh>
        </>
      )}

      {/* Transparent ground plane (flush with the main ground plane) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.249, 0]} scale={[2.5, 4, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#FFFFFF"
          opacity={0.15}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
})
CarParkScene.displayName = "CarParkScene"

// Props interface
interface Car3DViewerProps {
  modelUrl: string
  width?: string | number
  height?: string | number
  isVisible?: boolean
  interactive?: boolean
  backgroundColor?: string
}

// Main component with performance optimizations
function Car3DViewer({
  modelUrl = "/cars/defaultModel.glb",
  width = "100%",
  height = "100%",
  isVisible = true,
  interactive = false,
  backgroundColor = "transparent",
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // State to track the calculated floor y-offset
  const [sceneYOffset, setSceneYOffset] = useState(0.2) // Default offset if not calculated yet
  
  // Store loaded model reference to access its bounding box
  const modelRef = useRef<THREE.Group | null>(null)
  
  // Simple function to stop propagation of events to the sheet
  const preventSheetDrag = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
  }, []);
  
  // Calculate the y-offset needed to align floor with car bottom
  const calculateYOffset = useCallback((model: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(model)
    // Get the car's bottom Y position
    const bottomY = box.min.y
    // Calculate offset to move floor up to touch car's bottom
    // The floor is at y=-0.25 by default, so we need to adjust it
    const floorYOffset = bottomY + 0.25
    setSceneYOffset(floorYOffset)
    return floorYOffset
  }, [])
  
  // Preload default model on mount
  useEffect(() => {
    if (isVisible) {
      const modelManager = ModelManager.getInstance()
      if (modelManager) {
        modelManager.preloadModels(["/cars/defaultModel.glb"])
      }
    }

    // Force a render when visibility changes
    if (canvasRef.current && !interactive) {
      const timeout = setTimeout(() => {
        const event = new CustomEvent("render")
        canvasRef.current?.dispatchEvent(event)
      }, 100)

      return () => clearTimeout(timeout)
    }
  }, [isVisible, interactive])

  if (!isVisible) return null

  return (
    <div 
      className="h-full w-full relative overflow-hidden three-d-scene" 
      style={{ 
        width, 
        height,
        touchAction: "none",
        position: "relative" 
      }}
      onPointerDown={preventSheetDrag}
      onTouchStart={preventSheetDrag}
      onTouchMove={preventSheetDrag}>
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          depth: true,
          stencil: false,
          alpha: backgroundColor === "transparent",
        }}
        onPointerDown={preventSheetDrag}
        onTouchStart={preventSheetDrag}
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
          touchAction: "none"
        }}
        onCreated={(state) => {
          // Set background color
          if (backgroundColor === "transparent") {
            state.scene.background = null
          } else {
            state.scene.background = new THREE.Color(backgroundColor)
          }

          // Enable shadows if in interactive mode
          if (interactive) {
            state.gl.shadowMap.enabled = true
            state.gl.shadowMap.type = THREE.PCFSoftShadowMap
          }

          if (!interactive) {
            // Force a single render for static viewing
            state.gl.render(state.scene, state.camera)
          }
        }}
      >
        {/* Environment map for realistic reflections in interactive mode */}
        {interactive && <Environment preset="city" />}

        {/* Car park environment lighting */}
        <directionalLight
          position={[2, 4, 3]}
          intensity={0.8}
          color="#ffffff"
          castShadow={interactive}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-2, 3, -1]} intensity={0.3} color="#a0c0ff" />

        {/* Ceiling lights effect */}
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

        {/* Ambient light for base visibility */}
        <ambientLight intensity={0.4} color="#ffffff" />

        {/* Camera controls only when interactive */}
        {interactive && (
          <OrbitControls
            enableDamping={true}
            dampingFactor={0.1}
            enableZoom={true}
            zoomSpeed={0.5}
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            rotateSpeed={0.5}
            autoRotate={true}
            autoRotateSpeed={0.3}
            minDistance={3}
            maxDistance={8}
          />
        )}

        {/* Add car park environment scene with calculated y-offset */}
        <CarParkScene interactive={interactive} yOffset={sceneYOffset} />

        {/* Car model with callback to update floor position */}
        <CarModel 
          url={modelUrl} 
          interactive={interactive} 
          onModelLoaded={calculateYOffset} 
        />

        {/* Preload assets for better performance */}
        <Preload all />
      </Canvas>
    </div>
  )
}

export default memo(Car3DViewer, (prev, next) => {
  return (
    prev.modelUrl === next.modelUrl &&
    prev.isVisible === next.isVisible &&
    prev.interactive === next.interactive &&
    prev.backgroundColor === next.backgroundColor
  )
})
