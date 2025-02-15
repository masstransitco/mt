// src/types/cars.ts

export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

export interface Car {
  // Existing fields
  id: number;
  name: string;
  model: string;
  year: number;
  odometer: number;
  type: string;
  price: number;
  image: string;
  modelUrl?: string;
  available: boolean;
  features: CarFeatures;
  lat: number;
  lng: number;

  // Additional CarTrack fields
  engine_type?: string;
  bearing?: number;
  speed?: number;
  ignition?: boolean;
  idling?: boolean;
  altitude?: number;
  temp1?: number | null;
  dynamic1?: number | null;
  dynamic2?: number | null;
  dynamic3?: number | null;
  dynamic4?: number | null;
  electric_battery_percentage_left?: number | null;
  electric_battery_ts?: string | null;
  location_updated?: string | null;
  location_position_description?: string | null;
}
