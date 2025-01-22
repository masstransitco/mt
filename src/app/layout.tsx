'use client';

import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { ReduxProvider } from '@/providers/ReduxProvider';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import ChatWidget from '@/components/ChatWidget';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Handle auth state changes
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <ReduxProvider>
          {children}
          <ChatWidget />
        </ReduxProvider>
      </body>
    </html>
  );
}
