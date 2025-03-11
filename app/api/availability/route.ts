import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin"; // Ensure your path is correct
import { z } from "zod";

const db = admin.firestore();

// The document where we'll store "availableCarIds"
const DISPATCH_DOC_PATH = "dispatch/global";

export async function GET(request: NextRequest) {
  try {
    // Read the "dispatch/global" document
    const docRef = db.doc(DISPATCH_DOC_PATH);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      // If the document doesn't exist yet, return an empty array
      return NextResponse.json({ availableCarIds: [], success: true });
    }

    const data = snapshot.data() ?? {};
    const availableCarIds: number[] = data.availableCarIds ?? [];

    return NextResponse.json({
      success: true,
      availableCarIds,
    });
  } catch (error: any) {
    console.error("GET /api/dispatch/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Common function to update availability in Firestore
async function updateAvailability(body: unknown) {
  // Validate the body using Zod
  const schema = z.object({
    availableCarIds: z.array(z.number()),
    adminPassword: z.string().optional(),
  });
  const parsed = schema.parse(body);
  const { availableCarIds, adminPassword } = parsed;

  // Simple auth check
  if (adminPassword !== "20230301") {
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ success: true });
}

// Support PATCH method
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    return await updateAvailability(body);
  } catch (error: any) {
    console.error("PATCH /api/dispatch/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support POST (in case your deployment prefers it)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return await updateAvailability(body);
  } catch (error: any) {
    console.error("POST /api/dispatch/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
