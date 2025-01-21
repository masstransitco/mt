'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer spinning ring */}
      <div
        className={cn(
          "border-t-primary",
          "border-r-primary/30",
          "border-b-primary/10",
          "border-l-transparent",
          "rounded-full",
          "animate-spin",
          sizeClasses[size],
          className
        )}
      />

      {/* Inner pulsating ring */}
      <div 
        className={cn(
          "absolute",
          "border-2",
          "border-white/20",
          "rounded-full",
          "animate-[pulse_1.5s_ease-in-out_infinite]",
          sizeClasses[size]
        )}
      />
    </div>
  );
}
