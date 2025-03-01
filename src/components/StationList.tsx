"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FixedSizeList as List, ListOnItemsRenderedProps } from "react-window";
import {
  InfiniteLoader,
  InfiniteLoaderChildProps,
} from "react-window-infinite-loader";

import { useAppSelector } from "@/store/store";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import StationListItem, { StationListItemData } from "./StationListItem";
import { MapPin, Navigation } from "lucide-react";

interface StationListProps {
  /** An array of station data (e.g., your first page of stations). */
  stations: StationFeature[];
  /** A callback when user selects a station from the list. */
  onStationSelected?: (station: StationFeature) => void;
  /** Optional height for the list container */
  height?: number;
  /** Show a header with legend for station types */
  showLegend?: boolean;
  /** User's current location to calculate walking times */
  userLocation?: google.maps.LatLngLiteral | null;
}

/**
 * Helper to calculate walking time based on distance
 */
function calculateWalkingTime(station: StationFeature, userLocation: google.maps.LatLngLiteral | null): number {
  if (!userLocation || !station.geometry?.coordinates) return 0;
  
  const [lng, lat] = station.geometry.coordinates;
  // Basic Haversine formula to calculate distance
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(userLocation.lat - lat);
  const dLng = toRad(userLocation.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
    Math.cos(toRad(userLocation.lat)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  // Average walking speed: ~12 min per km
  const MIN_PER_KM = 12;
  return Math.round(distanceKm * MIN_PER_KM);
}

/**
 * A parent list component that:
 * - Subscribes to Redux once (for departureId, arrivalId, dispatchRoute)
 * - Uses react-window + react-window-infinite-loader for an "instagram-style" infinite scroll.
 */
function StationList({ 
  stations, 
  onStationSelected, 
  height = 300,
  showLegend = true,
  userLocation
}: StationListProps) {
  // Example: track if there's more data to load from the server
  const [hasMore, setHasMore] = useState(true);
  // Store stations with calculated walk times
  const [stationsWithWalkTimes, setStationsWithWalkTimes] = useState<StationFeature[]>(stations);

  // Single Redux subscription
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Calculate walking times when stations or userLocation changes
  useEffect(() => {
    if (stations.length > 0 && userLocation) {
      const updatedStations = stations.map(station => {
        const walkTime = calculateWalkingTime(station, userLocation);
        return {
          ...station,
          walkTime,
          properties: {
            ...station.properties,
            walkTime
          }
        };
      });
      setStationsWithWalkTimes(updatedStations);
    } else {
      setStationsWithWalkTimes(stations);
    }
  }, [stations, userLocation]);

  /**
   * Build the list's "itemData" prop,
   * so each row can access these fields without a separate Redux subscription.
   */
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: stationsWithWalkTimes,
      onStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
    };
  }, [stationsWithWalkTimes, onStationSelected, departureId, arrivalId, dispatchRoute]);

  /**
   * InfiniteLoader setup.
   * If we still have more data, we use "stationsWithWalkTimes.length + 1" so we get a "placeholder row."
   */
  const itemCount = hasMore ? stationsWithWalkTimes.length + 1 : stationsWithWalkTimes.length;

  // Tells InfiniteLoader if item at `index` is already loaded
  const isItemLoaded = useCallback(
    (index: number) => index < stationsWithWalkTimes.length,
    [stationsWithWalkTimes]
  );

  // Called when user scrolls near the bottom & the placeholder row appears
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      console.log(`Loading more items from ${startIndex} to ${stopIndex}...`);

      // Example: If we do an API call here, we can update the stations in Redux or local state:
      //   dispatch(...) or setStations([...stations, ...newStations])
      //   if no more data remains:
      //     setHasMore(false);
    },
    [hasMore]
  );

  return (
    <div className="flex flex-col w-full">
      {showLegend && (
        <div className="px-4 py-2 bg-gray-900/60 border-b border-gray-800 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {stationsWithWalkTimes.length} stations found
          </div>
          <div className="flex gap-3">
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
        >
          {(loaderProps: InfiniteLoaderChildProps) => {
            const { onItemsRendered, ref } = loaderProps;

            return (
              <List
                height={height}
                /** Must pass the same itemCount you gave InfiniteLoader: */
                itemCount={itemCount}
                itemSize={70} /* Increased from 60 to accommodate new design */
                width="100%"
                itemData={itemData}
                className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                /** 
                 * The List expects (props: ListOnItemsRenderedProps) => void.
                 * Sometimes TS requires a cast if types don't match exactly.
                 */
                onItemsRendered={onItemsRendered as (props: ListOnItemsRenderedProps) => void}
                ref={ref}
              >
                {StationListItem}
              </List>
            );
          }}
        </InfiniteLoader>
      </div>
    </div>
  );
}

export default memo(StationList);