// src/lib/dispatchManager.ts
import { selectAllCars, selectAvailableForDispatch, setAvailableForDispatch } from "@/store/carSlice";
import {
  selectAllDispatchLocations, 
  selectDispatchRadius,
  selectManualSelectionMode,
} from "@/store/dispatchSlice";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { useEffect } from "react";

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

export function useAvailableCarsForDispatch() {
  const dispatch = useAppDispatch();
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  const radiusMeters = useAppSelector(selectDispatchRadius);
  const manualSelectionMode = useAppSelector(selectManualSelectionMode);

  useEffect(() => {
    // Only perform auto-filtering if NOT in manual mode
    if (!manualSelectionMode && cars.length > 0 && dispatchLocations.length > 0) {
      console.log("[dispatchManager] Auto-filtering cars within radius:", radiusMeters);
      
      // Filter cars based on radius
      const filteredCars = cars.filter((car) => {
        return dispatchLocations.some((loc) => {
          const distance = calculateDistance(car.lat, car.lng, loc.lat, loc.lng);
          return distance <= radiusMeters;
        });
      });
      
      console.log(`[dispatchManager] Auto-filtered ${filteredCars.length} cars within ${radiusMeters}m radius`);
      
      // Only update if the filtered list is different
      if (JSON.stringify(filteredCars.map(c => c.id)) !== 
          JSON.stringify(availableCars.map(c => c.id))) {
        dispatch(setAvailableForDispatch(filteredCars));
      }
    } else {
      console.log(`[dispatchManager] In manual mode (${manualSelectionMode}), returning store's availableCars as-is (${availableCars.length} cars).`);
    }
  }, [cars, dispatchLocations, radiusMeters, manualSelectionMode, dispatch, availableCars]);
  
  return availableCars;
}

// Helper function for distance calculation
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  if (
    typeof lat1 !== "number" ||
    typeof lng1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lng2 !== "number"
  ) {
    console.error(
      `[dispatchManager] Invalid coordinates in distance calculation: (${lat1}, ${lng1}) to (${lat2}, ${lng2})`
    );
    return Number.MAX_SAFE_INTEGER;
  }
  
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
