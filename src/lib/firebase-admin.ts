// src/lib/firebase-admin.ts

import admin from 'firebase-admin';

interface FirebaseAdminInstance {
  db: admin.firestore.Firestore;
  auth: admin.auth.Auth;
}

export function initializeFirebaseAdmin(): FirebaseAdminInstance {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return {
    db: admin.firestore(),
    auth: admin.auth(),
  };
}
