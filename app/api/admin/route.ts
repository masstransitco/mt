// File: app/api/admin/route.ts

import { NextRequest, NextResponse } from "next/server";
// Add dynamic routing to prevent build-time eval
export const dynamic = "force-dynamic";

// Use db, storage from your firebase-admin helper
import { db, storage } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/admin
 * Receives an operation and adminPassword, then runs the requested handler.
 */
export async function POST(request: NextRequest) {
  // Skip processing during build time
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return NextResponse.json({
      success: false,
      error: "API not available during build",
    });
  }

  try {
    // Parse incoming JSON safely
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { op, adminPassword } = body; // e.g. "fetchUsers", "viewDocument", etc.

    // 1) Simple static password check
    if (adminPassword !== "20230301") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2) Switch on the requested operation
    switch (op) {
      case "fetchUsers":
        return await handleFetchUsers();

      case "viewDocument":
        return await handleViewDocument(body.userId, body.docType);

      case "approveDocument":
        return await handleApproveDocument(body.userId, body.docType);

      case "rejectDocument":
        return await handleRejectDocument(body.userId, body.docType, body.reason);

      case "saveJson":
        return await handleSaveJson(body.userId, body.docType, body.jsonContent);

      // ------------------ ADDRESS OPS ------------------
      case "approveAddress":
        return await handleApproveAddress(body.userId);

      case "rejectAddress":
        return await handleRejectAddress(body.userId, body.reason);

      default:
        return NextResponse.json(
          { success: false, error: "Invalid operation" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Admin route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ---------------- HANDLERS ----------------

async function handleFetchUsers() {
  const snapshot = await db.collection("users").get();
  const userData = snapshot.docs.map((doc) => ({
    userId: doc.id,
    ...doc.data(),
  }));

  // Return them all – filter logic is typically done in the UI.
  return NextResponse.json({ success: true, users: userData });
}

async function handleViewDocument(userId: string, docType: string) {
  // 1) Read user doc from Firestore
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  const userData = userDoc.data() || {};

  // 2) Read the JSON from Cloud Storage if it exists
  try {
    const fileRef = storage.bucket().file(`ocrResults/${userId}/${docType}.json`);
    const [contents] = await fileRef.download();
    const json = JSON.parse(contents.toString());
    return NextResponse.json({ success: true, userData, ocrJson: json });
  } catch {
    // If no JSON file, still return user data
    return NextResponse.json({ success: true, userData, ocrJson: null });
  }
}

async function handleApproveDocument(userId: string, docType: string) {
  await db.collection("users").doc(userId).update({
    [`documents.${docType}.verified`]: true,
    [`documents.${docType}.verifiedAt`]: FieldValue.serverTimestamp(),
    [`documents.${docType}.rejectionReason`]: null,
    [`documents.${docType}.rejectionDetail`]: null,
  });
  return NextResponse.json({ success: true });
}

async function handleRejectDocument(userId: string, docType: string, reason: string) {
  const reasonDescriptions: Record<string, string> = {
    unclear: "The uploaded document is unclear or blurry.",
    mismatch: "Document info doesn't match our records.",
    expired: "The document appears to be expired.",
    // add more if needed
  };

  await db.collection("users").doc(userId).update({
    [`documents.${docType}.verified`]: false,
    [`documents.${docType}.rejectionReason`]: reason,
    [`documents.${docType}.rejectionDetail`]: reasonDescriptions[reason] || "",
    [`documents.${docType}.rejectedAt`]: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ success: true });
}

async function handleSaveJson(userId: string, docType: string, jsonContent: string) {
  try {
    // Validate that jsonContent is valid JSON
    JSON.parse(jsonContent);

    // Write the updated JSON to Cloud Storage
    const fileRef = storage.bucket().file(`ocrResults/${userId}/${docType}.json`);
    await fileRef.save(jsonContent, { contentType: "application/json" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON content provided" },
      { status: 400 }
    );
  }
}

// ------------------ ADDRESS HANDLERS ------------------

async function handleApproveAddress(userId: string) {
  // Mark address as verified, clear any rejection reason
  await db.collection("users").doc(userId).update({
    "documents.address.verified": true,
    "documents.address.rejectionReason": FieldValue.delete(), // or set to null
  });
  return NextResponse.json({ success: true });
}

async function handleRejectAddress(userId: string, reason: string) {
  // Store a reason for rejecting the address
  await db.collection("users").doc(userId).update({
    "documents.address.verified": false,
    "documents.address.rejectionReason": reason,
  });
  return NextResponse.json({ success: true });
}