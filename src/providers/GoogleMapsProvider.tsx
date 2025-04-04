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
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
  googleMapsReady: false,
  loadingProgress: 0,
  retryLoading: () => {},
});

export const GoogleMapsProvider: React.FC<{
  children: React.ReactNode;
  apiKey: string;
}> = ({ children, apiKey }) => {
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingAttempt, setLoadingAttempt] = useState(0);
  
  // Use the existing react-google-maps/api loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    version: "alpha",
    libraries: LIBRARIES,
  });
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let checkInterval: NodeJS.Timeout | null = null;
    
    if (isLoaded) {
      // Start progress immediately
      setLoadingProgress(10);
      
      // Check for required services with incremental progress updates
      checkInterval = setInterval(() => {
        // Update progress for user feedback
        setLoadingProgress(prev => Math.min(prev + 15, 90));
        
        // Check if all required services are available
        const servicesReady = 
          window.google?.maps?.DirectionsService &&
          window.google?.maps?.Geocoder &&
          window.google?.maps?.places?.AutocompleteService &&
          window.google?.maps?.geometry?.spherical;
          
        if (servicesReady) {
          if (checkInterval) clearInterval(checkInterval);
          setLoadingProgress(100);
          setGoogleMapsReady(true);
        }
      }, 300);
      
      // Set maximum loading time to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        if (!googleMapsReady) {
          console.error("Google Maps services not fully loaded after timeout");
        }
      }, 8000);
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (checkInterval) clearInterval(checkInterval);
      };
    }
  }, [isLoaded, loadingAttempt, googleMapsReady]);
  
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
  };
  
  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

// Custom hook for consuming the context
export const useGoogleMaps = () => useContext(GoogleMapsContext);