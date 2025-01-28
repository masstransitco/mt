'use client';

import React from 'react';

export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background">
      <div className="flex flex-col items-center text-muted-foreground gap-2">
        <svg
          className="w-6 h-6 animate-spin text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span>Loading map & stations...</span>
      </div>
    </div>
  );
};
