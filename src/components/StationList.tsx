"use client";

import React, { memo, useCallback } from "react";
import { FixedSizeList as List, ListOnItemsRenderedProps } from "react-window";
import {
  InfiniteLoader,
  InfiniteLoaderChildProps,
} from "react-window-infinite-loader";
import { useAppSelector, useAppDispatch } from "@/store/store";

import {
  selectListStationsWithDistance,
  selectHasMoreStations,
  loadNextStationsPage,
} from "@/store/stationsSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationListItem } from "./StationListItem";

/**
 * If you still need a callback for when the user selects a station, keep it:
 */
interface StationListProps {
  onStationSelected?: (station: any) => void;
}

function StationList({ onStationSelected }: StationListProps) {
  const dispatch = useAppDispatch();

  // 1) Use your "paged" station selector
  const stations = useAppSelector(selectListStationsWithDistance);
  // 2) Also read whether there are more items
  const hasMore = useAppSelector(selectHasMoreStations);

  // Single Redux subscription for route details
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * We build the itemData for each row to avoid additional Redux lookups
   */
  const itemData = {
    items: stations,
    onStationSelected,
    departureId,
    arrivalId,
    dispatchRoute,
  };

  /**
   * itemCount = length plus one placeholder row if hasMore is true
   */
  const itemCount = hasMore ? stations.length + 1 : stations.length;

  /**
   * Tells InfiniteLoader if item at `index` is loaded.
   * If index < stations.length, it's loaded.
   */
  const isItemLoaded = useCallback(
    (index: number) => index < stations.length,
    [stations]
  );

  /**
   * Triggered when the placeholder row (index >= stations.length) appears,
   * meaning the user scrolled near the bottom.
   */
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      console.log(`Loading more items from ${startIndex} to ${stopIndex}...`);
      // Dispatch Redux action to load next 12
      dispatch(loadNextStationsPage());
      // The slice itself will set hasMore=false once we exhaust all stations.
    },
    [dispatch]
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
            itemCount={itemCount}
            itemSize={60}
            width="100%"
            itemData={itemData}
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
