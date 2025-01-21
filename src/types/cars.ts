// src/types/cars.ts
export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

export interface Car {
  id: number;
  name: string;
  type: string;
  price: number;
  image: string;      // Keep existing image field
  modelUrl: string;
  available: boolean;
  features: CarFeatures;
  placeholderUrl?: string; // Add optional placeholder for graceful fallback
}
