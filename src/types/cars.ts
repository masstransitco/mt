/**
 * Core interfaces for car data
 */
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
  modelUrl?: string;
  available: boolean;
  features: CarFeatures;

  // New fields for mapping / geolocation
  lat: number;
  lng: number;

  // ────────────────────────────────────────────
  // NEW: model, year, odometer
  // ────────────────────────────────────────────
  model: string;
  year: number;
  odometer: number;
}
