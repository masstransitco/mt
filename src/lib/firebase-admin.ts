import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin if it hasn't been initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: 'masstransitcompany',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: "masstransitcompany.firebasestorage.app",
  });
}

// Export the admin instances
export const db = getFirestore();
export const auth = getAuth();

// Optional: Add initialization status check
export const isInitialized = () => {
  return getApps().length > 0;
};
