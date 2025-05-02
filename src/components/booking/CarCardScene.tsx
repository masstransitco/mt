"use client"

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from '@react-three/drei'
import { useAppDispatch, useAppSelector } from "@/store/store"
import { selectCar } from "@/store/userSlice"
import { VEHICLE_DIMENSIONS, getOptimalDPR, normalizeModelUrl, useIsClient, cleanupThreeResources } from "@/lib/threeUtils"
import { ChevronLeft } from "@/components/ui/icons/ChevronLeft"
import { ChevronRight } from "@/components/ui/icons/ChevronRight"
import { CarSeat } from "@/components/ui/icons/CarSeat"
import { BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Gauge, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { Car } from "@/types/cars"
import ModelManager from "@/lib/modelManager"
import { SceneSetup, CameraController } from "./shared/ThreeSceneComponents"
import { CarModel } from "./shared/CarModelComponent"

// Define interface for CarsScene props
interface CarsSceneProps {
  cars: Car[];
  selectedCarId: string | number | undefined | null;
  transitionVersion?: number;
  onAnimationComplete?: () => void;
}

// Main scene with cars
const CarsScene = React.memo(({ 
  cars, 
  selectedCarId,
  transitionVersion = 0, 
  onAnimationComplete
}: CarsSceneProps) => {
  // Get selected index with fallback
  const selectedIndex = useMemo(() => {
    if (!selectedCarId) return 0;
    const index = cars.findIndex(car => car.id === selectedCarId);
    return index >= 0 ? index : 0; // Handle case where selected car is not in list
  }, [cars, selectedCarId]);
  
  // Position cars in a row with fixed spacing
  const carPositions = useMemo((): [number, number, number][] => {
    const spacing = VEHICLE_DIMENSIONS.CAR_SPACING; // Consistent spacing between cars
    return cars.map((_, index) => {
      // Position relative to selected car, perfectly centered
      return [spacing * (index - selectedIndex), 0, 0] as [number, number, number];
    });
  }, [cars, selectedIndex]);
  
  // Enhance camera position with a slight arc motion for transitions
  const cameraPosition = useMemo((): [number, number, number] => {
    const selectedPos = carPositions[selectedIndex] || [0, 0, 0];
    // Position camera for a 3/4 view of the car, adjusted to center in viewport
    return [
      selectedPos[0] + VEHICLE_DIMENSIONS.CAMERA_OFFSET.x, 
      VEHICLE_DIMENSIONS.CAMERA_OFFSET.y, 
      VEHICLE_DIMENSIONS.CAMERA_OFFSET.z
    ];
  }, [carPositions, selectedIndex, transitionVersion]); // Include transitionVersion to force recalculation
  
  // Create a slightly elevated look-at point for transitions
  const lookAtOffset = useMemo((): [number, number, number] => {
    return [-4.5, 0.75, -4.5]; // Look at the car's center, slightly above ground
  }, []);
  
  // Define car elements array
  const carElements = cars.map((car, index) => {
    // Normalize model URL format with consistent fallbacks
    const modelUrl = normalizeModelUrl(car.modelUrl || '');
    
    // Explicitly type the position as [number, number, number]
    const position = carPositions[index] || [0, 0, 0];
    
    return (
      <CarModel 
        key={car.id}
        car={car}
        modelUrl={modelUrl}
        position={position}
        isSelected={car.id === selectedCarId}
      />
    );
  });

  return (
    <SceneSetup interactive={true}>
      {carElements}
      
      {/* Camera Animation Controller - handles transitions */}
      <CameraController 
        key={`camera-controller-${transitionVersion}`} 
        targetPosition={cameraPosition}
        lookAtOffset={lookAtOffset}
        onAnimationComplete={onAnimationComplete}
      />
    </SceneSetup>
  )
})
CarsScene.displayName = "CarsScene"

// Helper function to format "Last driven" time
function formatLastDriven(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never driven"

  try {
    const lastUpdate = new Date(timestamp)
    // Check if date is valid
    if (isNaN(lastUpdate.getTime())) {
      return "Unknown"
    }

    const now = new Date()
    const diffMs = now.getTime() - lastUpdate.getTime()

    // Calculate time units
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`
    } else {
      return "Just now"
    }
  } catch (error) {
    return "Unknown"
  }
}

// Main component props
interface CarCardSceneProps {
  cars: Car[]
  className?: string
  isVisible?: boolean
  height?: string
  onReady?: () => void // Add onReady callback
}

// Server-side placeholder
function Placeholder({ className, height = 'h-60' }: { className?: string, height?: string }) {
  return (
    <div className={`relative w-full ${height} ${className}`}>
      <div className="w-full h-full flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
        <div className="px-4 py-2 bg-black/40 rounded-full text-white/80 text-sm">
          Loading 3D scene...
        </div>
      </div>
    </div>
  )
}

// Client-side component with fixed aspect ratio handling
function CarCardSceneClient({ cars, className = "", isVisible = true, height = 'h-60' }: CarCardSceneProps) {
  const dispatch = useAppDispatch()
  const selectedCarId = useAppSelector(state => state.user.selectedCarId)
  
  // Odometer popup state
  const [showOdometerPopup, setShowOdometerPopup] = useState(false)
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get selected index with a fallback to 0 if car not found
  const selectedIndex = useMemo(() => {
    if (selectedCarId === null || selectedCarId === undefined) return 0;
    const index = cars.findIndex(car => car.id === selectedCarId);
    return index >= 0 ? index : 0;
  }, [cars, selectedCarId])
  
  // Get the selected car object
  const selectedCar = useMemo(() => {
    return cars.find(car => car.id === selectedCarId) || cars[0];
  }, [cars, selectedCarId]);
  
  // Battery info calculation
  const { batteryPercentage, batteryIconColor, BatteryIcon } = useMemo(() => {
    const rawBattery = selectedCar?.electric_battery_percentage_left
    const parsed = rawBattery != null ? Number(rawBattery) : Number.NaN
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90
    let Icon = BatteryFull
    let color = "text-green-500" // Apple-style green
    if (percentage <= 9) {
      Icon = BatteryWarning
      color = "text-red-500"
    } else if (percentage < 40) {
      Icon = BatteryLow
      color = "text-orange-400"
    } else if (percentage < 80) {
      Icon = BatteryMedium
      color = "text-lime-400"
    }
    return { batteryPercentage: percentage, batteryIconColor: color, BatteryIcon: Icon }
  }, [selectedCar]);
  
  // Format last driven time
  const lastDrivenText = useMemo(() => {
    return formatLastDriven(selectedCar?.location_updated);
  }, [selectedCar]);
  
  // Animation state tracking with forced re-render on transitions
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionVersion, setTransitionVersion] = useState(0);
  
  // Track when camera transitions are complete
  const handleAnimationComplete = useCallback(() => {
    console.log('%c ANIMATION COMPLETE CALLBACK', 'background: #e74c3c; color: white; padding: 4px; border-radius: 4px;');
    setIsAnimating(false);
  }, [])
  
  // When selected car changes, update transition version to reposition the camera
  useEffect(() => {
    if (selectedCarId) {
      console.log('%c CAR SELECTION CHANGED', 'background: #f39c12; color: white; padding: 4px; border-radius: 4px;', { 
        selectedCarId
      });
      
      // Set animation state
      setIsAnimating(true);
      
      // Force camera update by incrementing transition version
      setTransitionVersion(prev => prev + 1);
    }
  }, [selectedCarId]);
  
  // Enhanced navigation handlers with animation state and logging
  const goToPrevCar = useCallback(() => {
    if (cars.length <= 1 || isAnimating) {
      console.log('%c PREV CAR BLOCKED', 'background: #7f8c8d; color: white; padding: 4px; border-radius: 4px;', {
        reason: cars.length <= 1 ? 'only one car' : 'animation in progress',
        isAnimating
      });
      return;
    }
    
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : cars.length - 1;
    const nextCar = cars[newIndex];
    
    if (nextCar && nextCar.id && nextCar.id !== selectedCarId) {
      console.log('%c PREV CAR SELECTED', 'background: #9b59b6; color: white; padding: 4px; border-radius: 4px;', {
        from: selectedCarId,
        to: nextCar.id
      });
      setIsAnimating(true);
      dispatch(selectCar(nextCar.id));
    }
  }, [cars, selectedCarId, selectedIndex, dispatch, isAnimating]);
  
  const goToNextCar = useCallback(() => {
    if (cars.length <= 1 || isAnimating) {
      console.log('%c NEXT CAR BLOCKED', 'background: #7f8c8d; color: white; padding: 4px; border-radius: 4px;', {
        reason: cars.length <= 1 ? 'only one car' : 'animation in progress',
        isAnimating
      });
      return;
    }
    
    const newIndex = selectedIndex < cars.length - 1 ? selectedIndex + 1 : 0;
    const nextCar = cars[newIndex];
    
    if (nextCar && nextCar.id && nextCar.id !== selectedCarId) {
      console.log('%c NEXT CAR SELECTED', 'background: #9b59b6; color: white; padding: 4px; border-radius: 4px;', {
        from: selectedCarId,
        to: nextCar.id
      });
      setIsAnimating(true);
      dispatch(selectCar(nextCar.id));
    }
  }, [cars, selectedCarId, selectedIndex, dispatch, isAnimating]);
  
  // Odometer popup toggling
  const handleOdometerClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setShowOdometerPopup((prev) => !prev)
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current)
    popupTimeoutRef.current = setTimeout(() => setShowOdometerPopup(false), 3000)
  }, []);
  
  // Cleanup odometer popup on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current)
    }
  }, []);
  
  // Auto-select first car if none selected
  useEffect(() => {
    if (cars.length > 0 && !selectedCarId) {
      dispatch(selectCar(cars[0].id));
    }
  }, [cars, dispatch, selectedCarId])

  // Preload common car models with proper cleanup
  useEffect(() => {
    if (typeof window === 'undefined' || !isVisible) return;
    
    const modelUrls = ['/cars/defaultModel.glb', '/cars/car2.glb', '/cars/car3.glb', '/cars/car4.glb'];
    
    try {
      const modelManager = ModelManager.getInstance();
      if (modelManager) {
        modelManager.preloadModels(modelUrls);
      }
    } catch (error) {
      console.warn('Error preloading models:', error);
    }
    
    // Cleanup on unmount
    return () => {
      try {
        const modelManager = ModelManager.getInstance();
        if (modelManager) {
          // Release each model
          modelUrls.forEach(url => modelManager.releaseModel(url));
          
          // Clean unused models
          modelManager.cleanUnusedModels(30000);
        }
      } catch (error) {
        console.warn('Error cleaning up models:', error);
      }
    };
  }, [isVisible]);

  // Basic placeholder for initial load
  if (!isVisible || cars.length === 0) {
    return <Placeholder className={className} height={height} />
  }
  
  return (
    <div className={`relative ${height} ${className} overflow-visible w-full`}>
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{
          // Position camera further back and higher for a better elevated view
          position: [8.5, 2.0, 8.5], // Lowered Y position to center car in viewport
          fov: 25, // Narrower FOV for more focus on the car
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true,
          alpha: true,
          stencil: false,
          depth: true,
          powerPreference: "default",
        }}
        style={{ 
          background: "transparent",
          width: "100%", // Force canvas to take full width of parent
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0
        }}
        dpr={getOptimalDPR(true)}
      >
        {/* Controls - User can interact, but camera will return to default */}
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          enableZoom={true}
          enableRotate={true}
          rotateSpeed={0.5}
          enablePan={false}
          minPolarAngle={Math.PI / 5} // Slightly more limit looking from below
          maxPolarAngle={Math.PI / 2.1} // Slightly more limit looking from above
          minAzimuthAngle={-Math.PI / 1.5} // Limit rotation left
          maxAzimuthAngle={Math.PI / 1.5} // Limit rotation right
          minDistance={5} // Don't allow zooming too close (increased)
          maxDistance={12} // Don't allow zooming too far (increased)
          autoRotate={false}
          makeDefault
        />
        
        {/* Car scene */}
        {/* Adjust the position of the scene to center car in viewport */}
      <group position={[0, -0.3, 0]}>
        <CarsScene 
          cars={cars}
          selectedCarId={selectedCarId}
          transitionVersion={transitionVersion}
          onAnimationComplete={handleAnimationComplete}
        />
      </group>
      </Canvas>
      
      {/* Navigation buttons */}
      {cars.length > 1 && (
        <>
          <button
            onClick={goToPrevCar}
            className="absolute top-1/2 left-6 -translate-y-1/2 z-20 h-10 w-10 rounded-full 
                     bg-black/70 backdrop-blur-sm flex items-center justify-center
                     border border-white/20 text-white opacity-80 hover:opacity-100"
            aria-label="Previous car"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={goToNextCar}
            className="absolute top-1/2 right-6 -translate-y-1/2 z-20 h-10 w-10 rounded-full 
                     bg-black/70 backdrop-blur-sm flex items-center justify-center
                     border border-white/20 text-white opacity-80 hover:opacity-100"
            aria-label="Next car"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      
      {/* Indicators */}
      {cars.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center space-x-1.5 z-10">
          {cars.map((car, index) => (
            <button
              key={car.id}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === selectedIndex 
                  ? "bg-white w-2.5" 
                  : "bg-white/40 hover:bg-white/60"
              }`}
              onClick={() => {
                // Skip if same car or already animating
                if (car.id === selectedCarId || isAnimating) {
                  console.log('%c INDICATOR CLICK BLOCKED', 'background: #7f8c8d; color: white; padding: 4px; border-radius: 4px;', {
                    reason: car.id === selectedCarId ? 'same car selected' : 'animation in progress',
                    carId: car.id,
                    isAnimating
                  });
                  return;
                }
                
                // Set animating state and dispatch selection
                console.log('%c INDICATOR CAR SELECTED', 'background: #27ae60; color: white; padding: 4px; border-radius: 4px;', {
                  from: selectedCarId,
                  to: car.id,
                  index
                });
                setIsAnimating(true);
                dispatch(selectCar(car.id));
              }}
              aria-label={`Select ${car.name || car.model || `car ${index + 1}`}`}
            />
          ))}
        </div>
      )}
      
      {/* Car stats indicators - overlaid at bottom of scene, properly spaced from footer */}
      <div className="absolute bottom-12 left-0 right-0 z-30 px-6 flex items-center justify-center gap-3">
        <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
          <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
          <span className="text-xs font-medium text-white">{batteryPercentage}%</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
          <Gauge className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-white">{(batteryPercentage * 3.2).toFixed(0)} km</span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
          <CarSeat className="w-4 h-4 text-gray-300" />
          <span className="text-xs font-medium text-white">1+4</span>
        </div>
      </div>
      
      {/* Top header with model and registration */}
      <div className="absolute top-0 left-0 right-0 z-20 backdrop-blur-md bg-black/50 px-6 py-2 
                    border-b border-white/10 flex items-center justify-between rounded-t-xl">
        <div className="flex-1 min-w-0 pl-4">
          {selectedCarId && (
            <div className="text-white">
              <div className="text-sm font-medium truncate">
                {selectedCar?.model || "Car"}
              </div>
            </div>
          )}
        </div>
        
        {selectedCar?.name && (
          <div className="text-xs font-bold bg-[#FFFFFF] text-black px-3 py-1.5 ml-auto mr-4 shadow-sm flex items-center justify-center min-w-[60px] max-w-[100px] overflow-hidden" style={{ borderRadius: '2px' }}>
            <span className="truncate">
              {selectedCar.name.length >= 3 ? (
                <>
                  {selectedCar.name.slice(0, 2)}
                  <span className="inline-block mx-0.5"></span>
                  {selectedCar.name.slice(2)}
                </>
              ) : (
                selectedCar.name
              )}
            </span>
          </div>
        )}
      </div>

      {/* Car info overlay with last driven info - condensed height */}
      <div className="absolute bottom-0 left-0 right-0 z-40 backdrop-blur-md bg-black/50 px-6 py-2 
                     border-t border-white/10 flex items-center justify-between rounded-b-xl">
        <div className="flex-1 flex items-center gap-1.5 pl-4 min-w-0">
          <div className="relative z-50">
            <span 
              onClick={handleOdometerClick}
              className="cursor-pointer"
            >
              <Clock 
                className="w-3 h-3 text-gray-400 hover:text-white transition-colors"
                size={14}
              />
            </span>
            <AnimatePresence>
              {showOdometerPopup && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute left-0 bottom-4 bg-black/90 text-white text-xs px-3 py-2 rounded-md shadow-xl border border-white/30 z-50 min-w-36 backdrop-blur-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Distance:</span> {selectedCar?.odometer || "N/A"} km
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Year:</span> {selectedCar?.year || "2022"}
                    </div>
                    {selectedCar?.registration && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Reg:</span> {selectedCar.registration}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-2 transform w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="text-xs text-gray-400 text-[10px] truncate">Last driven: {lastDrivenText}</span>
        </div>
        
        <div className="text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full mr-4">
          Ready
        </div>
      </div>
    </div>
  )
}

// Export a component that renders either the client component or a placeholder
export default function CarCardScene(props: CarCardSceneProps) {
  const isClient = useIsClient();
  
  // Add global resource cleanup when unmounting and call onReady
  useEffect(() => {
    // Call onReady callback immediately - this ensures the loading spinner disappears
    if (isClient) {
      console.log("[CarCardScene] Client-side render complete, calling onReady");
      // Call immediately to prevent the spinner from staying indefinitely
      props.onReady?.();
    }
    
    return () => {
      // Run cleanup on component unmount
      cleanupThreeResources();
    };
  }, [isClient, props.onReady]);
  
  if (!isClient) {
    // Don't show placeholder - parent will handle loading UI
    return null;
  }
  
  return <CarCardSceneClient {...props} />
}