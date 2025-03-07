import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";
import { fetchVehicleList } from "@/lib/cartrack";

export async function GET(request: NextRequest) {
  try {
    // 1) Fetch all vehicles from your CarTrack function
    const vehicles = await fetchVehicleList();

    // Prepare the bucket reference
    const bucket = admin.storage().bucket();

    // Use today's date in "YYYY-MM-DD" format
    const today = new Date().toISOString().split("T")[0];

    // 2) For each vehicle, store/append to that vehicle's daily file
    for (const vehicle of vehicles) {
      // We'll use the registration as part of the path
      const reg = vehicle.registration || "unknownReg";

      // Example path: "cars/NY1234/2025-03-07.json"
      const filePath = `cars/${reg}/${today}.json`;
      const fileRef = bucket.file(filePath);

      // Read existing file content if it exists
      const [exists] = await fileRef.exists();
      let existingData: any[] = [];

      if (exists) {
        const [contents] = await fileRef.download();
        existingData = JSON.parse(contents.toString());
      }

      // 3) Append the new record
      //    Optionally attach a "capturedAt" timestamp
      const record = {
        ...vehicle,
        capturedAt: new Date().toISOString(),
      };
      existingData.push(record);

      // 4) Save back to Cloud Storage
      await fileRef.save(JSON.stringify(existingData, null, 2), {
        metadata: { contentType: "application/json" },
        resumable: false,
      });
    }

    // 5) Return a response
    return NextResponse.json({
      success: true,
      message: `Fetched ${vehicles.length} vehicles and saved daily JSON by registration.`,
    });
  } catch (error: any) {
    console.error("API /cars route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
