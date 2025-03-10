// src/lib/stationUtils.ts

import type { Car } from '@/types/cars';
import type { StationFeature } from '@/store/stationsSlice';

/**
 * Creates a virtual "station" from a car's location
 * to use as a departure point in the booking flow
 */
export function createVirtualStationFromCar(car: Car, virtualId: number): StationFeature {
  return {
    type: "Feature",
    id: virtualId,
    geometry: {
      type: "Point",
      coordinates: [car.lng, car.lat] // GeoJSON uses [longitude, latitude]
    },
    properties: {
      walkTime: 0, // It's right there
      Place: `Car ${car.name}`,
      Address: car.location_position_description || "Current location",
      maxPower: 0,
      totalSpots: 1,
      availableSpots: 1,
      ObjectId: virtualId,
      drivingTime: 0,
      isVirtualCarLocation: true, // Mark this as a special virtual station
      carId: car.id // Reference to the car for easier lookup
    },
    distance: 0, // It's right there
    walkTime: 0, // It's right there
    drivingTime: 0
  };
}

/**
 * Adds a virtual station to the stations array
 * The new station is based on a car's location
 */
export function addVirtualCarStation(
  stations: StationFeature[], 
  car: Car,
  virtualId = 1000000 + car.id // Default ID calculation
): StationFeature[] {
  const virtualStation = createVirtualStationFromCar(car, virtualId);
  
  // Check if we already have this virtual station (by ID)
  const existingIndex = stations.findIndex(s => s.id === virtualId);
  
  if (existingIndex >= 0) {
    // Update the existing virtual station
    const updatedStations = [...stations];
    updatedStations[existingIndex] = virtualStation;
    return updatedStations;
  } else {
    // Add the new virtual station
    return [...stations, virtualStation];
  }
}
