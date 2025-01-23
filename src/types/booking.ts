// src/types/booking.ts

/**
 * Represents key features of a car, such as range, charging type, acceleration, etc.
 */
export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

/**
 * A basic Car interface for booking flow.
 */
export interface Car {
  id: number;
  name: string;
  type: string;      // e.g. 'SUV', 'Sedan', 'Electric', etc.
  price: number;
  image: string;
  modelUrl: string;  // 3D model or detailed page link
  available: boolean;
  features: CarFeatures;
}


export interface Booking {
  carId: number;
  stationId: number;
  departureDate: Date;
  // Add additional fields as needed: returnDate, cost, userId, etc.
}
