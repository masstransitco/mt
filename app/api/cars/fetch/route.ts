// File: app/api/cars/fetch/route.ts
import { NextRequest, NextResponse } from "next/server";

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

import admin, { storage } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const bucket = storage.bucket();

    // 1) List all files under "cars/"
    const [files] = await bucket.getFiles({ prefix: "cars/" });

    let allRecords: any[] = [];

    // 2) For each file that ends with .json, download & parse
    for (const file of files) {
      if (file.name.endsWith(".json")) {
        const [contents] = await file.download();
        const data = JSON.parse(contents.toString()); // data is an array
        // 3) Accumulate
        allRecords = allRecords.concat(data);
      }
    }

    // 4) Return the combined array of *all* records
    return NextResponse.json(allRecords);
  } catch (error: any) {
    console.error("/api/cars/fetch error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
