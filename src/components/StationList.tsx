"use client";

import React, { memo, useCallback, useMemo, useState } from "react";
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
  showLegend = true 
}: StationListProps) {
  // Example: track if there's more data to load from the server
  const [hasMore, setHasMore] = useState(true);

  // Single Redux subscription
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * Build the list's "itemData" prop,
   * so each row can access these fields without a separate Redux subscription.
   */
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: stations,
      onStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
    };
  }, [stations, onStationSelected, departureId, arrivalId, dispatchRoute]);

  /**
   * InfiniteLoader setup.
   * If we still have more data, we use "stations.length + 1" so we get a "placeholder row."
   */
  const itemCount = hasMore ? stations.length + 1 : stations.length;

  // Tells InfiniteLoader if item at `index` is already loaded
  const isItemLoaded = useCallback(
    (index: number) => index < stations.length,
    [stations]
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
            {stations.length} stations found
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
