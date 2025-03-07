// File: src/lib/firebase-admin.ts
import admin from "firebase-admin";

// Only initialize once
if (!admin.apps.length) {
  // Option A: Single JSON string in process.env.SERVICE_ACCOUNT_KEY
  if (process.env.SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY as string);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "masstransitcompany.firebasestorage.app", // <-- specify bucket
    });
  } else {
    // Option B: Use separate env variables for projectId, privateKey, clientEmail
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: "masstransitcompany.firebasestorage.app", // <-- specify bucket
    });
  }
}

// Export primary admin references that the app might need
export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage(); // This now uses the default bucket from above

// Optionally export the admin instance itself if needed
export default admin;

/**
 * Optional wrapper function if you want to do further checks, etc.
 */
export function initializeFirebaseAdmin() {
  return { db, auth, storage };
}

/**
 * Example utility to top up a user's balance by a given amount.
 * This uses a Firestore transaction for safety.
 */
export async function topUpUserBalance(userId: string, amount: number): Promise<number> {
  if (amount <= 0) {
    throw new Error("Top-up amount must be greater than 0");
  }

  const userRef = db.collection("users").doc(userId);

  // Safely update within a transaction
  const newBalance = await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new Error("User does not exist");
    }

    const userData = userSnap.data() || {};
    const currentBalance = userData.balance ?? 0;
    const updatedBalance = currentBalance + amount;

    transaction.update(userRef, { balance: updatedBalance });
    return updatedBalance;
  });

  return newBalance;
}
