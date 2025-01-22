// lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// --- Your Firebase project config (use your own credentials) ---
const firebaseConfig = {
  apiKey: "AIzaSyAj46uOcP-Y4T3X2ZpdlWt4_PxUWCTFwyM",
  authDomain: "masstransitcompany.firebaseapp.com",
  projectId: "masstransitcompany",
  storageBucket: "masstransitcompany.firebasestorage.app",
  messagingSenderId: "1039705984668",
  appId: "1:1039705984668:web:e85aafd14917825b3d6759",
  measurementId: "G-NMMQLPBJD1"
};

const app = initializeApp(firebaseConfig);

// Optionally enable analytics
// Make sure your environment supports analytics (e.g., not SSR)
if (typeof window !== "undefined") {
  getAnalytics(app);
}

// Export the Auth instance to be used throughout your app
export const auth = getAuth(app);
