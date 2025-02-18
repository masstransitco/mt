'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import Spinner from './spinner';

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export default function LoadingOverlay({ 
  message, 
  className 
}: LoadingOverlayProps) {
  // 1. Lock scroll when the overlay is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      // 2. Restore the original overflow on unmount
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className={cn(
        'absolute inset-0',
        'flex flex-col items-center justify-center',
        'bg-background/80 backdrop-blur-sm',
        className
      )}
    >
      <Spinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}