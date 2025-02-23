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

interface StationListProps {
  onStationSelected?: (station: any) => void;
}

function StationList({ onStationSelected }: StationListProps) {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectListStationsWithDistance);
  const hasMore = useAppSelector(selectHasMoreStations);

  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  const itemData = {
    items: stations,
    onStationSelected,
    departureId,
    arrivalId,
    dispatchRoute,
  };

  const itemCount = hasMore ? stations.length + 1 : stations.length;

  const isItemLoaded = useCallback(
    (index: number) => index < stations.length,
    [stations]
  );

  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      console.log(`Loading more items from ${startIndex} to ${stopIndex}...`);
      dispatch(loadNextStationsPage());
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