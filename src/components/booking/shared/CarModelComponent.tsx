"use client";

import React, { memo } from "react";
import { ParkingSpot } from "./ThreeSceneComponents";
import { FallbackCar } from "./ThreeSceneComponents";
import useModelLoader from "./useModelLoader";
import { normalizeModelUrl } from "@/lib/threeUtils";
import type { Car } from "@/types/cars";

// Individual car model with optimized loading
export const CarModel = memo(({ 
  car, 
  modelUrl, 
  position = [0, 0, 0], 
  isSelected = false 
}: {
  car: Car;
  modelUrl: string;
  position?: [number, number, number];
  isSelected?: boolean;
}) => {
  // Normalize the URL to ensure consistent format
  const normalizedUrl = normalizeModelUrl(modelUrl);
  
  // Use our custom hook for model loading and state management
  const { model, carDimensions, loading, error } = useModelLoader(normalizedUrl, isSelected);
  
  // Show fallback model when loading or error
  if (loading || error) {
    return error ? (
      <group position={position}>
        <FallbackCar />
        {isSelected && <ParkingSpot />}
      </group>
    ) : null;
  }
  
  return (
    <group position={position}>
      {model && <primitive object={model} />}
      {isSelected && <ParkingSpot carDimensions={carDimensions || undefined} />}
    </group>
  );
});
CarModel.displayName = "CarModel";

export default CarModel;