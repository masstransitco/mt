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
   Model Cache System
------------------------------------- */
interface ModelCacheEntry {
  lastUsed: number
  isLoaded: boolean
  refCount: number
  scene?: THREE.Group
}

// Global model cache shared between all Car3DViewer instances
const modelsCache = new Map<string, ModelCacheEntry>()
let estimatedMemoryUsage = 0
const MEMORY_BUDGET = 100 * 1024 * 1024 // 100MB memory budget

// Try to preload models in the background
export function preloadCarModels(urls: string[]) {
  const MAX_PRELOAD = 3
  const filtered = urls.slice(0, MAX_PRELOAD)
  
  // Check memory budget before preloading
  if (estimatedMemoryUsage > MEMORY_BUDGET * 0.7) {
    cleanupUnusedModels()
  }

  filtered.forEach((url) => {
    // Skip if already in cache or if we're over budget
    if (modelsCache.has(url) || estimatedMemoryUsage > MEMORY_BUDGET * 0.8) {
      return
    }

    console.log(`[Car3DViewer] Preloading model: ${url}`)
    
    // Create cache entry
    const cacheEntry: ModelCacheEntry = {
      lastUsed: Date.now(),
      isLoaded: false,
      refCount: 0,
    }
    
    modelsCache.set(url, cacheEntry)
    
    // Start loading in background
    try {
      useGLTF.preload(url)
      estimatedMemoryUsage += 10 * 1024 * 1024 // Estimate ~10MB per model
      console.log(`[Car3DViewer] Preloaded: ${url}`)
      
      // Load the actual model asynchronously
      const loadModel = async () => {
        try {
          const model = await useGLTF(url)
          if (model && model.scene) {
            const cloneScene = model.scene.clone()
            
            // Apply standard optimizations to the cloned scene
            cloneScene.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
                if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere()
                
                if (child.material instanceof THREE.MeshStandardMaterial) {
                  child.material.roughness = 0.4
                  child.material.metalness = 0.8
                }
              }
            })
            
            // Store in cache
            const entry = modelsCache.get(url)
            if (entry) {
              entry.scene = cloneScene
              entry.isLoaded = true
              console.log(`[Car3DViewer] Model fully loaded: ${url}`)
            }
          }
        } catch (err) {
          console.warn(`[Car3DViewer] Failed to preload model: ${url}`, err)
        }
      }
      
      loadModel()
    } catch (err) {
      console.warn(`[Car3DViewer] Failed to preload: ${url}`, err)
      modelsCache.delete(url)
    }
  })
}

// Clean up models that haven't been used recently
function cleanupUnusedModels(exceptUrl?: string) {
  const now = Date.now()
  const TIMEOUT = 60 * 1000 // 1 minute timeout
  
  console.log(`[Car3DViewer] Cleaning up cache. Current size: ${modelsCache.size} models`)
  
  let entriesRemoved = 0
  modelsCache.forEach((entry, url) => {
    if (url === exceptUrl) return
    
    if (entry.refCount <= 0 && now - entry.lastUsed > TIMEOUT) {
      try {
        if (entry.scene) {
          entry.scene.traverse((object: any) => {
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
        estimatedMemoryUsage -= 10 * 1024 * 1024 // Reduce estimated memory usage
      } catch (err) {
        console.warn("[Car3DViewer] Failed to clean up model:", url, err)
      }
    }
  })
  
  if (entriesRemoved > 0) {
    console.log(`[Car3DViewer] Cleaned up ${entriesRemoved} unused models`)
  }
}

// Clean up all models on app shutdown
export function disposeAllModels() {
  modelsCache.forEach((entry, url) => {
    try {
      if (entry.scene) {
        entry.scene.traverse((object: any) => {
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
      console.warn("[Car3DViewer] Error disposing model:", url, e)
    }
  })
  modelsCache.clear()
  estimatedMemoryUsage = 0
  console.log("[Car3DViewer] All models disposed")
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
  // Fixed: Don't try to assign to modelRef.current directly
  const modelRef = useRef<THREE.Group>(null)
  const [isReady, setIsReady] = useState(false)
  
  // Check cache first
  useEffect(() => {
    // Update usage timestamp and ref count
    const cacheEntry = modelsCache.get(url)
    if (cacheEntry) {
      cacheEntry.lastUsed = Date.now()
      cacheEntry.refCount++
    }
    
    return () => {
      // Decrement ref count when unmounting
      const entry = modelsCache.get(url)
      if (entry) {
        entry.refCount--
        entry.lastUsed = Date.now()
      }
    }
  }, [url])
  
  // Load or retrieve the GLTF model
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any

  // Clone the original scene once per modelUrl using useMemo
  const clonedScene = useMemo(() => {
    if (!originalScene) return null
    
    // Check if we already have this model in cache with a scene
    const cacheEntry = modelsCache.get(url)
    if (cacheEntry?.scene) {
      // Reuse cached model
      console.log(`[Car3DViewer] Using cached model: ${url}`)
      const cachedScene = cacheEntry.scene.clone()
      return cachedScene
    }
    
    // Otherwise, clone the original and cache it
    console.log(`[Car3DViewer] Cloning new model: ${url}`)
    const sceneClone = originalScene.clone()
    
    // Apply one-time modifications:
    sceneClone.rotation.y = Math.PI / 2

    // Traverse the clone to compute bounds and optimize materials
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

    // Optional positioning adjustments based on model name
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
    
    // Store in cache
    if (cacheEntry) {
      cacheEntry.scene = sceneClone.clone()
      cacheEntry.isLoaded = true
    } else {
      // Create new entry if not exists
      modelsCache.set(url, {
        lastUsed: Date.now(),
        isLoaded: true,
        refCount: 1,
        scene: sceneClone.clone()
      })
    }

    return sceneClone
  }, [originalScene, url, interactive])

  // Signal when ready
  useEffect(() => {
    if (clonedScene) {
      setIsReady(true)
    }
  }, [clonedScene])

  return clonedScene ? <primitive ref={modelRef} object={clonedScene} /> : null
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
  // Use smaller shadow maps when not interactive
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
  const [frameloop, setFrameloop] = useState<"always" | "demand">("demand")
  const [isRendered, setIsRendered] = useState(false)
  
  // Optimize performance based on visibility and interaction mode
  useEffect(() => {
    if (isVisible) {
      // Only use 'always' frameloop when interactive and visible
      // Otherwise use 'demand' for better performance
      setFrameloop(interactive ? "always" : "demand")
      
      // Force a render if needed for non-interactive mode
      if (!interactive && !isRendered) {
        const timer = setTimeout(() => {
          setIsRendered(true)
        }, 100)
        
        return () => clearTimeout(timer)
      }
    } else {
      // When not visible, always use demand to save resources
      setFrameloop("demand")
    }
  }, [isVisible, interactive, isRendered])

  // Clean up WebGL context on unmount
  useEffect(() => {
    const handleContextLost = () => {
      console.warn("[Car3DViewer] WebGL context lost")
    }
    
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("webglcontextlost", handleContextLost)
      return () => {
        canvas.removeEventListener("webglcontextlost", handleContextLost)
      }
    }
  }, [])
  
  // Use THREE.Cache for texture efficiency
  useEffect(() => {
    // Enable texture caching when component mounts
    THREE.Cache.enabled = true
    
    return () => {
      // Consider disabling on unmount if we have memory issues
      // THREE.Cache.enabled = false;
    }
  }, [])
  
  // Determine DPR (Device Pixel Ratio) based on interactive mode
  // Fixed: Use proper type for DPR
  const dpr = useMemo(() => {
    return interactive ? [1, 1.5] : [0.8, 1] as [number, number]
  }, [interactive])

  // Not visible - don't render anything
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
        dpr={dpr as [number, number]}
        frameloop={frameloop}
        style={{
          touchAction: "none",
          outline: "none",
          width: "100%",
          height: "100%",
        }}
        onCreated={state => {
          // Force at least one render for non-interactive mode
          if (!interactive) {
            state.gl.render(state.scene, state.camera)
          }
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
