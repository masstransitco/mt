// File: src/lib/firebase-admin.ts
import config from '@/config';
import admin from "firebase-admin";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Consolidated initialization function
export function initAdmin() {
  const apps = getApps();
  
  if (apps.length === 0) {
    if (config.SERVICE_ACCOUNT_KEY) {
      try {
        if (config.SERVICE_ACCOUNT_KEY.includes('{')) {
          const serviceAccount = JSON.parse(config.SERVICE_ACCOUNT_KEY);
          if (!serviceAccount.project_id) {
            throw new Error("Service account is missing project_id");
          }
          initializeApp({
            credential: cert(serviceAccount)
          });
        } else {
          throw new Error("Invalid service account key format");
        }
      } catch (error) {
        console.error("Error parsing service account key:", error);
        // Fall back to using individual environment variables
        initializeAppWithEnvVars();
      }
    } else {
      initializeAppWithEnvVars();
    }
  }
  
  return getAuth();
}

function initializeAppWithEnvVars() {
  const projectId = config.FIREBASE_PROJECT_ID;
  const clientEmail = config.FIREBASE_CLIENT_EMAIL;
  const privateKey = config.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing required Firebase configuration environment variables");
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
  });
}

// Mock implementation for development
class MockFirestore {
  private mockData = {
    "dispatch/global": {
      availableCarIds: [1, 2, 3, 4, 5],
      updatedAt: new Date()
    }
  };

  doc(path: string) {
    return {
      get: async () => {
        const data = this.mockData[path];
        return {
          exists: !!data,
          data: () => data || {}
        };
      },
      set: async (newData: any, options: any) => {
        if (options?.merge) {
          this.mockData[path] = { ...this.mockData[path], ...newData };
        } else {
          this.mockData[path] = newData;
        }
        return true;
      }
    };
  }

  collection(path: string) {
    return {
      doc: (id: string) => this.doc(`${path}/${id}`)
    };
  }

  runTransaction(callback: Function) {
    return callback({
      get: async (docRef: any) => {
        return await docRef.get();
      },
      update: (docRef: any, data: any) => {
        const path = docRef.path || "unknown/path";
        this.mockData[path] = { ...this.mockData[path], ...data };
      }
    });
  }
}

let db: any;
let auth: any;
let storage: any;

// Use mock implementation in development, real in production
if (process.env.NODE_ENV === 'development') {
  console.log("[Firebase Admin] Using mock implementation for development");
  db = new MockFirestore();
  auth = {
    // Mock auth methods if needed
    getUser: async () => ({ uid: "mock-user-id", email: "mock@example.com" })
  };
  storage = {
    // Mock storage methods if needed
    bucket: () => ({
      file: () => ({
        save: async () => true,
        download: async () => [Buffer.from("mock data")],
        exists: async () => [false]
      }),
      getFiles: async () => [[]]
    })
  };
} else {
  // Production initialization
  if (!admin.apps.length) {
    // Option A: Single JSON string in process.env.SERVICE_ACCOUNT_KEY
    if (config.SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(config.SERVICE_ACCOUNT_KEY as string);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: config.FIREBASE_STORAGE_BUCKET, // <-- specify bucket
      });
    } else {
      // Option B: Use separate env variables for projectId, privateKey, clientEmail
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        storageBucket: config.FIREBASE_STORAGE_BUCKET, // <-- specify bucket
      });
    }

    // Real implementations
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  }
}

// Export primary admin references that the app might need
export { db, auth, storage };

// Create FirebaseTimestamp and FieldValue mocks
const FirestoreTimestamp = {
  now: () => new Date()
};

const FirestoreFieldValue = {
  serverTimestamp: () => new Date(),
  delete: () => null
};

// Create a complete mock admin object for development with the right structure
const mockAdmin: any = {
  // For development mode, firestore() must be a function that returns the db object
  firestore: function() { return db; },
  // Also add static properties for FieldValue and Timestamp
  apps: [],
  initializeApp: () => {},
  credential: {
    cert: () => ({})
  },
  storage: () => storage,
  auth: () => auth
};

// Add static Timestamp and FieldValue properties to the admin object
mockAdmin.firestore.Timestamp = FirestoreTimestamp;
mockAdmin.firestore.FieldValue = FirestoreFieldValue;

// Conditionally export the real or mock admin
export default config.NODE_ENV === 'development' ? mockAdmin : admin;

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

// Initialize Firebase Admin SDK if it hasn't been initialized
let adminAuth;
try {
  const app = !getApps().length ? initAdmin() : getAuth(getApps()[0]);
  adminAuth = app;
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  // Provide a mock implementation for development
  adminAuth = {
    setCustomUserClaims: async () => ({ success: false, error: "Firebase Admin not initialized" }),
    verifySessionCookie: async () => ({ valid: false, error: "Firebase Admin not initialized" })
  };
}

export { adminAuth };

// Helper function to set admin role
export async function setAdminRole(uid: string) {
  try {
    await adminAuth.setCustomUserClaims(uid, { admin: true, role: "admin" });
    return { success: true };
  } catch (error) {
    console.error("Error setting admin role:", error);
    return { success: false, error };
  }
}

// Helper function to verify session cookie
export async function verifySessionCookie(sessionCookie: string) {
  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    return { valid: true, claims: decodedClaims };
  } catch (error) {
    return { valid: false, error };
  }
}
