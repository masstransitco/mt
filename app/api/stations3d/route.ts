// app/api/stations3d/route.ts

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    // Adjust path as needed if your file is located differently
    const filePath = path.join(process.cwd(), "public", "stations_3d.geojson");

    const fileContents = fs.readFileSync(filePath, "utf8");
    // Return raw JSON text with caching
    return new NextResponse(fileContents, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // set strong caching if the file rarely changes
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Error reading stations_3d.geojson:", err);
    return new NextResponse("Error reading stations_3d.geojson", { status: 404 });
  }
}