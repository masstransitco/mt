// src/lib/firebase-admin.ts

import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

// Initialize as empty objects to avoid 'undefined' errors
let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

// Interface for our admin services
interface FirebaseAdminServices {
  db: Firestore;
  auth: Auth;
}

/**
 * Initializes Firebase Admin SDK and returns admin services
 * This should only be called on the server side
 */
export function initializeFirebaseAdmin(): FirebaseAdminServices {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK can only be used on the server side');
  }

  try {
    // Dynamic import of firebase-admin
    const admin = require('firebase-admin');

    // Check if already initialized
    if (!admin.apps.length) {
      // Validate required environment variables
      const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
      ];

      const missingEnvVars = requiredEnvVars.filter(
        (varName) => !process.env[varName]
      );

      if (missingEnvVars.length > 0) {
        throw new Error(
          `Missing required Firebase Admin environment variables: ${missingEnvVars.join(
            ', '
          )}`
        );
      }

      // Initialize the admin app
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle escaped newlines in the private key
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        // Optional: Initialize Storage bucket if needed
        ...(process.env.FIREBASE_STORAGE_BUCKET && {
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        }),
      });

      // Initialize services
      adminAuth = admin.auth(adminApp);
      adminDb = admin.firestore(adminApp);

      // Optional: Configure Firestore settings
      adminDb.settings({
        ignoreUndefinedProperties: true,
      });
    } else {
      // If already initialized, get existing instances
      adminApp = admin.app();
      adminAuth = admin.auth();
      adminDb = admin.firestore();
    }

    // Return the admin services
    return {
      db: adminDb,
      auth: adminAuth,
    };
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw new Error(
      `Failed to initialize Firebase Admin: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Utility function to check if Firebase Admin is initialized
 */
export function isFirebaseAdminInitialized(): boolean {
  if (typeof window !== 'undefined') {
    return false;
  }

  try {
    const admin = require('firebase-admin');
    return admin.apps.length > 0;
  } catch {
    return false;
  }
}

/**
 * Safely get admin services without re-initializing
 */
export function getAdminServices(): FirebaseAdminServices | null {
  if (!isFirebaseAdminInitialized()) {
    return null;
  }

  return {
    db: adminDb,
    auth: adminAuth,
  };
}

/**
 * Utility function to verify Firebase Admin environment variables
 * Useful for checking configuration during deployment or startup
 */
export function verifyFirebaseAdminConfig(): {
  isValid: boolean;
  missingVars: string[];
} {
  const requiredVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}
