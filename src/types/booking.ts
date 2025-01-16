// src/types/booking.ts
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
  image: string;  // This should be a strict string type
  available: boolean;
  features: CarFeatures;
}
