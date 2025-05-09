"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { CarSceneFallback } from './SimpleFallback';

// Use dynamic import with SSR disabled for all 3D components
export const DynamicCar3DViewer = dynamic(
  () => import('./Car3DViewer'),
  { 
    ssr: false,
    loading: () => null // IMPORTANT: No loading UI here
  }
);

// Updated to include onReady prop for loading coordination
export const DynamicCarCardScene = dynamic(
  () => import('./CarCardScene'),
  { 
    ssr: false,
    loading: () => null // IMPORTANT: No loading UI here
  }
);

// Pre-import components for faster loading
if (typeof window !== 'undefined') {
  // Use a short timeout to not block initial render
  setTimeout(() => {
    import('./Car3DViewer').catch(() => {});
    import('./shared/ThreeSceneComponents').catch(() => {});
    import('./shared/CarModelComponent').catch(() => {});
  }, 2000);
}