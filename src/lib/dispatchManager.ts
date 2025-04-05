// src/lib/dispatchManager.ts

import { selectAvailableForDispatch } from "@/store/carSlice";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { useCallback, useEffect, useRef } from "react";
import { fetchAvailabilityFromFirestore } from "@/store/dispatchSlice";
import type { Car } from "@/types/cars";

// Cache for availability data
type AvailabilityCache = {
  data: Car[];
  timestamp: number;
  isLoading: boolean;
};

let globalCache: AvailabilityCache = {
  data: [],
  timestamp: 0,
  isLoading: false,
};

const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Enhanced hook that returns cars available for dispatch with caching and auto-refresh.
 * - Uses a global cache to prevent redundant API calls
 * - Auto-refreshes when cache is stale
 * - Handles loading state
 */
export function useAvailableCarsForDispatch(options = { autoRefresh: true }) {
  const dispatch = useAppDispatch();
  const carsFromStore = useAppSelector(selectAvailableForDispatch);
  const allCarsFromStore = useAppSelector((state) => state.car.cars);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get data with auto-refresh if cache is stale
  const refreshData = useCallback(() => {
    const now = Date.now();
    
    // Only fetch if cache is stale and we're not already loading
    if (now - globalCache.timestamp > CACHE_TTL && !globalCache.isLoading) {
      globalCache.isLoading = true;
      
      console.log("[DispatchManager] Refreshing availability data");
      dispatch(fetchAvailabilityFromFirestore())
        .unwrap()
        .then(() => {
          globalCache.timestamp = Date.now();
          globalCache.isLoading = false;
        })
        .catch(err => {
          console.error("[DispatchManager] Failed to refresh data:", err);
          globalCache.isLoading = false;
        });
    }
  }, [dispatch]);
  
  // Auto-refresh data when cache is stale
  useEffect(() => {
    if (options.autoRefresh) {
      // Update cache with latest store data
      if (carsFromStore.length > 0 && globalCache.data.length === 0) {
        globalCache.data = carsFromStore;
        if (globalCache.timestamp === 0) {
          globalCache.timestamp = Date.now();
        }
      }
      
      // Set up interval for auto-refresh check
      requestTimeoutRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshData();
        }
      }, 10000); // Check every 10 seconds
      
      // Initial load if cache is empty or stale
      if (globalCache.data.length === 0 || Date.now() - globalCache.timestamp > CACHE_TTL) {
        refreshData();
      }
    }
    
    return () => {
      if (requestTimeoutRef.current) {
        clearInterval(requestTimeoutRef.current);
      }
    };
  }, [carsFromStore, refreshData, options.autoRefresh]);
  
  // Result preference order:
  // 1. Cars from availableForDispatch in Redux store
  // 2. Cars from global cache
  // 3. Fallback to all cars in the Redux store (in development mode)
  // 4. Empty array as last resort
  if (carsFromStore.length > 0) {
    return carsFromStore;
  } else if (globalCache.data.length > 0) {
    return globalCache.data;
  } else if (process.env.NODE_ENV === 'development' && allCarsFromStore.length > 0) {
    console.log("[DispatchManager] Using all cars as fallback in development mode");
    return allCarsFromStore;
  } else {
    return [];
  }
}