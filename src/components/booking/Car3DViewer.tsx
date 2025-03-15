"use client"

import { Suspense, useRef, useEffect, memo, useState, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  AdaptiveDpr,
  AdaptiveEvents,
  useProgress,
} from "@react-three/drei"
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
   The actual 3D model with optimized cloning
------------------------------------- */
const CarModel = memo(({ url, interactive }: { url: string; interactive: boolean }) => {
  // Load the original GLTF model. useGLTF caches this internally.
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any

  // Clone the original scene once per modelUrl using useMemo.
  const clonedScene = useMemo(() => {
    if (!originalScene) return null
    const sceneClone = originalScene.clone()
    // Apply one-time modifications:
    sceneClone.rotation.y = Math.PI / 2

    // Traverse the clone to compute bounds and optimize materials.
    sceneClone.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere()

        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.4
          child.material.metalness = 0.8
          if (!interactive && child.material.map) {
            child.material.map.minFilter = THREE.LinearFilter
            child.material.map.generateMipmaps = false
          }
        }
      }
    })

    // Optional positioning adjustments based on model name.
    if (url.includes("kona.glb")) {
      const box = new THREE.Box3().setFromObject(sceneClone)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scaleFactor = 1.0 / maxDim
      sceneClone.scale.set(scaleFactor, scaleFactor, scaleFactor)
      box.setFromObject(sceneClone)
      box.getCenter(center)
      sceneClone.position.x -= center.x
      sceneClone.position.y -= center.y
      sceneClone.position.z -= center.z
      sceneClone.position.y -= 0.2
    } else {
      sceneClone.position.set(0, -0.3, 0)
    }

    return sceneClone
  }, [originalScene, url, interactive])

  // Cleanup cloned scene when unmounting.
  useEffect(() => {
    return () => {
      if (clonedScene) {
        clonedScene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose()
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((mat: THREE.Material) => mat.dispose())
              } else {
                object.material.dispose()
              }
            }
          }
        })
      }
    }
  }, [clonedScene])

  return clonedScene ? <primitive object={clonedScene} /> : null
})
CarModel.displayName = "CarModel"

/* -------------------------------------
   Orbit controls (camera) - memoized
------------------------------------- */
const CameraSetup = memo(({ interactive }: { interactive: boolean }) => {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      enabled={interactive}
      enableZoom={interactive}
      enablePan={false}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
    />
  )
})
CameraSetup.displayName = "CameraSetup"

/* -------------------------------------
   Lights & ambient - memoized
------------------------------------- */
const SceneLighting = memo(() => {
  const shadowMapSize = 512
  return (
    <>
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
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
   PostProcessing with advanced SSAO 
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

  useEffect(() => {
    const handleContextLost = () => {
      console.warn("WebGL context lost")
    }
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("webglcontextlost", handleContextLost)
      return () => {
        canvas.removeEventListener("webglcontextlost", handleContextLost)
      }
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="h-full w-full relative overflow-hidden contain-strict">
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
        camera={{ position: [3, 3, 3], fov: 15 }}
        dpr={interactive ? [1, 1.5] : [1, 1]}
        frameloop={interactive ? "always" : "demand"}
        style={{
          touchAction: "none",
          outline: "none",
          width: "100%",
          height: "100%",
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <SceneLighting />
        {interactive && <PostProcessing interactive={interactive} />}
        <Environment preset="sunset" background={false} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <CarModel url={modelUrl} interactive={interactive} />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Memo to prevent unnecessary re-renders
export default memo(Car3DViewer, (prev, next) => {
  return (
    prev.modelUrl === next.modelUrl &&
    prev.isVisible === next.isVisible &&
    prev.interactive === next.interactive
  )
})

/* -------------------------------------
   Caching & Memory Management
------------------------------------- */
interface ModelCacheEntry {
  lastUsed: number
  isLoaded: boolean
  refCount: number
  loadedModel?: any
}

const modelsCache = new Map<string, ModelCacheEntry>()
let estimatedMemoryUsage = 0
const MEMORY_BUDGET = 100 * 1024 * 1024

function cleanupUnusedModels(exceptUrl?: string) {
  const now = Date.now()
  const TIMEOUT = 60 * 1000 // 1 minute

  let entriesRemoved = 0
  modelsCache.forEach((entry, url) => {
    if (url === exceptUrl) return
    if (entry.refCount <= 0 && now - entry.lastUsed > TIMEOUT) {
      try {
        if (entry.loadedModel && entry.loadedModel.scene) {
          entry.loadedModel.scene.traverse((object: any) => {
            if (object instanceof THREE.Mesh) {
              object.geometry?.dispose()
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((mat: THREE.Material) => mat.dispose())
                } else {
                  object.material.dispose()
                }
              }
            }
          })
        }
        modelsCache.delete(url)
        entriesRemoved++
        estimatedMemoryUsage -= 10 * 1024 * 1024
      } catch (err) {
        console.warn("Failed to clean up model:", url, err)
      }
    }
  })
  if (entriesRemoved > 0) {
    console.debug(`Cleaned up ${entriesRemoved} unused models`)
  }
}

/* -------------------------------------
   Preloading & Disposal (unchanged)
------------------------------------- */
export function preloadCarModels(urls: string[]) {
  const MAX_PRELOAD = 3
  const filtered = urls.slice(0, MAX_PRELOAD)

  if (estimatedMemoryUsage > MEMORY_BUDGET * 0.5) {
    cleanupUnusedModels()
  }

  filtered.forEach((url) => {
    const cacheEntry = modelsCache.get(url) || {
      lastUsed: Date.now(),
      isLoaded: false,
      refCount: 0,
    }

    const loadModel = async () => {
      try {
        const model = await useGLTF(url)
        cacheEntry.loadedModel = model
      } catch (err) {
        console.warn("Failed to load model for caching:", err)
      }
    }

    if (!cacheEntry.isLoaded) {
      try {
        useGLTF.preload(url)
        estimatedMemoryUsage += 10 * 1024 * 1024
        loadModel()
        cacheEntry.isLoaded = true
        modelsCache.set(url, cacheEntry)
      } catch (err) {
        console.warn("Preload not available or failed:", err)
      }
    }
  })
}

export function disposeAllModels() {
  modelsCache.forEach((entry, url) => {
    try {
      if (entry.loadedModel && entry.loadedModel.scene) {
        entry.loadedModel.scene.traverse((object: any) => {
          if (object instanceof THREE.Mesh) {
            object.geometry?.dispose()
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((mat: THREE.Material) => mat.dispose())
              } else {
                object.material.dispose()
              }
            }
          }
        })
      }
    } catch (e) {
      console.warn("Error disposing model:", url, e)
    }
  })
  modelsCache.clear()
  estimatedMemoryUsage = 0
}
