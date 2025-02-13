'use client';

import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { ReduxProvider } from '@/providers/ReduxProvider';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import ChatWidget from '@/components/ChatWidget';
import Spinner from '@/components/ui/spinner';

// Import your Redux actions
import { useAppDispatch } from '@/store/store';
import { setAuthUser, signOutUser } from '@/store/userSlice';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useAppDispatch(); // so we can dispatch to Redux
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setLoading(false);

      if (firebaseUser) {
        // Prepare an object shaped like AuthUser in your userSlice
        const userData = {
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber ?? undefined,
          email: firebaseUser.email ?? undefined,
          displayName: firebaseUser.displayName ?? undefined,
        };
        dispatch(setAuthUser(userData));
      } else {
        dispatch(signOutUser());
      }
    });

    return () => unsubscribe();
  }, [dispatch, router]);

  if (loading) {
    return (
      <html lang="en" className="h-full">
        <body className={`${inter.className} h-full bg-background`}>
          <div className="h-full flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
      </head>
      <body
        className={`${inter.className} h-full overflow-x-hidden bg-background`}
      >
        <ReduxProvider>
          <div className="relative min-h-full flex flex-col">
            {children}
            <ChatWidget />
          </div>
        </ReduxProvider>
      </body>
    </html>
  );
}
