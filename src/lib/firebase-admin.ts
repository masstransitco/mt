// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

// Only initialize the app once in case it’s already initialized.
if (!admin.apps.length) {
  // If you have a service account, you could do something like:
  // admin.initializeApp({
  //   credential: admin.credential.cert({
  //     projectId: process.env.FIREBASE_PROJECT_ID,
  //     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  //     privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  //   }),
  //   databaseURL: process.env.FIREBASE_DATABASE_URL,
  // });
  // Otherwise, for simple use, admin.initializeApp() might be enough:
  admin.initializeApp();
}

// Export the Admin services you need
const db = admin.firestore();
const auth = admin.auth();

/**
 * Initialize (or reuse) the Firebase Admin services. 
 * Called in server routes only.
 */
export function initializeFirebaseAdmin() {
  return { db, auth };
}
