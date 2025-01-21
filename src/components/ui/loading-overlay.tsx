'use client';

import React from 'react';
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
  return (
    <div className={cn(
      "absolute inset-0",
      "flex flex-col items-center justify-center",
      "bg-background/80 backdrop-blur-sm",
      className
    )}>
      <Spinner size="lg" />
      {message && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
