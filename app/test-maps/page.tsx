"use client";

import React, { useEffect, useState } from 'react';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function TestMapsPage() {
  const { isLoaded, loadError, googleMapsReady, loadingProgress, retryLoading } = useGoogleMaps();
  const [message, setMessage] = useState<string>('Initializing...');

  useEffect(() => {
    if (loadError) {
      setMessage(`Error loading Google Maps: ${loadError.message}`);
    } else if (!isLoaded) {
      setMessage('Loading Google Maps script...');
    } else if (!googleMapsReady) {
      setMessage('Google Maps script loaded, waiting for services...');
    } else {
      setMessage('Google Maps ready!');
    }
  }, [isLoaded, loadError, googleMapsReady]);

  return (
    <div className="p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Google Maps Provider Test</h1>
      
      {!googleMapsReady && (
        <div className="mb-8 w-full flex justify-center">
          <LoadingSpinner progress={loadingProgress} message="Loading Google Maps..." />
        </div>
      )}
      
      <div className="max-w-md w-full bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl mb-2">Status</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Script Loaded:</span>
            <span>{isLoaded ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span>Services Ready:</span>
            <span>{googleMapsReady ? '✅' : '❌'}</span>
          </div>
          <div className="flex justify-between">
            <span>Error:</span>
            <span>{loadError ? '❌' : '✅'}</span>
          </div>
          <div className="flex justify-between">
            <span>Loading Progress:</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="mt-4 p-2 bg-gray-700 rounded">
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        </div>
        
        {loadError && (
          <button 
            onClick={retryLoading}
            className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Retry Loading
          </button>
        )}
      </div>
    </div>
  );
}