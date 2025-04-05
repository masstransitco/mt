// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

import { db } from "@/lib/firebase-admin"; // Import db directly instead of admin
import { z } from "zod";

const DISPATCH_DOC_PATH = "dispatch/global";

// Cache data with TTL
let cachedData: {
  availableCarIds: number[];
  timestamp: number;
} = {
  availableCarIds: [],
  timestamp: 0
};

const CACHE_TTL = 15000; // 15 seconds

/**
 * GET /api/availability
 * Optimized with in-memory caching and proper cache control headers
 */
export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if available and fresh
    if (cachedData.timestamp > 0 && now - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json(
        { 
          success: true, 
          availableCarIds: cachedData.availableCarIds,
          fromCache: true
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=15, s-maxage=15',
            'X-Cache-Hit': 'true'
          }
        }
      );
    }
    
    // Read from Firestore if cache is stale or empty
    const docRef = db.doc(DISPATCH_DOC_PATH);
    const snapshot = await docRef.get();
    
    if (!snapshot.exists) {
      // If the document doesn't exist yet, return an empty array
      cachedData = {
        availableCarIds: [],
        timestamp: now
      };
      
      return NextResponse.json(
        { success: true, availableCarIds: [] },
        { 
          headers: {
            'Cache-Control': 'public, max-age=15, s-maxage=15', 
          }
        }
      );
    }
    
    const data = snapshot.data() ?? {};
    const availableCarIds: number[] = data.availableCarIds ?? [];
    
    // Update cache
    cachedData = {
      availableCarIds,
      timestamp: now
    };
    
    return NextResponse.json(
      {
        success: true,
        availableCarIds,
      },
      { 
        headers: {
          'Cache-Control': 'public, max-age=15, s-maxage=15',
        }
      }
    );
  } catch (error: any) {
    console.error("GET /api/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * A helper function to handle updates.
 * Validates incoming JSON and updates Firestore.
 */
async function updateAvailability(body: unknown) {
  // Validate the body using Zod
  const schema = z.object({
    availableCarIds: z.array(z.number()),
    adminPassword: z.string().optional(),
  });
  
  try {
    const parsed = schema.parse(body);
    const { availableCarIds, adminPassword } = parsed;

    // Simple auth check (skip in development mode)
    if (process.env.NODE_ENV !== 'development' && adminPassword !== "20230301") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update Firestore document with availableCarIds
    const docRef = db.doc(DISPATCH_DOC_PATH);
    await docRef.set(
      {
        availableCarIds,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    
    // Reset the cache
    cachedData = {
      availableCarIds,
      timestamp: Date.now()
    };

    return NextResponse.json({ 
      success: true,
      availableCarIds: availableCarIds
    });
  } catch (error: any) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Invalid request" },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/availability
 */
export async function PATCH(req: NextRequest) {
  // Skip processing during build time to avoid JSON parse errors
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: false, error: "API not available during build" });
  }

  try {
    // Try to parse the JSON safely
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    return await updateAvailability(body);
  } catch (error: any) {
    console.error("PATCH /api/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/availability
 */
export async function POST(req: NextRequest) {
  // Skip processing during build time to avoid JSON parse errors
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json({ success: false, error: "API not available during build" });
  }

  try {
    // Try to parse the JSON safely
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    
    return await updateAvailability(body);
  } catch (error: any) {
    console.error("POST /api/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}