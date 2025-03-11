// src/lib/dispatchManager.ts
import { selectAllCars, setAvailableForDispatch, selectAvailableForDispatch } from "@/store/carSlice";
import { 
  selectAllDispatchLocations, 
  selectDispatchRadius,
  selectManualSelectionMode,  // New selector for manual mode
} from "@/store/dispatchSlice";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { useEffect } from "react";

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

export function useAvailableCarsForDispatch() {
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  const dispatch = useAppDispatch();
  
  // Get radius from Redux with fallback
  const radiusMeters = useAppSelector(selectDispatchRadius);
  
  // Get manual selection mode flag - if true, we respect manual selections
  const manualSelectionMode = useAppSelector(selectManualSelectionMode);

  useEffect(() => {
    // Skip automatic filtering if in manual selection mode
    if (manualSelectionMode) {
      console.log(`[dispatchManager] In manual selection mode - skipping automatic filtering`);
      return;
    }
    
    // Debug information about received data
    console.log(`[dispatchManager] Cars available: ${cars.length}`);
    console.log(`[dispatchManager] Dispatch locations: ${dispatchLocations.length}`);
    console.log(`[dispatchManager] Using radius: ${radiusMeters} meters`);

    // Check if we have valid car coordinates
    const invalidCars = cars.filter(car => typeof car.lat !== 'number' || typeof car.lng !== 'number');
    if (invalidCars.length > 0) {
      console.warn(`[dispatchManager] Found ${invalidCars.length} cars with invalid coordinates:`, 
        invalidCars.map(c => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng })));
    }

    // Check if we have valid dispatch locations
    const invalidLocations = dispatchLocations.filter(loc => typeof loc.lat !== 'number' || typeof loc.lng !== 'number');
    if (invalidLocations.length > 0) {
      console.warn(`[dispatchManager] Found ${invalidLocations.length} dispatch locations with invalid coordinates:`, invalidLocations);
    }

    // Handle the edge case where we have no dispatch locations
    if (dispatchLocations.length === 0) {
      console.warn("[dispatchManager] No dispatch locations available - cars won't be filtered correctly");
      
      // Option 2: Return no cars if no dispatch locations (current behavior)
      dispatch(setAvailableForDispatch([]));
      return;
    }

    // Filter available cars with detailed logging
    let filteredCount = 0;
    const availableCars = cars.filter((car) => {
      // Safety check for invalid car coordinates
      if (typeof car.lat !== 'number' || typeof car.lng !== 'number') {
        return false;
      }
      
      // For debugging, collect all distance calculations for this car
      const distances = dispatchLocations.map(dispatchLoc => {
        return {
          dispatchId: dispatchLoc.id,
          distance: calculateDistance(car.lat, car.lng, dispatchLoc.lat, dispatchLoc.lng)
        };
      });
      
      // Find the minimum distance to any dispatch location
      const minDistance = Math.min(...distances.map(d => d.distance));
      const closestDispatch = distances.find(d => d.distance === minDistance);
      
      // Log detailed info about this car's proximity
      if (minDistance <= radiusMeters) {
        console.log(`[dispatchManager] Car ${car.name} (ID: ${car.id}) is within range: ${minDistance.toFixed(2)}m to dispatch ${closestDispatch?.dispatchId}`);
        filteredCount++;
        return true;
      } else if (cars.length < 10) { // Only log details for small car lists to avoid console spam
        console.log(`[dispatchManager] Car ${car.name} (ID: ${car.id}) is out of range: ${minDistance.toFixed(2)}m to closest dispatch`);
      }
      
      return false;
    });

    console.log(`[dispatchManager] Filtered ${filteredCount} out of ${cars.length} total cars (radius: ${radiusMeters}m)`);
    
    // Only update if not in manual mode
    if (!manualSelectionMode) {
      dispatch(setAvailableForDispatch(availableCars));
    }
  }, [cars, dispatchLocations, radiusMeters, dispatch, manualSelectionMode]); // Add manualSelectionMode to dependency array

  return useAppSelector(selectAvailableForDispatch);
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  // Handle invalid coordinates
  if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lng2 !== 'number') {
    console.error(`[dispatchManager] Invalid coordinates in distance calculation: (${lat1}, ${lng1}) to (${lat2}, ${lng2})`);
    return Number.MAX_SAFE_INTEGER; // Return a large value to exclude this car
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
