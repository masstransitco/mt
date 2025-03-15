"use client";

import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast"; // For notifications

import { auth } from "@/lib/firebase";
import Spinner from "@/components/ui/spinner";
import PwaMetaTags from '@/components/PwaMetaTags';

// Redux
import { ReduxProvider } from "@/providers/ReduxProvider";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  signOutUser,
  setDefaultPaymentMethodId,
  setAuthUser,
  selectAuthUser,
  selectIsSignedIn
} from "@/store/userSlice";
import { loadBookingDetails, saveBookingDetails } from "@/store/bookingThunks";
import { selectBookingStep, resetBookingFlow } from "@/store/bookingSlice";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { persistor } from "@/store/store"; // Import persistor

const inter = Inter({ subsets: ["latin"] });

/**
 * Prevent pinch-to-zoom on mobile.
 */
function DisablePinchZoom() {
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return null;
}

/**
 * Booking State Recovery Component
 * Enhanced to properly handle persistence:
 * - Steps 1-4: Should NOT persist, reset to step 1
 * - Step 5: Allow it to persist (intended behavior)
 * - Step 6: Treat as invalid, reset to step 1
 */
function BookingStateRecovery() {
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  
  // Run this effect once on component mount to ensure proper initialization
  useEffect(() => {
    // Only process if user is signed in
    if (!isSignedIn) return;
    
    console.log(`[BookingStateRecovery] Initial check - Current booking step: ${bookingStep}`);
    
    // Force clear localStorage on initial mount
    if (typeof window !== 'undefined') {
      // Clear booking data from localStorage
      const persistKey = 'persist:booking';
      localStorage.removeItem(persistKey);
      console.log("[BookingStateRecovery] Initial mount - Cleared booking data from localStorage");
      
      // Explicitly force a clean state when in steps 1-4
      if (bookingStep === undefined || bookingStep === null || bookingStep < 5) {
        console.log(`[BookingStateRecovery] Initial mount - Resetting undefined or steps 1-4`);
        dispatch(resetBookingFlow());
      }
    }
  }, [isSignedIn]); // Only run on mount and when isSignedIn changes
  
  // Ongoing monitoring for booking step changes
  useEffect(() => {
    // Only process if user is signed in
    if (!isSignedIn) return;
    
    console.log(`[BookingStateRecovery] Step change monitor - Current booking step: ${bookingStep}`);
    
    // CASE 1: If user is in steps 1-4, ensure no persistence
    if (bookingStep >= 1 && bookingStep <= 4) {
      console.log(`[BookingStateRecovery] User in step ${bookingStep}, ensuring no persistence...`);
      
      // If in localStorage, remove it completely
      if (typeof window !== 'undefined') {
        const persistKey = 'persist:booking';
        localStorage.removeItem(persistKey);
        console.log("[BookingStateRecovery] Removed booking data from localStorage for steps 1-4");
      }
    }
    // CASE 2: If user is in step 6 (which is invalid in our system)
    else if (bookingStep === 6) {
      console.log(`[BookingStateRecovery] Detected invalid step (step 6), resetting to step 1...`);
      
      // Reset the booking flow in Redux
      dispatch(resetBookingFlow());
      
      // Also save this reset to Firestore to persist across page refreshes
      dispatch(saveBookingDetails())
        .then(() => {
          // After reset is saved, reload fresh data
          console.log("Booking reset saved, refreshing car and location data...");
          return Promise.all([
            dispatch(fetchCars()),
            dispatch(fetchDispatchLocations())
          ]);
        })
        .then(() => {
          console.log("Car and location data refreshed after booking reset");
        })
        .catch(err => {
          console.error("Error during booking reset sequence:", err);
        });
      
      toast.success("Your previous trip has been completed. Ready for a new trip!");
    }
    // CASE 3: User is in step 5 - this should persist normally, no action needed
    else if (bookingStep === 5) {
      console.log(`[BookingStateRecovery] User in step 5, preserving state as intended`);
      // No action needed - we want step 5 to persist
    }
  }, [bookingStep, dispatch, isSignedIn]);
  
  return null; // no UI
}

/**
 * Component inside the ReduxProvider
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const currentUser = useAppSelector(selectAuthUser);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const bookingStep = useAppSelector(selectBookingStep);

  // Set up auth listener once
  useEffect(() => {
    const db = getFirestore();
    
    // Listen for Firebase Auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      setLoading(false);

      if (firebaseUser) {
        // Build our AuthUser object
        const userPayload = {
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber ?? undefined,
          email: firebaseUser.email ?? undefined,
          displayName: firebaseUser.displayName ?? undefined,
        };

        // Dispatch auth user update
        dispatch(setAuthUser(userPayload));
        
        // Subscribe to user doc for real-time updates
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as any;
            // Payment method changes
            if (data.defaultPaymentMethodId) {
              dispatch(setDefaultPaymentMethodId(data.defaultPaymentMethodId));
            } else {
              dispatch(setDefaultPaymentMethodId(null));
            }
          } else {
            dispatch(setDefaultPaymentMethodId(null));
          }
        });

        return () => {
          unsubscribeDoc();
        };
      } else {
        // No user => sign out in Redux
        dispatch(signOutUser());
        dispatch(setDefaultPaymentMethodId(null));
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, [dispatch]);

  // IMPORTANT: On app mount, we need to ensure there isn't any leftover corrupted state
  useEffect(() => {
    // Execute this on initial mount only
    if (typeof window !== 'undefined') {
      console.log("[LayoutInner] App initialization - Cleaning any stale booking state");
      localStorage.removeItem('persist:booking');
      
      // For good measure, provide a clean state
      dispatch(resetBookingFlow());
    }
  }, []); // Empty dependency array = run once on mount

  // When auth state or user changes, load booking details if signed in
  useEffect(() => {
    if (isSignedIn && currentUser) {
      // Before loading, clear any leftover localStorage state
      if (typeof window !== 'undefined') {
        const stateStr = localStorage.getItem('persist:booking');
        if (stateStr) {
          try {
            // Try to parse it to see if it's step 5
            const state = JSON.parse(stateStr);
            const step = state.step ? JSON.parse(state.step) : undefined;
            
            // Only keep if it's step 5
            if (step !== 5) {
              console.log(`[LayoutInner] Found non-step-5 data in localStorage (step=${step}), removing`);
              localStorage.removeItem('persist:booking');
            }
          } catch (e) {
            // If parsing fails, just remove it
            console.log("[LayoutInner] Failed to parse localStorage booking data, removing it", e);
            localStorage.removeItem('persist:booking');
          }
        }
      }
      
      // Now try to load booking details from Firestore
      dispatch(loadBookingDetails());
    }
  }, [isSignedIn, currentUser, dispatch]);

  // Additional cleanup for steps 1-4
  useEffect(() => {
    if (isSignedIn && (bookingStep >= 1 && bookingStep <= 4)) {
      // For steps 1-4, just ensure clean localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('persist:booking');
        console.log("[LayoutInner] Steps 1-4: Removed booking data from localStorage");
      }
    }
  }, [isSignedIn, bookingStep]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`${inter.className} h-full flex flex-col relative`}>
      <BookingStateRecovery />
      {children}
    </div>
  );
}

/**
 * The Next.js RootLayout
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
        />
        <PwaMetaTags />
      </head>
      <body className={`${inter.className} h-full overflow-x-hidden bg-background`}>
        <DisablePinchZoom />
        <ReduxProvider>
          <LayoutInner>{children}</LayoutInner>
        </ReduxProvider>
      </body>
    </html>
  );
}
