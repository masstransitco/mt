import { NextResponse } from 'next/server';
import { Booking } from '@/types/booking';

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings
 * Creates a new booking (car/station/departure date, etc.).
 */
export async function POST(request: Request) {
  try {
    const booking: Booking = await request.json();
    // TODO: Persist booking to DB (e.g. via Prisma, Mongo, PostgreSQL, etc.)
    console.log('Received booking:', booking);

    // Return some confirmation / booking ID
    return NextResponse.json({
      success: true,
      bookingId: 'abc123', // Example placeholder
    });
  } catch (error: any) {
    console.error('Booking API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create booking',
        details: error.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}
