"use client"

import React, { useRef, useEffect, memo, useState, useCallback, useMemo } from "react"
import * as THREE from "three"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from '@react-three/drei'
import { VEHICLE_DIMENSIONS, getOptimalDPR, normalizeModelUrl, useIsClient, cleanupThreeResources } from "@/lib/threeUtils"
import ModelManager from "@/lib/modelManager"
import { SceneSetup, CameraController } from "./shared/ThreeSceneComponents"
import { CarModel } from "./shared/CarModelComponent"
import type { Car } from "@/types/cars"
import { CarSceneFallback } from "./SimpleFallback"

// Main component interface
interface Car3DViewerProps {
  modelUrl: string;
  width?: string | number;
  height?: string | number;
  isVisible?: boolean;
  interactive?: boolean;
  backgroundColor?: string;
  car?: Car | null;
}

// Component for client-side rendering
function Car3DViewerClient({
  modelUrl = "/cars/defaultModel.glb",
  width = "100%",
  height = "100%",
  isVisible = true,
  interactive = false,
  backgroundColor = "transparent",
  car = null
}: Car3DViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera position state
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([5, 2.5, 5]);
  const [lookAtOffset, setLookAtOffset] = useState<[number, number, number]>([-2, 0.5, -2]);
  
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Normalize the model URL
  const normalizedModelUrl = useMemo(() => {
    return normalizeModelUrl(modelUrl || '/cars/defaultModel.glb');
  }, [modelUrl]);
  
  // Preload models and handle cleanup on unmount
  useEffect(() => {
    if (!isVisible) return;
    
    try {
      const modelManager = ModelManager.getInstance();
      if (modelManager) {
        // Always preload default model
        modelManager.preloadModels(["/cars/defaultModel.glb"]);
        
        // If a specific model is requested, preload that too
        if (normalizedModelUrl && normalizedModelUrl !== "/cars/defaultModel.glb") {
          modelManager.preloadModels([normalizedModelUrl]);
        }
      }
    } catch (error) {
      console.warn('Error preloading models:', error);
    }
    
    // Cleanup on unmount
    return () => {
      try {
        const modelManager = ModelManager.getInstance();
        if (modelManager) {
          // Release resources by calling the release model function
          modelManager.releaseModel("/cars/defaultModel.glb");
          
          if (normalizedModelUrl && normalizedModelUrl !== "/cars/defaultModel.glb") {
            modelManager.releaseModel(normalizedModelUrl);
          }
          
          // Clean any models that haven't been used in the last 30 seconds
          modelManager.cleanUnusedModels(30000);
        }
      } catch (error) {
        console.warn('Error cleaning up models:', error);
      }
    };
  }, [isVisible, normalizedModelUrl]);
  
  // Prevent event propagation to avoid sheet drag conflicts
  const preventSheetDrag = useCallback((e: React.TouchEvent | React.PointerEvent) => {
    e.stopPropagation();
  }, []);
  
  // Animation complete callback
  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
  }, []);

  // If component is not visible, don't render anything
  if (!isVisible) return null;
  
  return (
    <div
      className="h-full w-full relative overflow-hidden three-d-scene"
      style={{
        width,
        height,
        touchAction: "none",
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
      }}
      onPointerDown={preventSheetDrag}
      onTouchStart={preventSheetDrag}
      onTouchMove={preventSheetDrag}
    >
      <Canvas
        ref={canvasRef}
        gl={{
          antialias: true,
          powerPreference: interactive ? "high-performance" : "default",
          depth: true,
          alpha: backgroundColor === "transparent",
          preserveDrawingBuffer: true,
        }}
        shadows={interactive}
        camera={{
          position: [cameraPosition[0], cameraPosition[1], cameraPosition[2]],
          fov: interactive ? 25 : 20,
          near: 0.1,
          far: 200,
        }}
        dpr={getOptimalDPR(interactive)}
        frameloop="always"
        style={{
          width: "100%",
          height: "100%",
          backgroundColor,
          touchAction: "none",
        }}
      >
        {/* Controls - only enabled in interactive mode */}
        <OrbitControls
          enableDamping={interactive}
          dampingFactor={0.1}
          enableZoom={interactive}
          enableRotate={interactive}
          zoomSpeed={0.5}
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          rotateSpeed={0.5}
          autoRotate={interactive}
          autoRotateSpeed={0.3}
          minDistance={3}
          maxDistance={8}
        />
      
        {/* Scene setup with lighting and environment */}
        <SceneSetup interactive={interactive}>
          {/* CarModel from shared component for consistency */}
          <CarModel 
            car={car || {
              id: 0,
              name: "Default Car",
              type: "EV",
              price: 0,
              available: true,
              features: {
                range: 300,
                charging: "Fast",
                acceleration: "Quick"
              },
              lat: 0,
              lng: 0,
              modelUrl: normalizedModelUrl
            }}
            modelUrl={normalizedModelUrl}
            position={[0, 0, 0]}
            isSelected={true}
          />
          
          {/* Camera controller for animations */}
          <CameraController
            targetPosition={cameraPosition}
            lookAtOffset={lookAtOffset}
            onAnimationComplete={handleAnimationComplete}
          />
        </SceneSetup>
      </Canvas>

      {/* UI overlay only shown in interactive mode */}
      {interactive && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full text-white text-xs">
            Click and drag to rotate • Scroll to zoom
          </div>
        </div>
      )}
    </div>
  );
}

// Main component with SSR handling
function Car3DViewer(props: Car3DViewerProps) {
  // Check if we're in a browser environment
  const isClient = useIsClient();
  
  // For server-side rendering, show a placeholder
  if (!isClient) {
    return (
      <div 
        style={{
          width: props.width || "100%",
          height: props.height || "100%",
          backgroundColor: props.backgroundColor !== 'transparent' 
            ? props.backgroundColor 
            : undefined,
        }} 
        className="flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg"
      >
        <CarSceneFallback message="Loading 3D viewer..." />
      </div>
    );
  }
  
  // Clean up THREE.js resources when component unmounts
  useEffect(() => {
    return () => {
      // The cleanup runs when component is unmounted from the page
      // This prevents memory leaks between page navigations
      cleanupThreeResources();
    };
  }, []);
  
  // On client, render the full component
  return <Car3DViewerClient {...props} />;
}

// Export with memoization for better performance
export default memo(Car3DViewer, (prev, next) => {
  // Only re-render when these critical props change
  return (
    prev.modelUrl === next.modelUrl &&
    prev.isVisible === next.isVisible &&
    prev.interactive === next.interactive &&
    prev.car?.id === next.car?.id
  );
});