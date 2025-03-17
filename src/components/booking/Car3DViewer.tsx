"use client"

import { Suspense, useRef, useEffect, memo, useState, useMemo } from "react"
import { Canvas, useThree } from "@react-three/fiber"
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
   Optimized Model Cache System
------------------------------------- */
interface ModelCacheEntry {
  lastUsed: number
  isLoaded: boolean
  refCount: number
  scene?: THREE.Group
  materials?: Map<string, THREE.Material>
  expirationTimer?: NodeJS.Timeout
}

// Global model cache shared between all instances
const modelsCache = new Map<string, ModelCacheEntry>()
let estimatedMemoryUsage = 0
const MEMORY_BUDGET = 100 * 1024 * 1024 // 100MB memory budget
const MODEL_SIZE_ESTIMATE = 8 * 1024 * 1024 // 8MB per model estimate
const CACHE_EXPIRATION_TIME = 60 * 1000 // 1 minute

// Debug mode for cache monitoring
const DEBUG_CACHE = false

/**
 * Log only in debug mode
 */
function debugLog(...args: any[]) {
  if (DEBUG_CACHE) {
    console.log(...args)
  }
}

/**
 * Preload models in the background with proper memory management
 */
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

    debugLog(`[Car3DViewer] Preloading model: ${url}`)
    
    // Create cache entry
    const cacheEntry: ModelCacheEntry = {
      lastUsed: Date.now(),
      isLoaded: false,
      refCount: 0,
      materials: new Map()
    }
    
    modelsCache.set(url, cacheEntry)
    
    // Start loading in background
    try {
      useGLTF.preload(url)
      estimatedMemoryUsage += MODEL_SIZE_ESTIMATE
      debugLog(`[Car3DViewer] Preloaded: ${url}`)
      
      // Load the actual model asynchronously
      const loadModel = async () => {
        try {
          const gltf = await useGLTF(url)
          if (gltf && gltf.scene) {
            const materialMap = new Map<string, THREE.Material>()
            
            // Clone & optimize the scene
            const cloneScene = gltf.scene.clone()
            
            // Apply standard optimizations to the cloned scene
            cloneScene.traverse((child: THREE.Object3D) => {
              if (child instanceof THREE.Mesh) {
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
                if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere()
                
                // Cache materials by reference for reuse
                if (child.material) {
                  const materials = Array.isArray(child.material) ? child.material : [child.material]
                  
                  materials.forEach(material => {
                    if (material instanceof THREE.MeshStandardMaterial) {
                      const matId = material.uuid
                      if (!materialMap.has(matId)) {
                        materialMap.set(matId, material.clone())
                        // Apply material optimizations
                        material.roughness = 0.4
                        material.metalness = 0.8
                      }
                    }
                  })
                }
              }
            })
            
            // Store in cache
            const entry = modelsCache.get(url)
            if (entry) {
              entry.scene = cloneScene
              entry.materials = materialMap
              entry.isLoaded = true
              debugLog(`[Car3DViewer] Model fully loaded: ${url}`)
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
      estimatedMemoryUsage -= MODEL_SIZE_ESTIMATE
    }
  })
}

/**
 * Schedule model for cleanup after a delay
 */
function scheduleModelCleanup(url: string, entry: ModelCacheEntry) {
  // Clear any existing expiration timer
  if (entry.expirationTimer) {
    clearTimeout(entry.expirationTimer)
  }
  
  // Set new expiration timer
  entry.expirationTimer = setTimeout(() => {
    if (entry.refCount <= 0) {
      debugLog(`[Car3DViewer] Auto-cleaning unused model: ${url}`)
      disposeModel(url, entry)
    }
  }, CACHE_EXPIRATION_TIME)
}

/**
 * Properly dispose of a model and its resources
 */
function disposeModel(url: string, entry: ModelCacheEntry) {
  try {
    if (entry.scene) {
      entry.scene.traverse((object: any) => {
        if (object.isMesh) {
          if (object.geometry) {
            object.geometry.dispose()
          }
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat: THREE.Material) => {
                disposeMaterialTextures(mat)
                mat.dispose()
              })
            } else {
              disposeMaterialTextures(object.material)
              object.material.dispose()
            }
          }
        }
      })
    }
    
    // Also dispose cached materials
    if (entry.materials) {
      entry.materials.forEach(material => {
        disposeMaterialTextures(material)
        material.dispose()
      })
      entry.materials.clear()
    }
    
    // Clear any pending timers
    if (entry.expirationTimer) {
      clearTimeout(entry.expirationTimer)
    }
    
    // Remove from cache
    modelsCache.delete(url)
    estimatedMemoryUsage -= MODEL_SIZE_ESTIMATE
    
    // Force garbage collection hint (not guaranteed to work)
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc()
    }
  } catch (err) {
    console.warn("[Car3DViewer] Failed to clean up model:", url, err)
  }
}

/**
 * Helper to dispose textures from a material
 */
function disposeMaterialTextures(material: THREE.Material) {
  if (material instanceof THREE.MeshStandardMaterial || 
      material instanceof THREE.MeshBasicMaterial) {
    // Dispose all textures
    Object.keys(material).forEach(key => {
      const value = (material as any)[key]
      if (value instanceof THREE.Texture) {
        value.dispose()
      }
    })
  }
}

/**
 * Clean up models that haven't been used recently
 */
function cleanupUnusedModels(exceptUrl?: string) {
  debugLog(`[Car3DViewer] Cleaning up cache. Current size: ${modelsCache.size} models`)
  
  let entriesRemoved = 0
  modelsCache.forEach((entry, url) => {
    // Skip the currently used model
    if (url === exceptUrl) return
    
    // Only remove models with refCount <= 0
    if (entry.refCount <= 0) {
      disposeModel(url, entry)
      entriesRemoved++
    }
  })
  
  if (entriesRemoved > 0) {
    debugLog(`[Car3DViewer] Cleaned up ${entriesRemoved} unused models`)
  }
  
  return entriesRemoved
}

/**
 * Clean up all models (call on app shutdown)
 */
export function disposeAllModels() {
  modelsCache.forEach((entry, url) => {
    disposeModel(url, entry)
  })
  estimatedMemoryUsage = 0
  debugLog("[Car3DViewer] All models disposed")
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
   Automatic Canvas cleaner
------------------------------------- */
function CanvasCleaner() {
  const { gl } = useThree()
  
  useEffect(() => {
    return () => {
      // Help WebGL renderer clean up resources
      gl.dispose()
    }
  }, [gl])
  
  return null
}

/* -------------------------------------
   The optimized 3D model component
------------------------------------- */
const CarModel = memo(({ url, interactive }: { url: string; interactive: boolean }) => {
  const modelRef = useRef<THREE.Group>(null)
  const [isReady, setIsReady] = useState(false)
  
  // Update cache usage tracking
  useEffect(() => {
    // Update usage timestamp and ref count
    const cacheEntry = modelsCache.get(url)
    if (cacheEntry) {
      cacheEntry.lastUsed = Date.now()
      cacheEntry.refCount++
      
      // Cancel any pending cleanup
      if (cacheEntry.expirationTimer) {
        clearTimeout(cacheEntry.expirationTimer)
        cacheEntry.expirationTimer = undefined
      }
    } else {
      // If not in cache, add an entry
      modelsCache.set(url, {
        lastUsed: Date.now(),
        isLoaded: false,
        refCount: 1
      })
      estimatedMemoryUsage += MODEL_SIZE_ESTIMATE
    }
    
    // Decrement ref count when unmounting
    return () => {
      const entry = modelsCache.get(url)
      if (entry) {
        entry.refCount--
        entry.lastUsed = Date.now()
        
        // Schedule for cleanup if no longer used
        if (entry.refCount <= 0) {
          scheduleModelCleanup(url, entry)
        }
      }
    }
  }, [url])
  
  // Load or retrieve the GLTF model
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any

  // Efficient scene cloning with memoization
  const clonedScene = useMemo(() => {
    if (!originalScene) return null
    
    // Check if we already have this model in cache with a scene
    const cacheEntry = modelsCache.get(url)
    if (cacheEntry?.scene) {
      // Reuse cached model
      debugLog(`[Car3DViewer] Using cached model: ${url}`)
      
      // Instead of full clone, create a simpler instance
      const cachedModel = new THREE.Group()
      cachedModel.add(cacheEntry.scene.clone())
      return cachedModel
    }
    
    // Otherwise, clone and optimize the original
    debugLog(`[Car3DViewer] Cloning new model: ${url}`)
    
    const optimizedScene = new THREE.Group()
    const sceneClone = originalScene.clone()
    
    // Apply one-time modifications:
    sceneClone.rotation.y = Math.PI / 2

    // Traverse and optimize the clone
    sceneClone.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        // Compute bounds if needed
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere()

        // Apply material optimizations
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.4
          child.material.metalness = 0.8
          
          // For non-interactive mode, optimize textures
          if (!interactive && child.material.map) {
            child.material.map.minFilter = THREE.LinearFilter
            child.material.map.generateMipmaps = false
          }
        }
      }
    })
    
    optimizedScene.add(sceneClone)

    // Apply model-specific positioning/scaling
    if (url.includes("kona.glb")) {
      // Center and scale Kona model
      const box = new THREE.Box3().setFromObject(optimizedScene)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scaleFactor = 1.0 / maxDim
      optimizedScene.scale.set(scaleFactor, scaleFactor, scaleFactor)
      box.setFromObject(optimizedScene)
      box.getCenter(center)
      optimizedScene.position.x -= center.x
      optimizedScene.position.y -= center.y
      optimizedScene.position.z -= center.z
      optimizedScene.position.y -= 0.2
    } else {
      // Default positioning for other models
      optimizedScene.position.set(0, -0.3, 0)
    }
    
    // Store in cache for future reuse
    if (cacheEntry) {
      cacheEntry.scene = optimizedScene.clone()
      cacheEntry.isLoaded = true
    }

    return optimizedScene
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
      makeDefault
    />
  )
})
CameraSetup.displayName = "CameraSetup"

/* -------------------------------------
   Lights & ambient - memoized
------------------------------------- */
const SceneLighting = memo(({ quality }: { quality: 'low' | 'high' }) => {
  // Use smaller shadow maps for low quality
  const shadowMapSize = quality === 'high' ? 1024 : 512
  
  return (
    <>
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.0}
        castShadow={quality === 'high'}
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
   PostProcessing with conditional SSAO 
------------------------------------- */
const PostProcessing = memo(({ interactive, quality }: { interactive: boolean, quality: 'low' | 'high' }) => {
  // Ensure interactive is treated as boolean
  const isInteractive = !!interactive
  
  if (!isInteractive || quality === 'low') return null

  // Only use advanced effects in high quality mode
  return (
    <EffectComposer multisampling={2} enabled={interactive} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={8} // Reduce from 16 for better performance
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
  const [quality, setQuality] = useState<'low' | 'high'>(interactive ? 'high' : 'low')
  
  // Track render cycles to prevent unnecessary re-renders
  const renderCycleRef = useRef(0)
  
  // Optimize performance based on visibility and interaction mode
  useEffect(() => {
    if (isVisible) {
      // Use 'always' frameloop when interactive and visible
      // Otherwise use 'demand' for better performance
      setFrameloop(interactive ? "always" : "demand")
      setQuality(interactive ? 'high' : 'low')
      
      // Force a render if needed for non-interactive mode
      if (!interactive && !isRendered) {
        const timer = setTimeout(() => {
          setIsRendered(true)
          
          // Increment render cycle to track renders
          renderCycleRef.current++
          debugLog(`[Car3DViewer] Static render cycle: ${renderCycleRef.current}`)
        }, 100)
        
        return () => clearTimeout(timer)
      }
    } else {
      // When not visible, always use demand to save resources
      setFrameloop("demand")
      
      // Downgrade quality when not visible
      setQuality('low')
    }
  }, [isVisible, interactive, isRendered])

  // Handle visibility change
  useEffect(() => {
    // When component becomes visible
    if (isVisible) {
      debugLog(`[Car3DViewer] Component visible: ${modelUrl}`)
    } else {
      debugLog(`[Car3DViewer] Component hidden: ${modelUrl}`)
    }
  }, [isVisible, modelUrl])

  // Use THREE.Cache for texture efficiency
  useEffect(() => {
    // Enable texture caching when component mounts
    THREE.Cache.enabled = true
    
    // Clean up resources on unmount
    return () => {
      // Trigger cleanup if too many models are cached
      if (modelsCache.size > 5) {
        cleanupUnusedModels(modelUrl)
      }
    }
  }, [modelUrl])
  
  // Optimize DPR based on interactive mode and device capabilities
  const dpr = useMemo(() => {
    // Get device DPR with sensible default
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    
    // Cap at 1.5 for interactive, 1.0 for non-interactive
    const maxDpr = interactive ? 1.5 : 1.0
    const minDpr = interactive ? 1.0 : 0.8
    
    // Clamp between min and max values
    const cappedDpr = Math.min(maxDpr, Math.max(minDpr, deviceDpr))
    
    return [cappedDpr, cappedDpr] as [number, number]
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
        shadows={quality === 'high'}
        camera={{ position: [3, 3, 3], fov: 15 }}
        dpr={dpr}
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
        <CanvasCleaner />
        <SceneLighting quality={quality} />
        <PostProcessing interactive={interactive} quality={quality} />
        <Environment preset="sunset" background={false} />
        <Suspense fallback={<LoadingScreen />}>
          <CameraSetup interactive={interactive} />
          <CarModel url={modelUrl} interactive={interactive} />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Memo with deep props comparison for optimal re-rendering
export default memo(Car3DViewer, (prev, next) => {
  // Only re-render when important props change
  return (
    prev.modelUrl === next.modelUrl &&
    prev.isVisible === next.isVisible &&
    prev.interactive === next.interactive
  )
})