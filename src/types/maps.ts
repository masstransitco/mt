export interface GMapProps {
  googleApiKey: string;
}

export interface MapErrorBoundaryState {
  hasError: boolean;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
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

export interface StationListItemProps {
  data: StationFeature[];
  index: number;
  style: React.CSSProperties;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapOptions extends google.maps.MapOptions {
  restriction?: {
    latLngBounds: MapBounds;
    strictBounds: boolean;
  };
}
