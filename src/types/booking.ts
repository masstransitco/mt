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
 * A generic Message interface used in the booking context.
 * If this is the same as your "chat" Message, consider importing from '@/types/chat' instead.
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /**
   * If your booking-related messages don't always have a timestamp,
   * make it optional. Otherwise, use `Date` if it's always defined.
   */
  timestamp?: Date;

  /**
   * If you need to track reactions or attachments for booking messages.
   * If not, feel free to remove these fields or refine their type.
   */
  reactions?: any[];
  attachments?: any[];
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
