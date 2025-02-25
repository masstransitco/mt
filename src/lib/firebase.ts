import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const authDomain = typeof window !== "undefined"
  ? window.location.hostname
  : "masstransitcompany.firebaseapp.com";

// Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAj46uOcP-Y4T3X2ZpdlWt4_PxUWCTFwyM",
  authDomain: window.location.hostname,
  projectId: "masstransitcompany",
  storageBucket: "masstransitcompany.firebasestorage.app",
  messagingSenderId: "1039705984668",
  appId: "1:1039705984668:web:e85aafd14917825b3d6759",
  measurementId: "G-NMMQLPBJD1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: Add initialization status check
export const isInitialized = () => {
  return !!app && !!auth && !!db;
};
