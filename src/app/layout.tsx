'use client';

import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import { auth } from '@/lib/firebase';
import ChatWidget from '@/components/ChatWidget';
import Spinner from '@/components/ui/spinner';

// Redux
import { ReduxProvider } from '@/providers/ReduxProvider';
import { useAppDispatch } from '@/store/store';
import { setAuthUser, signOutUser } from '@/store/userSlice';

const inter = Inter({ subsets: ['latin'] });

/**
 * Child component that lives INSIDE the ReduxProvider,
 * so it can safely call useAppDispatch / useAppSelector.
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setLoading(false);
      if (firebaseUser) {
        dispatch(
          setAuthUser({
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber ?? undefined,
            email: firebaseUser.email ?? undefined,
            displayName: firebaseUser.displayName ?? undefined,
          })
        );
      } else {
        dispatch(signOutUser());
      }
    });

    return () => unsubscribe();
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
      <ChatWidget />
    </div>
  );
}

/**
 * The actual Next.js RootLayout component.
 * 
 * Note: We do NOT call useAppDispatch() here, because ReduxProvider
 * only wraps <LayoutInner> (children), not this outer function.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
      </head>
      <body className={`${inter.className} h-full overflow-x-hidden bg-background`}>
        {/* Provide Redux to all child components */}
        <ReduxProvider>
          <LayoutInner>{children}</LayoutInner>
        </ReduxProvider>
      </body>
    </html>
  );
}
