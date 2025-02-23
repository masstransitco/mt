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
  /** An array of station data (initially 5, for example). */
  stations: StationFeature[];
  /** A callback when user selects a station from the list. */
  onStationSelected?: (station: StationFeature) => void;
}

/**
 * Parent list component that:
 * - Subscribes to Redux once (for departureId, arrivalId, dispatchRoute)
 * - Uses react-window + react-window-infinite-loader for "instagram-style" infinite scrolling.
 */
function StationList({ stations, onStationSelected }: StationListProps) {
  // Example: track if there's more data to load from the server
  const [hasMore, setHasMore] = useState(true);

  // Single Redux subscription
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * Build the list's "data" object that will be passed to each row
   * so the row can access these fields without another Redux subscription.
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
   *  Infinite Loader Setup:
   *  For demonstration, pretend there's more data if `hasMore` is true.
   */
  // We'll tell the loader how many items we *think* we have in total:
  // If there's more to load, add 1 as a "placeholder" row. (Adjust to fit your API logic.)
  const itemCount = hasMore ? stations.length + 1 : stations.length;

  // Tells InfiniteLoader if we've loaded the item at `index`:
  const isItemLoaded = useCallback(
    (index: number) => index < stations.length,
    [stations]
  );

  // Triggered when the user scrolls near the bottom
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      console.log(`Loading more items from ${startIndex} to ${stopIndex}...`);

      // Example: If we do an API call here, we can update the stations in Redux or local state
      // If there's no more data to load, set hasMore to false:
      // setHasMore(false);
    },
    [hasMore]
  );

  // Render the list with infinite loading
  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
    >
      {(
        loaderProps: InfiniteLoaderChildProps // <-- typed from react-window-infinite-loader
      ) => {
        const { onItemsRendered, ref } = loaderProps;

        return (
          <List
            height={300}
            itemCount={stations.length} // only render rows for the data we have
            itemSize={60}
            width="100%"
            itemData={itemData}
            // The List expects a function with type (props: ListOnItemsRenderedProps) => void
            onItemsRendered={onItemsRendered as (
              props: ListOnItemsRenderedProps
            ) => void}
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
