// firebase.ts
// import config from '@/config'
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Add this import

// console.log(config)

// Use the actual hostname on the client, fallback to a static value on the server
const authDomain = typeof window !== "undefined"
  ? window.location.hostname
  : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain, // Updated to use the computed value
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// const firebaseConfig = {
//   apiKey: "AIzaSyAj46uOcP-Y4T3X2ZpdlWt4_PxUWCTFwyM",
//   authDomain, // Updated to use the computed value
//   projectId: "masstransitcompany",
//   storageBucket: "masstransitcompany.firebasestorage.app", 
//   messagingSenderId: "1039705984668",
//   appId: "1:1039705984668:web:e85aafd14917825b3d6759",
//   measurementId: "G-NMMQLPBJD1"
// };
console.log(firebaseConfig)

// Initialize Firebase
const app = initializeApp(firebaseConfig);

console.log(app)

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Add this line

// Optional: Initialization status check
export const isInitialized = () => !!app && !!auth && !!db && !!storage;
