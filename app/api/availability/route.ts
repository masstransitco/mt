import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin"; // Must point to your Admin SDK init
import { z } from "zod"; // Optional: for input validation

const db = admin.firestore();

// The document where we'll store "availableCarIds"
const DISPATCH_DOC_PATH = "dispatch/global";

export async function GET(request: NextRequest) {
  try {
    // Read the "dispatch/global" document
    const docRef = db.doc(DISPATCH_DOC_PATH);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      // If the document doesn't exist yet, return an empty array or fallback
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod: expect "availableCarIds" to be an array of numbers
    const schema = z.object({
      availableCarIds: z.array(z.number()),
      adminPassword: z.string().optional(),
    });

    const parsed = schema.parse(body);
    const { availableCarIds, adminPassword } = parsed;

    // Check if the user is allowed to do this (basic password check)
    if (adminPassword !== "20230301") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Write to Firestore
    const docRef = db.doc(DISPATCH_DOC_PATH);
    await docRef.set(
      {
        availableCarIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/dispatch/availability error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
