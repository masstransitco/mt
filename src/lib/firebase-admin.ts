// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

// Only initialize once
if (!admin.apps.length) {
  // --- If using Option A (SERVICE_ACCOUNT_KEY as one big JSON string) ---
  const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string);

  // Initialize with explicit credentials
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  // --- If you used Option B, do something like ---
  /*
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
  */
}

const db = admin.firestore();
const auth = admin.auth();

export function initializeFirebaseAdmin() {
  return { db, auth };
}
