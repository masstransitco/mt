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
      waitTime: 0,
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

/**
 * Generates the URL for a car QR code
 * @param registration The car's registration plate
 * @returns The URL for the QR code
 */
export function generateCarQrUrl(registration: string): string {
  return `https://www.masstransitcar.com/${registration.toLowerCase()}`;
}

/**
 * Finds the nearest station to a given car location
 */
export function findNearestStation(car: Car, stations: StationFeature[]): StationFeature | null {
  if (!stations.length) return null;
  
  let nearestStation = stations[0];
  let minDistance = calculateDistance(
    car.lat, car.lng, 
    stations[0].geometry.coordinates[1], stations[0].geometry.coordinates[0]
  );
  
  for (let i = 1; i < stations.length; i++) {
    const station = stations[i];
    const [stationLng, stationLat] = station.geometry.coordinates;
    const distance = calculateDistance(car.lat, car.lng, stationLat, stationLng);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = station;
    }
  }
  
  return nearestStation;
}

/**
 * Calculates the distance between two points in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}
