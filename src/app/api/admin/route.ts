// File: src/app/api/admin/route.ts

import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin"; // <-- Where you initialize Firebase Admin

// The Admin SDK can override Firestore rules:
const db = admin.firestore();
const storage = admin.storage();

export async function POST(request: NextRequest) {
  // We'll parse the JSON body to see the operation
  const body = await request.json();
  const { op } = body; // e.g. "fetchUsers", "viewDocument", "approve", "reject", "saveJson"

  try {
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
      default:
        return NextResponse.json({ success: false, error: "Invalid operation" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Admin route error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function handleFetchUsers() {
  const snapshot = await db.collection("users").get();
  const userData = snapshot.docs.map((doc) => ({
    userId: doc.id,
    ...doc.data()
  }));

  // If you only want documents with "id-document" or "driving-license", you could filter here 
  return NextResponse.json({ success: true, users: userData });
}

async function handleViewDocument(userId: string, docType: string) {
  // 1) read user doc from Firestore
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const userData = userDoc.data();
  // 2) read the JSON from Storage if needed
  // Example: "ocrResults/{userId}/{docType}.json"
  try {
    const fileRef = storage.bucket().file(`ocrResults/${userId}/${docType}.json`);
    const [contents] = await fileRef.download();
    const json = JSON.parse(contents.toString());
    return NextResponse.json({ success: true, userData, ocrJson: json });
  } catch (err) {
    // If no JSON file, we can still return the user data
    return NextResponse.json({ success: true, userData, ocrJson: null });
  }
}

async function handleApproveDocument(userId: string, docType: string) {
  await db.collection("users").doc(userId).update({
    [`documents.${docType}.verified`]: true,
    [`documents.${docType}.verifiedAt`]: admin.firestore.Timestamp.now(),
    [`documents.${docType}.rejectionReason`]: null,
    [`documents.${docType}.rejectionDetail`]: null
  });
  return NextResponse.json({ success: true });
}

async function handleRejectDocument(userId: string, docType: string, reason: string) {
  const reasonDescriptions: Record<string, string> = {
    unclear: "The uploaded document is unclear or blurry.",
    mismatch: "Document info doesn't match our records.",
    expired: "The document appears to be expired."
  };

  await db.collection("users").doc(userId).update({
    [`documents.${docType}.verified`]: false,
    [`documents.${docType}.rejectionReason`]: reason,
    [`documents.${docType}.rejectionDetail`]: reasonDescriptions[reason] || "",
    [`documents.${docType}.rejectedAt`]: admin.firestore.Timestamp.now()
  });
  return NextResponse.json({ success: true });
}

async function handleSaveJson(userId: string, docType: string, jsonContent: string) {
  // Write the updated JSON to Storage
  const fileRef = storage.bucket().file(`ocrResults/${userId}/${docType}.json`);
  await fileRef.save(jsonContent, { contentType: "application/json" });
  return NextResponse.json({ success: true });
}
