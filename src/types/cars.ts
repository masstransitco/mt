// src/types/cars.ts
export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

export interface Car {
  id: number;       // e.g. mapped from vehicle_id
  name: string;     // e.g. mapped from registration
  model: string;    // e.g. mapped from manufacturer
  year: number;     // e.g. mapped from model_year
  odometer: number; // converted from meters to km
  type: string;
  price: number;
  image: string;
  modelUrl?: string;
  available: boolean;
  features: CarFeatures;
  lat: number;
  lng: number;
}
