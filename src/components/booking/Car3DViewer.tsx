"use client"

import { Suspense, useRef, useEffect, memo, useState, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, Html, Environment, AdaptiveDpr, AdaptiveEvents, useProgress } from "@react-three/drei"
import * as THREE from "three"
import { EffectComposer, SSAO } from "@react-three/postprocessing"
import { BlendFunction } from "postprocessing"
import LoadingOverlay from "@/components/ui/loading-overlay"

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
  const { progress } = useProgress()
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  )
})
LoadingScreen.displayName = "LoadingScreen"

/* -------------------------------------
   useOptimizedGLTF Hook
   - Uses useGLTF for loading (which caches internally)
   - Clones and optimizes the scene
   - Disposes resources on unmount
------------------------------------- */
function useOptimizedGLTF(url: string, interactive: boolean) {
  const { scene } = useGLTF(url, "/draco/", true) as any
  const optimizedScene = useMemo(() => {
    if (!scene) return null
    // Deep clone the scene
    const clone = scene.clone(true)
    // Apply one-time modifications: rotate and optimize materials
    clone.rotation.y = Math.PI / 2.2
    clone.position.y = -0.2 // Slightly lower the model in the viewport
    clone.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere()
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.4
          child.material.metalness = 0.8
          // For non-interactive, lower texture resolution slightly
          if (!interactive && child.material.map) {
            child.material.map.minFilter = THREE.LinearFilter
            child.material.map.generateMipmaps = false
          }
        }
      }
    })
    return clone
  }, [scene, interactive])

  useEffect(() => {
    // On unmount, dispose of geometries and materials in the cloned scene
    return () => {
      if (optimizedScene) {
        optimizedScene.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => mat.dispose())
              } else {
                child.material.dispose()
              }
            }
          }
        })
      }
    }
  }, [optimizedScene])

  return optimizedScene
}

/* -------------------------------------
   CarModel Component
   - Renders the optimized 3D model
------------------------------------- */
const CarModel = memo(({ url, interactive }: { url: string; interactive: boolean }) => {
  const optimizedScene = useOptimizedGLTF(url, interactive)
  return optimizedScene ? <primitive object={optimizedScene} /> : null
})
CarModel.displayName = "CarModel"

/* -------------------------------------
   Camera Setup (OrbitControls)
------------------------------------- */
const CameraSetup = memo(({ interactive }: { interactive: boolean }) => {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.1}
      enabled={interactive}
      enableZoom={interactive}
      enablePan={false}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2}
      rotateSpeed={0.8}
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
  const shadowMapSize = 512
  return (
    <>
      <directionalLight
        position={[4, 4, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.25} color="#FFE4B5" castShadow={false} />
      <directionalLight position={[0, -5, 0]} intensity={0.15} color="#4169E1" castShadow={false} />
      <ambientLight intensity={0.3} />
    </>
  )
})
SceneLighting.displayName = "SceneLighting"

/* -------------------------------------
   PostProcessing (SSAO) for Interactive Mode
------------------------------------- */
const PostProcessing = memo(({ interactive }: { interactive: boolean }) => {
  if (!interactive) return null
  return (
    <EffectComposer multisampling={2} enabled={interactive} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={8}
        radius={3}
        intensity={20}
        luminanceInfluence={0.5}
        color={new THREE.Color(0x000000)}
        distanceScaling
        depthAwareUpsampling
        worldDistanceThreshold={1}
        worldDistanceFalloff={1}
        worldProximityThreshold={1}
        worldProximityFalloff={1}
      />
    </EffectComposer>
  )
})
PostProcessing.displayName = "PostProcessing"

/* -------------------------------------
   Main Car3DViewer Component
------------------------------------- */
function Car3DViewer({
  modelUrl,
  imageUrl,
  width = "100%",
  height = "100%",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frameloop, setFrameloop] = useState<"always" | "demand">("demand")
  const [isRendered, setIsRendered] = useState(false)

  // Adjust frameloop for interactive vs. non-interactive
  useEffect(() => {
    if (isVisible) {
      setFrameloop(interactive ? "always" : "demand")
      if (!interactive && !isRendered) {
        // Force a one-time render
        const timer = setTimeout(() => setIsRendered(true), 100)
        return () => clearTimeout(timer)
      }
    } else {
      setFrameloop("demand")
    }
  }, [isVisible, interactive, isRendered])

  // Monitor WebGL context events (optional)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleContextLost = () => {
      console.warn("[Car3DViewer] WebGL context lost")
    }
    canvas.addEventListener("webglcontextlost", handleContextLost)
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost)
    }
  }, [])

  // Enable THREE.Cache for texture efficiency
  useEffect(() => {
    THREE.Cache.enabled = true
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
          logarithmicDepthBuffer: false,
        }}
        shadows={interactive}
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
        {interactive && <PostProcessing interactive={interactive} />}
        <Environment preset="studio" background={false} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <CarModel url={modelUrl} interactive={interactive} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default memo(Car3DViewer, (prev, next) => {
  return prev.modelUrl === next.modelUrl && prev.isVisible === next.isVisible && prev.interactive === next.interactive
})

