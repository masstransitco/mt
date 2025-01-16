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
  image: string;
  available: boolean;
  features: CarFeatures;
}

/** 
 * Add the Message interface so it can be imported from '@/types/booking'.
 * Adjust the fields as needed to match your app’s needs.
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;   // or Date if it's always defined
  reactions?: any[];
  attachments?: any[];
}

/** 
 * If you are also using a Booking interface, include it as well.
 */
export interface Booking {
  carId: number;
  stationId: number;
  departureDate: Date;
  // additional booking fields...
}
