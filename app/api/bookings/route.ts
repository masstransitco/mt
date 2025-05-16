/**
 * Force this route to run on the Node.js runtime (rather than the Edge runtime),
 * which supports the firebase-admin SDK.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { FirestoreBooking } from '@/types/firestore';

// Initialize Firebase Admin and get Firestore/Auth
const { db, auth } = initializeFirebaseAdmin();

// Helper for error responses
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Helper for success responses
function successResponse(data: any) {
  return NextResponse.json({ success: true, ...data });
}

// Auth middleware to verify the user's Firebase ID token
async function verifyAuth(req: NextRequest) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization token');
  }

  // Extract the token from the header
  const token = authHeader.split('Bearer ')[1];
  // Verify with Firebase Admin
  const decodedToken = await auth.verifyIdToken(token);
  return decodedToken.uid;
}

/**
 * POST /api/bookings
 * Creates a new booking record in the bookings collection.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the user's Firebase token
    const authenticatedUserId = await verifyAuth(request);
    
    // Parse the request body
    const {
      userId,
      carId,
      carName,
      carType,
      carImage,
      carModelUrl,
      departureStationId,
      departureStationName,
      arrivalStationId,
      arrivalStationName,
      departureDateString,
      departureTimeString,
      isDateTimeConfirmed,
      isQrScanStation,
      qrVirtualStationId,
      ticketPlan,
      amount,
      distance,
      duration,
      polyline,
    } = await request.json();
    
    // Basic validation
    if (!userId || !carId || !departureStationId || !arrivalStationId || 
        !departureDateString || !departureTimeString) {
      return errorResponse('Missing required booking information', 400);
    }
    
    // Ensure the authenticated user matches the userId in the request
    if (authenticatedUserId !== userId) {
      return errorResponse('User ID mismatch. Authorization failed.', 403);
    }
    
    // Create a new booking document in Firestore
    const bookingRef = db.collection('bookings').doc();
    const bookingId = bookingRef.id;
    
    const timestamp = new Date().toISOString();
    
    const bookingData: FirestoreBooking = {
      bookingId,
      userId,
      status: 'active',
      
      // Car details
      carId,
      carName,
      carType,
      carImage,
      carModelUrl,
      
      // Station details
      departureStationId,
      departureStationName,
      arrivalStationId,
      arrivalStationName,
      isQrScanStation,
      qrVirtualStationId,
      
      // Scheduling details
      departureDateString,
      departureTimeString,
      isDateTimeConfirmed: !!isDateTimeConfirmed,
      
      // Route information
      distance,
      duration,
      polyline,
      
      // Payment details
      ticketPlan: ticketPlan || null,
      amount: amount || 0,
      currency: 'hkd',
      paymentStatus: 'pending',
      
      // Timestamps
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    
    // Save the booking to Firestore
    await bookingRef.set(bookingData);
    
    // Also update the user's document with a reference to this booking
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      'booking.bookingId': bookingId,
      updatedAt: timestamp,
    });
    
    return successResponse({
      bookingId,
      message: 'Booking created successfully',
    });
  } catch (error: any) {
    console.error('Booking API Error:', error);
    
    if (error.message?.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
        details: error.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bookings
 * Gets a user's booking details or booking history.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the user's Firebase token
    const authenticatedUserId = await verifyAuth(request);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const bookingId = searchParams.get('bookingId');
    const getHistory = searchParams.get('history') === 'true';
    
    // Basic validation
    if (!userId) {
      return errorResponse('Missing required userId parameter', 400);
    }
    
    // Ensure the authenticated user matches the userId parameter
    if (authenticatedUserId !== userId) {
      return errorResponse('User ID mismatch. Authorization failed.', 403);
    }
    
    // Get a specific booking
    if (bookingId) {
      const bookingRef = db.collection('bookings').doc(bookingId);
      const bookingSnap = await bookingRef.get();
      
      if (!bookingSnap.exists) {
        return errorResponse('Booking not found', 404);
      }
      
      const bookingData = bookingSnap.data() as FirestoreBooking;
      
      // Ensure the booking belongs to the authenticated user
      if (bookingData.userId !== authenticatedUserId) {
        return errorResponse('Unauthorized access to booking', 403);
      }
      
      return successResponse({ booking: bookingData });
    }
    
    // Get booking history
    if (getHistory) {
      const historyRef = db.collection(`users/${userId}/bookingHistory`);
      const historySnap = await historyRef.orderBy('createdAt', 'desc').limit(20).get();
      
      const bookings: any[] = [];
      historySnap.forEach((doc: any) => {
        bookings.push(doc.data());
      });
      
      return successResponse({ bookings });
    }
    
    // Get active booking from the user document
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      return errorResponse('User not found', 404);
    }
    
    const userData = userSnap.data() || {};
    const activeBookingId = userData.booking?.bookingId;
    
    if (!activeBookingId) {
      return successResponse({ booking: null, message: 'No active booking found' });
    }
    
    // Fetch the full booking data from the bookings collection
    const activeBookingRef = db.collection('bookings').doc(activeBookingId);
    const activeBookingSnap = await activeBookingRef.get();
    
    if (!activeBookingSnap.exists) {
      return successResponse({ booking: null, message: 'Referenced booking not found' });
    }
    
    return successResponse({ booking: activeBookingSnap.data() });
  } catch (error: any) {
    console.error('Booking API Error:', error);
    
    if (error.message?.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve booking',
        details: error.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}
