"use client";

import React, { Suspense, useRef, useEffect, useMemo, memo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Html,
  Environment,
  Preload,
  AdaptiveDpr,
  AdaptiveEvents,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import LoadingOverlay from "@/components/ui/loading-overlay";

/* -------------------------------------
   Type & Props
------------------------------------- */
interface Car3DViewerProps {
  modelUrl: string;
  imageUrl?: string;
  width?: string | number;
  height?: string | number;
  isVisible?: boolean;
  interactive?: boolean;
}

/* -------------------------------------
   Loading indicator while model loads
------------------------------------- */
const LoadingScreen = memo(() => {
  const { progress } = useProgress();
  return (
    <Html center>
      <LoadingOverlay message={`Loading model... ${progress.toFixed(0)}%`} />
    </Html>
  );
});
LoadingScreen.displayName = "LoadingScreen";

/* -------------------------------------
   The actual 3D model with proper memory management
------------------------------------- */
function CarModel({ url, interactive }: { url: string; interactive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  
  const { scene: originalScene } = useGLTF(url, "/draco/", true) as any;
  const scene = useMemo(() => originalScene.clone(), [originalScene]);

  // Initial model setup
  useEffect(() => {
    if (!scene) return;

    // Store in ref for cleanup
    modelRef.current = scene;
    scene.rotation.y = Math.PI / 2;

    // Optimize materials and geometries
    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        // Ensure bounds are computed
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        if (!child.geometry.boundingSphere) {
          child.geometry.computeBoundingSphere();
        }
        
        // Optimize materials
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.4;
          child.material.metalness = 0.8;
          
          // Lower texture quality for non-interactive mode
          if (!interactive && child.material.map) {
            child.material.map.minFilter = THREE.LinearFilter;
            child.material.map.generateMipmaps = false;
          }
        }
      }
    });

    // Position the model based on type
    if (url.includes("kona.glb")) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = 1.0 / maxDim;
      scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      box.setFromObject(scene);
      box.getCenter(center);
      scene.position.x -= center.x;
      scene.position.y -= center.y;
      scene.position.z -= center.z;
      scene.position.y -= 0.2;
    } else {
      scene.position.set(0, -0.3, 0);
    }

    // Proper cleanup when component unmounts
    return () => {
      if (modelRef.current) {
        // Recursively dispose of all resources
        modelRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
              } else {
                disposeMaterial(object.material);
              }
            }
          }
        });
        
        // Remove from scene
        if (groupRef.current) {
          groupRef.current.remove(modelRef.current);
        }
        
        modelRef.current = null;
      }
    };
  }, [scene, url, interactive]);

  // Helper function to dispose of materials with proper type checks
  const disposeMaterial = (material: THREE.Material) => {
    // Handle MeshStandardMaterial specifically
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) material.map.dispose();
      if (material.lightMap) material.lightMap.dispose();
      if (material.bumpMap) material.bumpMap.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
      if (material.metalnessMap) material.metalnessMap.dispose();
      if (material.roughnessMap) material.roughnessMap.dispose();
    }
    // Handle MeshBasicMaterial
    else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.map) material.map.dispose();
      if (material.lightMap) material.lightMap.dispose();
      if (material.specularMap) material.specularMap.dispose();
    }
    // Handle other material types as needed
    
    // Always dispose the material itself
    material.dispose();
  };

  return scene ? <primitive ref={groupRef} object={scene} /> : null;
}

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
  );
});
CameraSetup.displayName = "CameraSetup";

/* -------------------------------------
   Lights & ambient - memoized for performance
------------------------------------- */
const SceneLighting = memo(() => {
  // Optimize shadow maps only when needed
  const shadowMapSize = 512;
  
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
  );
});
SceneLighting.displayName = "SceneLighting";

/* -------------------------------------
   Optional PostProcessing - optimized for performance
------------------------------------- */
const PostProcessing = memo(({ interactive }: { interactive: boolean }) => {
  // Skip expensive effects for non-interactive mode
  if (!interactive) return null;
  
  return (
    <EffectComposer multisampling={2} enabled={interactive} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={8} // Reduced for better performance
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
  );
});
PostProcessing.displayName = "PostProcessing";

/* -------------------------------------
   Preloading logic with improved cache
------------------------------------- */
interface ModelCacheEntry {
  lastUsed: number;
  isLoaded: boolean;
  refCount: number;
  loadedModel?: any; // Store reference to loaded model
}

const modelsCache = new Map<string, ModelCacheEntry>();

// Memory budget monitoring
let estimatedMemoryUsage = 0;
const MEMORY_BUDGET = 100 * 1024 * 1024; // 100MB

// Force cleanup of old models
function cleanupUnusedModels(exceptUrl?: string) {
  const now = Date.now();
  const TIMEOUT = 60 * 1000; // 1 minute timeout
  
  let entriesRemoved = 0;
  
  modelsCache.forEach((entry, url) => {
    // Skip the current model
    if (url === exceptUrl) return;
    
    // If not used recently and refCount is 0, remove it
    if (entry.refCount <= 0 && now - entry.lastUsed > TIMEOUT) {
      try {
        // Use our cached reference to the model if available
        if (entry.loadedModel && entry.loadedModel.scene) {
          // Properly dispose resources
          entry.loadedModel.scene.traverse((object: any) => {
            if (object instanceof THREE.Mesh) {
              if (object.geometry) object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) {
                  object.material.forEach((material: any) => {
                    if (material instanceof THREE.Material) {
                      material.dispose();
                    }
                  });
                } else if (object.material instanceof THREE.Material) {
                  object.material.dispose();
                }
              }
            }
          });
        }
        
        // Remove from our cache
        modelsCache.delete(url);
        entriesRemoved++;
        
        // Reduce estimated memory
        estimatedMemoryUsage -= 10 * 1024 * 1024; // Estimate 10MB per model
      } catch (err) {
        console.warn("Failed to clean up model:", url, err);
      }
    }
  });
  
  if (entriesRemoved > 0) {
    console.debug(`Cleaned up ${entriesRemoved} unused models`);
  }
}

/* -------------------------------------
   Main Car3DViewer component - optimized
------------------------------------- */
function Car3DViewer({
  modelUrl,
  imageUrl,
  width = "100%",
  height = "300px",
  isVisible = true,
  interactive = false,
}: Car3DViewerProps) {
  const finalImageUrl = imageUrl ?? "/cars/fallback.png";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Track if model is properly loaded
  const [isModelReady, setIsModelReady] = useState(false);
  
  // Monitor for context loss
  useEffect(() => {
    const handleContextLost = () => {
      console.warn("WebGL context lost");
    };
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      
      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
      };
    }
  }, [canvasRef]);
  
  // Intelligent model preloading with memory management
  useEffect(() => {
    if (!isVisible) return;
    
    let isMounted = true;
    
    // Check if we should clean cache
    if (estimatedMemoryUsage > MEMORY_BUDGET * 0.8) {
      cleanupUnusedModels(modelUrl);
    }
    
    // Update or create cache entry
    const cacheEntry = modelsCache.get(modelUrl) || { 
      lastUsed: Date.now(), 
      isLoaded: false,
      refCount: 0 
    };
    
    cacheEntry.refCount++;
    cacheEntry.lastUsed = Date.now();
    modelsCache.set(modelUrl, cacheEntry);
    
    if (!cacheEntry.isLoaded) {
      // Preload model if not in cache yet
      try {
        // We can preload but we can't access the cache directly,
        // so we'll store the result in our own cache
        useGLTF.preload(modelUrl);
        estimatedMemoryUsage += 10 * 1024 * 1024; // Estimate 10MB per model
        
        // We'll load it ourselves and store a reference
        const loadModel = async () => {
          try {
            // Load the model and store it in our cache
            const model = await useGLTF(modelUrl);
            cacheEntry.loadedModel = model;
            
            if (isMounted) {
              setIsModelReady(true);
            }
          } catch (err) {
            console.warn("Failed to load model for caching:", err);
          }
        };
        
        loadModel();
        
        // Mark as loaded
        cacheEntry.isLoaded = true;
        modelsCache.set(modelUrl, cacheEntry);
      } catch (err) {
        console.warn("Model preload failed:", err);
      }
    } else {
      // Model is already in cache
      if (isMounted) {
        setIsModelReady(true);
      }
    }
    
    // Cleanup when component unmounts
    return () => {
      isMounted = false;
      
      const entry = modelsCache.get(modelUrl);
      if (entry) {
        entry.refCount--;
        entry.lastUsed = Date.now();
        modelsCache.set(modelUrl, entry);
      }
    };
  }, [modelUrl, isVisible]);

  // No need to render anything if not visible
  if (!isVisible) return null;

  // Memoize container styles
  const containerStyles = useMemo<React.CSSProperties>(
    () => ({ 
      width, 
      height, 
      overflow: "hidden", 
      position: "relative",
      contain: "strict", // Isolate rendering for performance
      willChange: interactive ? "transform" : "auto", // Optimize for GPU
    }),
    [width, height, interactive]
  );

  return (
    <div style={containerStyles}>
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: interactive, // Disable antialiasing when not interactive for performance
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.8,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          premultipliedAlpha: true,
          logarithmicDepthBuffer: false,
        }}
        shadows={interactive} // Only enable shadows in interactive mode
        camera={{ position: [0, 2, 3], fov: 15 }}
        dpr={interactive ? [1, 1.5] : [1, 1]} // Lower resolution for non-interactive mode
        frameloop={interactive ? "always" : "demand"} // Only animate when needed
        style={{ 
          touchAction: "none", // Better touch handling
          outline: "none", // No focus outline
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
  );
}

// Optimize with memo to prevent unnecessary re-renders
export default memo(Car3DViewer, (prevProps, nextProps) => {
  // Custom comparison function to determine if re-render is needed
  return (
    prevProps.modelUrl === nextProps.modelUrl &&
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.interactive === nextProps.interactive &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height
  );
});

// Improved preload function with memory management
export function preloadCarModels(urls: string[]) {
  // Limit how many we preload based on memory budget
  const MAX_PRELOAD = 3;
  const filtered = urls.slice(0, MAX_PRELOAD);
  
  if (estimatedMemoryUsage > MEMORY_BUDGET * 0.5) {
    cleanupUnusedModels();
  }
  
  filtered.forEach((url) => {
    const cacheEntry = modelsCache.get(url) || { 
      lastUsed: Date.now(), 
      isLoaded: false,
      refCount: 0 
    };
    
    if (!cacheEntry.isLoaded) {
      try {
        // Preload but we can't directly access cache
        useGLTF.preload(url);
        estimatedMemoryUsage += 10 * 1024 * 1024; // Estimate 10MB per model
        
        // Load the model and store it in our cache
        const loadModel = async () => {
          try {
            const model = await useGLTF(url);
            cacheEntry.loadedModel = model;
          } catch (err) {
            console.warn("Failed to load model for caching:", err);
          }
        };
        
        loadModel();
        
        cacheEntry.isLoaded = true;
        modelsCache.set(url, cacheEntry);
      } catch (err) {
        console.warn("Preload not available or failed: ", err);
      }
    }
  });
}

// Helper function to dispose of all cached models
export function disposeAllModels() {
  modelsCache.forEach((entry, url) => {
    try {
      if (entry.loadedModel && entry.loadedModel.scene) {
        entry.loadedModel.scene.traverse((object: any) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((material: any) => {
                  if (material instanceof THREE.Material) {
                    material.dispose();
                  }
                });
              } else if (object.material instanceof THREE.Material) {
                object.material.dispose();
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn("Error disposing model:", url, e);
    }
  });
  
  modelsCache.clear();
  estimatedMemoryUsage = 0;
}
