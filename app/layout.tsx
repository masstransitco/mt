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
 * Currently does not forcibly reset step 5, allowing the user
 * to remain in step 5 if that's what's persisted.
 */
function BookingStateRecovery() {
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  
  useEffect(() => {
    // Only process if user is signed in
    if (!isSignedIn) return;
    
    // Example: If you had a step 6 or some truly invalid step, you could handle it here.
    // Right now, we do nothing if step === 5, so it persists properly.
    // If you have no invalid states, you can remove this entire component.
    if (bookingStep === 6) {
      console.log(`Detected user in invalid booking state (step 6), resetting to step 1...`);
      
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

  // When auth state or user changes, load booking details if signed in
  useEffect(() => {
    if (isSignedIn && currentUser) {
      dispatch(loadBookingDetails());
    }
  }, [isSignedIn, currentUser, dispatch]);

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
