// Types for GeoJSON Feature structure
export interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];  // [longitude, latitude]
  };
  properties: {
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
  };
  distance?: number;
}

// Type for GeoJSON FeatureCollection
export interface StationsCollection {
  type: 'FeatureCollection';
  features: StationFeature[];
}

// Type for station response with cache timestamp
export interface CachedStationsResponse {
  data: StationFeature[];
  timestamp: number;
}

// Type for station filters
export interface StationFilters {
  minPower?: number;
  maxDistance?: number;
  onlyAvailable: boolean;
}
