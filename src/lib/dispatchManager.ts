// src/lib/dispatchManager.ts

import { selectAllCars, selectAvailableForDispatch } from "@/store/carSlice";
import {
  selectAllDispatchLocations, 
  selectDispatchRadius,
  selectManualSelectionMode,
} from "@/store/dispatchSlice";
import { useAppSelector } from "@/store/store";
import { useEffect } from "react";

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

export function useAvailableCarsForDispatch() {
  // Still pulling from Redux if you need them, 
  // but no longer performing auto-filtering.
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  
  // In case you want to see the radius or manual mode in logs
  const radiusMeters = useAppSelector(selectDispatchRadius);
  const manualSelectionMode = useAppSelector(selectManualSelectionMode);

  useEffect(() => {
    console.log("[dispatchManager] Auto-filtering has been removed. Returning store's availableCars as-is.");
    console.log(`[dispatchManager] Cars in store: ${cars.length}`);
    console.log(`[dispatchManager] DispatchLocations in store: ${dispatchLocations.length}`);
    console.log(`[dispatchManager] Radius in store: ${radiusMeters} (unused here)`);
    console.log(`[dispatchManager] Manual Selection Mode: ${manualSelectionMode}`);
  }, [cars, dispatchLocations, radiusMeters, manualSelectionMode]);

  return availableCars;
}

// You can either remove this if it’s no longer needed,
// or leave it for other manual usage:
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
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
