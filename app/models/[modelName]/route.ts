// app/models/[modelName]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: { modelName: string } }
) {
  console.log(`[models] Request for model: ${params.modelName}`);
  try {
    // Extract the real model name without query parameters
    const modelName = params.modelName.split('?')[0];
    console.log(`[models] Looking for model file: ${modelName}.glb`);
    
    // The models are in public/map folder with .glb extension
    // e.g. public/map/cursor.glb or public/map/cursor_animated.glb or public/map/cursor_navigation.glb
    const filePath = path.join(process.cwd(), "public", "map", `${modelName}.glb`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`Model file not found: ${filePath}`);
      return new NextResponse("Model file not found", { status: 404 });
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    const lastModified = stats.mtime.toUTCString();
    
    // Use a moderate cache policy to allow for updates
    // 1 hour cache with must-revalidate to check if file has changed
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": stats.size.toString(),
        "Last-Modified": lastModified,
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "ETag": `"${stats.size}-${stats.mtime.getTime()}"`,
      },
    });
  } catch (err) {
    console.error(`Error loading model: ${params.modelName}`, err);
    return new NextResponse("Error loading model", { status: 500 });
  }
}