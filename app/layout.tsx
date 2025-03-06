"use client";

import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast"; // Assuming you use this for notifications

import { auth } from "@/lib/firebase";
import Spinner from "@/components/ui/spinner";

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
import { loadBookingDetails, saveBookingDetails } from "@/store/bookingThunks"; // Added saveBookingDetails
import { selectBookingStep, resetBookingFlow } from "@/store/bookingSlice";

const inter = Inter({ subsets: ["latin"] });

/**
 * Component to disable pinch-to-zoom.
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
 * Automatically detects and fixes invalid booking states
 */
function BookingStateRecovery() {
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  
  useEffect(() => {
    // Only process if user is signed in
    if (!isSignedIn) return;
    
    // If user is in invalid step 5 or 6, reset them to step 1
    if (bookingStep === 5 || bookingStep === 6) {
      console.log(`Detected user in invalid booking state (step ${bookingStep}), resetting to step 1...`);
      
      // Reset the booking flow in Redux
      dispatch(resetBookingFlow());
      
      // Also save this reset to Firestore to persist across page refreshes
      dispatch(saveBookingDetails());
      
      // Notify the user
      toast.success("Your previous trip has been completed. Ready for a new trip!");
    }
  }, [bookingStep, dispatch, isSignedIn]);
  
  return null; // This is just a logic component, no UI
}

/**
 * Child component that lives INSIDE the ReduxProvider
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const currentUser = useAppSelector(selectAuthUser);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const bookingStep = useAppSelector(selectBookingStep);

  // This effect runs once on component mount to set up auth listener
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
            // Handle payment method changes
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

  // This effect runs whenever auth state or booking step changes
  useEffect(() => {
    // If user is signed in, load booking details if they're not already loaded
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
      {/* Include BookingStateRecovery component */}
      <BookingStateRecovery />
      {children}
    </div>
  );
}

/**
 * The actual Next.js RootLayout component
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
        />
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
