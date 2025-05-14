// src/providers/GoogleMapsProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { LIBRARIES } from '@/constants/map';

// Type definitions
interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
  googleMapsReady: boolean;
  loadingProgress: number;
  retryLoading: () => void;
  map: google.maps.Map | null;
  setMap: (m: google.maps.Map | null) => void;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
  googleMapsReady: false,
  loadingProgress: 0,
  retryLoading: () => {},
  map: null,
  setMap: () => {},
});

export const GoogleMapsProvider: React.FC<{
  children: React.ReactNode;
  apiKey: string;
}> = ({ children, apiKey }) => {
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Use the existing react-google-maps/api loader
  // Changed from "alpha" to "weekly" for better stability
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    version: "alpha",
    libraries: LIBRARIES,
  });
  
  useEffect(() => {
    if (isLoaded) {
      // Simple approach: just set googleMapsReady to true when the API is loaded
      setLoadingProgress(100); 
      setGoogleMapsReady(true);
    } else {
      setLoadingProgress(0);
    }
  }, [isLoaded, loadingAttempt]);
  
  // Function to retry loading if it fails
  const retryLoading = () => {
    setGoogleMapsReady(false);
    setLoadingProgress(0);
    setLoadingAttempt(prev => prev + 1);
  };
  
  const value = {
    isLoaded,
    loadError,
    googleMapsReady,
    loadingProgress,
    retryLoading,
    map,
    setMap,
  };
  
  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

// Custom hook for consuming the context
export const useGoogleMaps = () => useContext(GoogleMapsContext);
