"use client";

import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";
import Spinner from "@/components/ui/spinner";

// Redux
import { ReduxProvider } from "@/providers/ReduxProvider";
import { useAppDispatch } from "@/store/store";
import { setAuthUser, signOutUser, setDefaultPaymentMethodId } from "@/store/userSlice";

const inter = Inter({ subsets: ["latin"] });

/**
 * Component to disable pinch-to-zoom.
 * It listens for touchmove events and, if more than one finger is detected,
 * prevents the default behavior.
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
 * Child component that lives INSIDE the ReduxProvider,
 * so it can safely call useAppDispatch / useAppSelector.
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore(); // initialize Firestore (client side)
    
    // 1) Listen for Firebase Auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setLoading(false);

      if (firebaseUser) {
        // 2) We have a user => setAuthUser in Redux
        dispatch(
          setAuthUser({
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber ?? undefined,
            email: firebaseUser.email ?? undefined,
            displayName: firebaseUser.displayName ?? undefined,
          })
        );

        // 3) Real-time Firestore subscription to user doc
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as any;
            // If user doc has 'defaultPaymentMethodId', store it in Redux
            if (data.defaultPaymentMethodId) {
              dispatch(setDefaultPaymentMethodId(data.defaultPaymentMethodId));
            } else {
              dispatch(setDefaultPaymentMethodId(null));
            }
          } else {
            // doc does not exist => no default PM
            dispatch(setDefaultPaymentMethodId(null));
          }
        });

        // Cleanup doc subscription
        return () => {
          unsubscribeDoc();
        };
      } else {
        // No user => signOutUser in Redux
        dispatch(signOutUser());
        // Also no default PM
        dispatch(setDefaultPaymentMethodId(null));
      }
    });

    // Cleanup auth subscription
    return () => {
      unsubscribeAuth();
    };
  }, [dispatch, router]);

  if (loading) {
    // Show a loading screen while waiting for Firebase auth check
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`${inter.className} h-full flex flex-col relative`}>
      {children}
      {/* ChatWidget removed */}
    </div>
  );
}

/**
 * The actual Next.js RootLayout component.
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
        {/* Disable pinch-to-zoom on mobile browsers */}
        <DisablePinchZoom />
        {/* Provide Redux to all child components */}
        <ReduxProvider>
          <LayoutInner>{children}</LayoutInner>
        </ReduxProvider>
      </body>
    </html>
  );
}
