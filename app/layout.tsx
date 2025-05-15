"use client";

import "@/styles/globals.css";
// Import Mapbox GL CSS globally to ensure it's available across all components
import "mapbox-gl/dist/mapbox-gl.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { auth } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { initWarningSuppressions } from "@/lib/suppressExternalWarnings";

// Initialize warning suppressions
initWarningSuppressions();
import Spinner from "@/components/ui/spinner";
import PwaMetaTags from "@/components/PwaMetaTags";
import { AnimationDebugger } from "@/components/AnimationDebugger";

// Redux
import { ReduxProvider } from "@/providers/ReduxProvider";
import { GoogleMapsProvider } from "@/providers/GoogleMapsProvider";
import { useAppDispatch, useAppSelector, store } from "@/store/store";
import {
  signOutUser,
  setDefaultPaymentMethodId,
  setAuthUser,
  selectAuthUser,
  selectIsSignedIn,
} from "@/store/userSlice";
import { loadBookingDetails, saveBookingDetails } from "@/store/bookingThunks";
import {
  selectBookingStep,
  resetBookingFlow,
} from "@/store/bookingSlice";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";

const inter = Inter({ subsets: ["latin"] });

/**
 * Prevent pinch-to-zoom on mobile.
 */
function DisablePinchZoom() {
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      // If more than one touch, prevent pinch
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
 * Booking State Recovery
 * 
 * - Steps 1-4: ephemeral, do NOT persist across reloads
 * - Step 5: persist
 * - Step 6: reset to step 1
 *
 * Because bookingStep5Transform handles ignoring steps <5 on rehydration,
 * we don't need extra localStorage clearing logic here. We'll only do
 * small fixes for step=6.
 */
function BookingStateRecovery() {
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);

  useEffect(() => {
    if (!isSignedIn) return; // only apply if user is signed in

    logger.debug(`[BookingStateRecovery] Step changed: ${bookingStep}`);

    // If the user is in step=6, treat it as done, then reset to step=1.
    if (bookingStep === 6) {
      logger.debug(`[BookingStateRecovery] Detected step=6, resetting to step 1`);
      
      // Reset to step 1 in Redux
      dispatch(resetBookingFlow());
      
      // Clear both booking and root persisted state to ensure fresh state
      localStorage.removeItem("persist:booking");
      
      // Save reset to Firestore
      dispatch(saveBookingDetails())
        .then(() => {
          // after reset is saved, refresh data
          logger.info("Booking reset saved, refreshing data...");
          return Promise.all([
            dispatch(fetchCars()),
            dispatch(fetchDispatchLocations()),
          ]);
        })
        .catch((err) => logger.error("Error during booking reset:", err));

      toast.success("Your previous trip is completed. Ready for a new trip!");
    }
    // For step=5, persist state (handled by the transform)
    // For steps 1-4, don't persist (also handled by the transform)
  }, [bookingStep, isSignedIn, dispatch]);

  return null;
}

/**
 * Component inside the ReduxProvider
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const currentUser = useAppSelector(selectAuthUser);
  const isSignedIn = useAppSelector(selectIsSignedIn);

  useEffect(() => {
    // This effect runs once when the app first mounts
    // Do NOT remove "persist:booking" here as it prevents step 5 from being remembered
    logger.debug("[LayoutInner] App initialized - preserving step 5 persistence");
  }, []);

  useEffect(() => {
    const db = getFirestore();

    // Listen for Firebase Auth changes
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (firebaseUser: User | null) => {
        setLoading(false);

        if (firebaseUser) {
          const userPayload = {
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber ?? undefined,
            email: firebaseUser.email ?? undefined,
            displayName: firebaseUser.displayName ?? undefined,
          };
          dispatch(setAuthUser(userPayload));

          // Subscribe to user doc
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const unsubscribeDoc = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data() as any;
              if (data.defaultPaymentMethodId) {
                dispatch(setDefaultPaymentMethodId(data.defaultPaymentMethodId));
              } else {
                dispatch(setDefaultPaymentMethodId(null));
              }
            } else {
              dispatch(setDefaultPaymentMethodId(null));
            }
          });
          return () => unsubscribeDoc();
        } else {
          // no user => sign out in Redux
          dispatch(signOutUser());
          dispatch(setDefaultPaymentMethodId(null));
        }
      }
    );

    return () => {
      unsubscribeAuth();
    };
  }, [dispatch]);

  // This effect previously reset booking state on mount, but now we only reset
  // if the user is not in step 5 (active booking)
  useEffect(() => {
    logger.debug("[LayoutInner] App mount - checking if reset is needed");

    // Get current booking step from store 
    const state = store.getState();
    const currentStep = state.booking?.step;
    
    // Only reset if NOT on step 5 (active booking)
    if (currentStep !== 5) {
      dispatch(resetBookingFlow());
      logger.debug("[LayoutInner] Initialized booking state (not in step 5)");
    } else {
      logger.debug("[LayoutInner] Preserving step 5 booking state on app mount");
    }

    setLoading(false);
  }, [dispatch]);
  
  // Add keyboard shortcut for logging level toggle
  useEffect(() => {
    const { LOG_LEVELS } = require('@/lib/logger');
    
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle logging with Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'd') {
        const logger = require('@/lib/logger').logger;
        const newLevel = logger.getLevel() === LOG_LEVELS.DEBUG ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;
        logger.setLevel(newLevel);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // If user is signed in, load booking details from Firestore
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
      {/* Children rendered directly with no Header */}
      {children}
      {process.env.NODE_ENV === 'development' && <AnimationDebugger />}
    </div>
  );
}

/**
 * RootLayout for Next.js
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
        <Analytics/>
        <SpeedInsights />
        <ReduxProvider>
          <GoogleMapsProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
            <LayoutInner>{children}</LayoutInner>
          </GoogleMapsProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}