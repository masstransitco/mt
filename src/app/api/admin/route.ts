import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin"; // We'll create this

export async function GET(request: NextRequest) {
  try {
    // Access admin Firestore from your initialized admin app
    const db = admin.firestore();

    // For example, fetch "users" docs
    const snapshot = await db.collection("users").get();
    const allUsers = snapshot.docs.map((doc) => ({
      userId: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, data: allUsers });
  } catch (err: any) {
    console.error("Admin route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
