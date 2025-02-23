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

interface StationListProps {
  /** An array of station data (e.g., your first page of stations). */
  stations: StationFeature[];
  /** A callback when user selects a station from the list. */
  onStationSelected?: (station: StationFeature) => void;
}

/**
 * A parent list component that:
 * - Subscribes to Redux once (for departureId, arrivalId, dispatchRoute)
 * - Uses react-window + react-window-infinite-loader for an "instagram-style" infinite scroll.
 */
function StationList({ stations, onStationSelected }: StationListProps) {
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
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
    >
      {(loaderProps: InfiniteLoaderChildProps) => {
        const { onItemsRendered, ref } = loaderProps;

        return (
          <List
            height={300}
            /** Must pass the same itemCount you gave InfiniteLoader: */
            itemCount={itemCount}
            itemSize={60}
            width="100%"
            itemData={itemData}
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
  );
}

export default memo(StationList);