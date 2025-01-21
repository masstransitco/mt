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
  image: string;
  modelUrl: string;
  placeholderUrl: string; // Added this field
  available: boolean;
  features: CarFeatures;
}

// Additional type utilities
export type CarId = number;

export const CAR_TYPES = ['Electric', 'LPG', 'Hybrid'] as const;
export type CarType = typeof CAR_TYPES[number];
