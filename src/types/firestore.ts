/**
 * Firestore data models for the application
 */

import { Car } from './booking';

/**
 * Represents a booking record in Firestore.
 * Used for storing the complete booking information in the 'bookings' collection.
 */
export interface FirestoreBooking {
  // Identifiers
  bookingId: string;
  userId: string;
  
  // Status
  status: 'active' | 'completed' | 'canceled';
  
  // Car details
  carId: number;
  carName: string;
  carType: string;
  carImage: string;
  carModelUrl?: string;
  
  // Station details
  departureStationId: number;
  departureStationName?: string;
  arrivalStationId: number;
  arrivalStationName?: string;
  isQrScanStation?: boolean;
  qrVirtualStationId?: number | null;
  
  // Scheduling details
  departureDateString: string; // ISO date string
  departureTimeString: string; // ISO time string
  isDateTimeConfirmed: boolean;
  
  // Route information
  distance?: number; // in meters
  duration?: number; // in seconds
  polyline?: string; // encoded polyline
  
  // Payment details
  ticketPlan: string | null; // "single" | "paygo"
  amount: number;
  currency: string; // default "hkd"
  paymentMethodId?: string;
  paymentStatus: 'pending' | 'completed' | 'failed' | null;
  paymentReference?: string;
  
  // Timestamps
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  completedAt?: string; // ISO date string
}

/**
 * Represents a user's booking history record.
 * Similar to FirestoreBooking but may contain less detail for historical records.
 */
export interface BookingHistoryRecord {
  bookingId: string;
  userId: string;
  status: 'completed' | 'canceled';
  
  // Basic car info
  carId: number;
  carName: string;
  carType: string;
  
  // Basic station info
  departureStationId: number;
  departureStationName?: string;
  arrivalStationId: number;
  arrivalStationName?: string;
  
  // Basic timing
  departureDateString: string;
  departureTimeString: string;
  
  // Basic payment info
  amount: number;
  currency: string;
  ticketPlan: string | null;
  
  // Timestamps
  createdAt: string;
  completedAt: string;
}

/**
 * Represents the booking data stored in the user's document.
 * This is what gets rehydrated into the Redux state.
 */
export interface UserBookingData {
  step: number;
  stepName: string;
  
  // Scheduling details
  departureDateString: string | null;
  departureTimeString: string | null;
  isDateTimeConfirmed: boolean;
  
  // Station details
  departureStationId: number | null;
  arrivalStationId: number | null;
  isQrScanStation: boolean;
  qrVirtualStationId: number | null;
  
  // Car data
  selectedCarId: number | null;
  selectedCar: Car | null;
  
  // Reference to formal booking
  bookingId: string | null;
  
  // Payment data
  ticketPlan: string | null;
  estimatedCost: number | null;
  paymentStatus: 'pending' | 'completed' | 'failed' | null;
  paymentReference: string | null;
  
  // Route data (if stored)
  route: {
    distance: number;
    duration: number;
    polyline: string;
  } | null;
  
  // Metadata
  lastUpdated: string;
}