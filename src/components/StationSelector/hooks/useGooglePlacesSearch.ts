"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "react-hot-toast";
import { ensureGoogleMapsLoaded, createGeocoder, createAutocompleteService } from "@/lib/googleMaps";

/**
 * Custom hook for Google Places search functionality
 */
export function useGooglePlacesSearch() {
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapsLoadedRef = useRef<boolean>(false);
  const selectionInProgressRef = useRef<boolean>(false);

  // Initialize Google Maps services
  useEffect(() => {
    let isMounted = true;
    const initServices = async () => {
      try {
        if (!mapsLoadedRef.current) {
          await ensureGoogleMapsLoaded();
          if (!isMounted) return;
          mapsLoadedRef.current = true;
        }
        if (!autocompleteService.current) {
          autocompleteService.current = await createAutocompleteService();
        }
        if (!geocoder.current) {
          geocoder.current = await createGeocoder();
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to initialize Maps services:", error);
        toast.error("Map services unavailable. Please refresh.");
      }
    };

    initServices();
    return () => {
      isMounted = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Search for places based on input text
   */
  const searchPlaces = useCallback((input: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!input.trim()) {
      setPredictions([]);
      setIsDropdownOpen(false);
      return;
    }
    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (!autocompleteService.current) {
          await ensureGoogleMapsLoaded();
          autocompleteService.current = await createAutocompleteService();
        }
        const request: google.maps.places.AutocompleteRequest = {
          input,
          // @ts-ignore
          types: ["establishment", "geocode"],
          componentRestrictions: { country: "HK" },
        };
        const result = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve, reject) => {
          autocompleteService.current!.getPlacePredictions(request, (preds, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
              resolve(preds);
            } else {
              reject(new Error(`Places API error: ${status}`));
            }
          });
        });
        setPredictions(result.slice(0, 5));
        setIsDropdownOpen(result.length > 0);
      } catch (error) {
        console.error("Error fetching predictions:", error);
        setPredictions([]);
        setIsDropdownOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  /**
   * Get location from a selected prediction
   */
  const getLocationFromPrediction = useCallback(
    async (prediction: google.maps.places.AutocompletePrediction): Promise<google.maps.LatLngLiteral | null> => {
      try {
        if (!geocoder.current) {
          await ensureGoogleMapsLoaded();
          geocoder.current = await createGeocoder();
        }
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.current!.geocode({ placeId: prediction.place_id }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error(`Geocoder error: ${status}`));
            }
          });
        });
        const location = result[0]?.geometry?.location;
        if (location) {
          return { lat: location.lat(), lng: location.lng() };
        }
        return null;
      } catch (error) {
        console.error("Geocoding error:", error);
        toast.error("Unable to locate address");
        return null;
      }
    },
    []
  );

  /**
   * Mark selection in progress flag
   */
  const setSelectionInProgress = useCallback((inProgress: boolean) => {
    selectionInProgressRef.current = inProgress;
  }, []);

  /**
   * Clear predictions and close dropdown
   */
  const clearPredictions = useCallback(() => {
    setPredictions([]);
    setIsDropdownOpen(false);
  }, []);

  /**
   * Check if selection is in progress
   */
  const isSelectionInProgress = useCallback(() => {
    return selectionInProgressRef.current;
  }, []);

  return {
    predictions,
    isDropdownOpen,
    isLoading,
    searchPlaces,
    getLocationFromPrediction,
    setIsDropdownOpen,
    clearPredictions,
    setSelectionInProgress,
    isSelectionInProgress
  };
}

export default useGooglePlacesSearch;