// src/lib/firebase-admin.ts
import admin from "firebase-admin";

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

// Export the default references
export const db = admin.firestore();
export const auth = admin.auth();

/**
 * Optional wrapper function to "initialize" if needed
 * (often just having the references above is enough).
 */
export function initializeFirebaseAdmin() {
  return { db, auth };
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
