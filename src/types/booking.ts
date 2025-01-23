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

/**
 * Represents a booking record in your system.
 */
export interface Booking {
  carId: number;
  stationId: number;
  departureDate: Date;
  // Add additional fields as needed: returnDate, cost, userId, etc.
}

/**
 * A specialized message interface for the booking domain.
 * Use this if you truly need a different shape from your chat messages.
 */
export interface BookingMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  // If booking messages may not always have a timestamp, make it optional
  timestamp?: Date;
  // Add any booking-specific fields, or remove if not needed
  reactions?: any[];
  attachments?: any[];
}
