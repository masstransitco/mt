import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase-admin"; // Must point to your Admin SDK init
import { z } from "zod";                  // optional: for input validation

const db = admin.firestore();

// The document where we'll store "availableCarIds"
const DISPATCH_DOC_PATH = "dispatch/global";

export async function GET(request: NextRequest) {
  try {
    // Read the "dispatch/global" doc
    const docRef = db.doc(DISPATCH_DOC_PATH);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      // If doc doesn't exist yet, return an empty array or fallback
      return NextResponse.json({ availableCarIds: [], success: true });
    }

    const data = snapshot.data();
    const availableCarIds: number[] = data.availableCarIds || [];

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

    // Optional: validate with Zod or a manual check
    // For instance, expect "availableCarIds" to be an array of numbers
    const schema = z.object({
      availableCarIds: z.array(z.number()),
      adminPassword: z.string().optional(),
    });

    const parsed = schema.parse(body);
    const { availableCarIds, adminPassword } = parsed;

    // 1) Check if user is allowed to do this
    //    If you have an admin password or any auth logic, do it here:
    if (adminPassword !== "20230301") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2) Write to Firestore
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
