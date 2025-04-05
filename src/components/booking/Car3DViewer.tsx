"use client"

import { Suspense, useRef, useEffect, memo, useState, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html, Environment, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei"
import * as THREE from "three"
import LoadingOverlay from "@/components/ui/loading-overlay"
import ModelManager from "@/lib/modelManager"

/* -------------------------------------
   Type & Props
------------------------------------- */
interface Car3DViewerProps {
  modelUrl: string
  imageUrl?: string
  width?: string | number
  height?: string | number
  isVisible?: boolean
  interactive?: boolean
}

/* -------------------------------------
   Loading indicator while model loads
------------------------------------- */
const LoadingScreen = memo(() => {
  const [progress, setProgress] = useState(0)
  
  useFrame(({ clock }) => {
    // Simulate loading progress for better UX
    setProgress(prev => Math.min(prev + 2, 99))
  })
  
  return (
    <Html center>
      <LoadingOverlay message={`${progress.toFixed(0)}%`} />
    </Html>
  )
})
LoadingScreen.displayName = "LoadingScreen"

/* -------------------------------------
   MemoizedCarModel Component
   - Uses singleton ModelManager for efficient loading
------------------------------------- */
const MemoizedCarModel = memo(({ url, interactive }: { url: string; interactive: boolean }) => {
  const modelRef = useRef<THREE.Group>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)
  const modelManager = ModelManager.getInstance()
  
  useEffect(() => {
    let mounted = true
    
    // Get model from manager
    modelManager.getModel(url)
      .then(loadedModel => {
        if (!mounted) return
        
        // Apply standard rotations and positions
        loadedModel.rotation.y = Math.PI / 2.2
        loadedModel.position.y = -0.2
        
        // Apply optimizations for non-interactive mode
        if (!interactive) {
          loadedModel.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              if (child.material.map) {
                child.material.map.minFilter = THREE.LinearFilter
                child.material.map.generateMipmaps = false
              }
            }
          })
        }
        
        setModel(loadedModel)
      })
      .catch(err => console.error(`Error loading model ${url}:`, err))
    
    // Release the model when unmounting
    return () => {
      mounted = false
      modelManager.releaseModel(url)
    }
  }, [url, interactive, modelManager])
  
  return model ? <primitive ref={modelRef} object={model} /> : null
})
MemoizedCarModel.displayName = "MemoizedCarModel"

/* -------------------------------------
   Camera Setup (OrbitControls)
------------------------------------- */
const CameraSetup = memo(({ interactive }: { interactive: boolean }) => {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.1}
      enabled={interactive}
      enableZoom={false}
      enablePan={false}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2}
      rotateSpeed={0.5}
      autoRotate={interactive}
      autoRotateSpeed={0.5}
    />
  )
})
CameraSetup.displayName = "CameraSetup"

/* -------------------------------------
   Scene Lighting & Ambient
------------------------------------- */
const SceneLighting = memo(() => {
  return (
    <>
      <directionalLight position={[4, 4, 4]} intensity={1.2} />
      <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" />
      <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" />
      <ambientLight intensity={0.3} />
    </>
  )
})
SceneLighting.displayName = "SceneLighting"

/* -------------------------------------
   Main Car3DViewer Component
------------------------------------- */
function Car3DViewer({
  modelUrl,
  width = "100%",
  height = "100%",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameloop, setFrameloop] = useState<"always" | "demand">("demand")
  
  // Optimize frameloop strategy
  useEffect(() => {
    if (isVisible) {
      // Use "always" only for interactive mode
      setFrameloop(interactive ? "always" : "demand")
    } else {
      setFrameloop("demand")
    }
  }, [isVisible, interactive])
  
  // Preload models at component mount
  useEffect(() => {
    // Preload common models
    ModelManager.getInstance().preloadModels([
      "/cars/kona.glb", 
      "/cars/defaultModel.glb"
    ])
    
    // Clean unused models periodically
    const cleanupInterval = setInterval(() => {
      ModelManager.getInstance().cleanUnusedModels(60000) // 1 minute
    }, 60000)
    
    return () => clearInterval(cleanupInterval)
  }, [])
  
  // Determine device pixel ratio based on interactivity
  const dpr = useMemo<number | [number, number]>(() => {
    return interactive ? [1, 1.5] : [0.8, 1]
  }, [interactive])
  
  if (!isVisible) return null
  
  return (
    <div className="h-full w-full relative overflow-hidden contain-strict" style={{ width, height }}>
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: interactive,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          premultipliedAlpha: true,
        }}
        shadows={false}
        camera={{ position: [2.5, 1.8, 2.5], fov: 20 }}
        dpr={dpr}
        frameloop={frameloop}
        style={{ touchAction: "none", outline: "none", width: "100%", height: "100%" }}
        onCreated={(state) => {
          if (!interactive) {
            // Trigger a manual render once for static display
            state.gl.render(state.scene, state.camera)
          }
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <SceneLighting />
        <Environment preset="studio" background={false} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <MemoizedCarModel url={modelUrl} interactive={interactive} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default memo(Car3DViewer, (prev, next) => {
  return prev.modelUrl === next.modelUrl && prev.isVisible === next.isVisible && prev.interactive === next.interactive
})