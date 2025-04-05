// File: src/lib/firebase-admin.ts
import admin from "firebase-admin";

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
        download: async () => [Buffer.from("mock data")]
      })
    })
  };
} else {
  // Production initialization
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

    // Real implementations
    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();
  }
}

// Export primary admin references that the app might need
export { db, auth, storage };

// Create a more complete mock admin object for development
const mockAdmin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => new Date()
    }
  },
  apps: [],
  initializeApp: () => {},
  credential: {
    cert: () => ({})
  },
  storage: () => ({
    bucket: () => ({})
  }),
  auth: () => ({})
};

// Conditionally export the real or mock admin
export default process.env.NODE_ENV === 'development' ? mockAdmin : admin;

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