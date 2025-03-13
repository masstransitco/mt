"use client";

import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FixedSizeList as List, ListOnItemsRenderedProps } from "react-window";
import InfiniteLoader from "react-window-infinite-loader"; // Fixed import
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation as actionSelectDeparture,
  selectArrivalStation as actionSelectArrival,
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import StationListItem, { StationListItemData } from "./StationListItem";
import { MapPin, Navigation } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * The props for our StationList component.
 * userLocation is typed as google.maps.LatLngLiteral | null
 */
interface StationListProps {
  /** The array of stations to display. */
  stations: StationFeature[];
  /** Scroll height for react-window. */
  height?: number;
  /** Whether to show a small legend row on top. */
  showLegend?: boolean;
  /** The user's location, typed as LatLngLiteral or null. */
  userLocation?: google.maps.LatLngLiteral | null;
  /** Whether the component is visible (not minimized) */
  isVisible?: boolean;
}

/** Example helper to compute walking time. */
function calculateWalkingTime(
  station: StationFeature,
  userLocation: google.maps.LatLngLiteral | null
): number {
  if (!userLocation || !station.geometry?.coordinates) return 0;

  // Basic haversine for distance in km
  const [lng, lat] = station.geometry.coordinates;
  const { lat: userLat, lng: userLng } = userLocation;

  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(userLat - lat);
  const dLng = toRad(userLng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(userLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // E.g. assume 12 min per km
  return Math.round(distanceKm * 12);
}

/** A placeholder drivingTime function */
function calculateDrivingTime(station: StationFeature): number {
  if (!station.geometry?.coordinates) return 0;
  // Put your own logic here if needed
  return 8; // e.g. 8 minutes as a stub
}

/**
 * Our main StationList component, using react-window.
 */
function StationList({
  stations,
  height = 300,
  showLegend = true,
  userLocation,
  isVisible = true, // Default to true
}: StationListProps) {
  const dispatch = useAppDispatch();
  // Define specific type for the ref to avoid "current" type errors
  const listRef = useRef<List | null>(null);
  
  // For forcing rerenders on visibility change
  const [forceRenderKey, setForceRenderKey] = useState(0);
  
  // Track whether component became visible
  const visibilityChangedRef = useRef(false);

  // Flow and station IDs from Redux
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * Local callback: picks departure if step ≤ 2, picks arrival if step in [3,4].
   */
  const handleStationSelected = useCallback(
    (station: StationFeature) => {
      if (step <= 2) {
        dispatch(actionSelectDeparture(station.id));
      } else if (step >= 3 && step <= 4) {
        dispatch(actionSelectArrival(station.id));
      } else {
        toast("Cannot select station at this stage.");
      }
    },
    [dispatch, step]
  );

  /**
   * Preprocess the stations array to embed walkTime + drivingTime
   * so each row can display them easily.
   */
  const processedStations = useMemo(() => {
    return stations.map((st) => {
      const walkTime = calculateWalkingTime(st, userLocation || null);
      const drivingTime = calculateDrivingTime(st);
      return {
        ...st,
        walkTime,
        drivingTime,
        // Optionally, embed them into st.properties as well
        properties: {
          ...st.properties,
          walkTime,
          drivingTime,
        },
      };
    });
  }, [stations, userLocation]);

  // For infinite scrolling
  const [loadedCount, setLoadedCount] = useState(10);
  const [visibleStations, setVisibleStations] = useState<StationFeature[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Effect to handle visibility changes
  useEffect(() => {
    if (isVisible && visibilityChangedRef.current) {
      // Force a complete refresh when becoming visible
      setForceRenderKey(prev => prev + 1);
      
      // Reset to initial state to force proper reload
      setLoadedCount(10);
      
      // Reset visibility changed flag
      visibilityChangedRef.current = false;
      
      // Force the list to reset scroll position and recalculate
      if (listRef.current) {
        // Safely access scroll methods
        listRef.current.scrollTo(0);
        
        // Handle resetAfterIndex - it might not exist in all versions of react-window
        // Use optional chaining to safely call it if it exists
        if ('resetAfterIndex' in listRef.current && 
            typeof (listRef.current as any).resetAfterIndex === 'function') {
          (listRef.current as any).resetAfterIndex(0, true);
        }
      }
    } else if (!isVisible) {
      // Mark that visibility has changed when going from visible to hidden
      visibilityChangedRef.current = true;
    }
  }, [isVisible]);

  // slice out the first loadedCount stations
  useEffect(() => {
    if (!processedStations.length) {
      setVisibleStations([]);
      setHasMore(false);
      return;
    }
    const slice = processedStations.slice(0, loadedCount);
    setVisibleStations(slice);
    setHasMore(slice.length < processedStations.length);
  }, [processedStations, loadedCount, forceRenderKey]); // Added forceRenderKey dependency

  // The item data we pass to each row
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: visibleStations,
      onStationSelected: handleStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
      forceRenderKey, // Include the key to force child rerenders
    };
  }, [
    visibleStations,
    handleStationSelected,
    departureId,
    arrivalId,
    dispatchRoute,
    forceRenderKey,
  ]);

  const itemCount = hasMore ? visibleStations.length + 1 : visibleStations.length;
  const isItemLoaded = useCallback(
    (index: number) => index < visibleStations.length,
    [visibleStations]
  );

  // load more stations each time the user scrolls near bottom
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      setLoadedCount((prev) => prev + 5);
    },
    []
  );

  // Create a fixed renderItem function for the List component
  const renderItem = useCallback((props: any) => {
    return <StationListItem {...props} />;
  }, []);

  // IMPORTANT: Ensure all hooks are called unconditionally
  // Always initialize these variables, regardless of isVisible
  const content = useMemo(() => {
    if (!isVisible) {
      return <div className="hidden"></div>;
    }

    return (
      <div className="flex flex-col w-full" key={`station-list-container-${forceRenderKey}`}>
        {showLegend && (
          <div className="px-4 py-2 bg-gray-900/60 border-b border-gray-800 flex justify-between items-center">
            <div className="text-xs text-gray-400">
              {stations.length} stations found
            </div>
            <div className="flex gap-3">
              {/* Example Legend: one for departure, one for arrival */}
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-full bg-blue-600">
                  <MapPin className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-gray-300">Pickup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-full bg-green-600">
                  <Navigation className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-gray-300">Dropoff</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-b-lg overflow-hidden bg-black">
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            key={`infinite-loader-${forceRenderKey}`}
          >
            {({ onItemsRendered, ref }) => (
              <List
                height={height}
                itemCount={itemCount}
                itemSize={70}
                width="100%"
                itemData={itemData}
                onItemsRendered={onItemsRendered}
                ref={(listInstance) => {
                  // Handle both refs
                  if (typeof ref === 'function') {
                    ref(listInstance);
                  }
                  listRef.current = listInstance;
                }}
                className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                key={`fixed-size-list-${forceRenderKey}`}
              >
                {renderItem}
              </List>
            )}
          </InfiniteLoader>
        </div>
      </div>
    );
  }, [
    isVisible, 
    forceRenderKey, 
    showLegend, 
    stations.length, 
    isItemLoaded, 
    itemCount, 
    loadMoreItems, 
    height, 
    itemData, 
    renderItem
  ]);

  // Return the content
  return content;
}

export default memo(StationList);