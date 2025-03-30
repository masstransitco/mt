// app/models/[modelName]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: { modelName: string } }
) {
  // We assume your Draco-compressed GLB is at public/map/NAME.glb
  // e.g. public/map/cursor.glb or public/map/cursor_navigation.glb
  try {
    const filePath = path.join(process.cwd(), "public", "map", `${params.modelName}.glb`);
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        // Adjust cache policy as needed
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(`Error loading model: ${params.modelName}`, err);
    return new NextResponse("Model file not found", { status: 404 });
  }
}