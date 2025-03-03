'use client';

import { useEffect } from 'react';

export default function DebugEnv() {
  useEffect(() => {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('STRIPE_PUBLISHABLE_KEY exists:', !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      console.log('APP_URL exists:', !!process.env.NEXT_PUBLIC_APP_URL);
    }
  }, []);

  return null;
}
