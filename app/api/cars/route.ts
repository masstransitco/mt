// File: src/app/api/cars/route.ts

import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";      // Make sure this is your Firebase Admin SDK import
import { fetchVehicleList } from "@/lib/cartrack"; // Your existing function that fetches live vehicles

export async function GET(request: NextRequest) {
  try {
    // 1) Fetch all vehicles from CarTrack
    const vehicles = await fetchVehicleList();

    // 2) Convert to JSON
    const jsonData = JSON.stringify(vehicles, null, 2);

    // 3) Save to Firebase Storage under "cars/fallback.json" (or any path you like)
    //    This effectively creates a fallback directory for lat/long if real-time fetches fail.
    const bucket = admin.storage().bucket();
    const fileRef = bucket.file("cars/fallback.json");
    await fileRef.save(jsonData, {
      metadata: { contentType: "application/json" },
      resumable: false,
    });

    // 4) Return response
    return NextResponse.json({
      success: true,
      message: "Fetched vehicle list and saved to Firebase Storage",
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error: any) {
    console.error("API /cars route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
