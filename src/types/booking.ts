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
  image: string;  // strict string type for the image URL
  available: boolean;
  features: CarFeatures;
}

/**
 *  Add a Booking interface here so importing { Booking }
 *  from '@/types/booking' doesn't throw an error.
 */
export interface Booking {
  carId: number;
  stationId: number;
  departureDate: Date;
  // extend with other fields if needed, e.g. user ID, etc.
}
