"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
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
  stations: StationFeature[];
  onStationSelected?: (station: StationFeature) => void;
  height?: number;
  showLegend?: boolean;
  userLocation?: google.maps.LatLngLiteral | null;
}

/** Helper to calculate walking time based on distance */
function calculateWalkingTime(
  station: StationFeature,
  userLocation: google.maps.LatLngLiteral | null
): number {
  if (!userLocation || !station.geometry?.coordinates) return 0;

  const [lng, lat] = station.geometry.coordinates;

  // Basic Haversine formula to calculate distance in km
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371; // Earth’s radius in km
  const dLat = toRad(userLocation.lat - lat);
  const dLng = toRad(userLocation.lng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(userLocation.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  // e.g. ~12 min per km
  const MIN_PER_KM = 12;
  return Math.round(distanceKm * MIN_PER_KM);
}

/** Helper to calculate driving time (demo version). */
function calculateDrivingTime(station: StationFeature): number {
  if (!station.geometry?.coordinates) return 0;
  const [lng, lat] = station.geometry.coordinates;

  // Example center or dispatch hub
  const centerLat = 22.302;
  const centerLng = 114.177;

  // Simple formula
  const distanceFactor = Math.abs(lat - centerLat) + Math.abs(lng - centerLng);
  return Math.max(5, Math.round(distanceFactor * 100));
}

function StationList({
  stations,
  onStationSelected,
  height = 300,
  showLegend = true,
  userLocation,
}: StationListProps) {
  // Single Redux subscription
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * 1) Immediately “process” (augment) the raw stations so that
   *    each station has station.walkTime and station.drivingTime.
   *
   * By putting this inside `useMemo`, we ensure that any time
   * `stations` or `userLocation` changes, we recalc them.
   * This means on the very first render that has stations,
   * these times are already populated (no extra useEffect pass).
   */
  const processedStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];

    return stations.map((station) => {
      const walkTime = userLocation ? calculateWalkingTime(station, userLocation) : 0;
      const drivingTime = calculateDrivingTime(station);

      // Return a fresh object so we don’t mutate the original
      return {
        ...station,
        walkTime,
        drivingTime,
        properties: {
          ...station.properties,
          walkTime,
          drivingTime,
        },
      };
    });
  }, [stations, userLocation]);

  /**
   * 2) Because you want infinite scrolling, we keep track of
   *    how many of the processed stations are “visible”.
   */
  const [visibleStations, setVisibleStations] = useState<StationFeature[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(5);

  /**
   * Whenever “processedStations” changes, we reset the visible
   * portion to the first `loadedCount`.
   */
  useEffect(() => {
    if (processedStations.length === 0) {
      setVisibleStations([]);
      setHasMore(false);
      return;
    }
    const initial = Math.min(loadedCount, processedStations.length);
    setVisibleStations(processedStations.slice(0, initial));
    setHasMore(initial < processedStations.length);
  }, [processedStations, loadedCount]);

  /**
   * This is the data we pass to each row component in react-window.
   */
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: visibleStations,
      onStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
    };
  }, [visibleStations, onStationSelected, departureId, arrivalId, dispatchRoute]);

  /**
   * 3) Infinite Loader config:
   *    - itemCount includes an extra placeholder row if we “haveMore”
   *    - isItemLoaded checks if index < visibleStations.length
   *    - loadMoreItems increments how many stations we’re showing
   */
  const itemCount = hasMore ? visibleStations.length + 1 : visibleStations.length;

  const isItemLoaded = useCallback(
    (index: number) => index < visibleStations.length,
    [visibleStations]
  );

  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      // Load 5 more at a time, for example
      const nextBatch = 5;
      const newCount = loadedCount + nextBatch;
      setLoadedCount((prev) => prev + nextBatch);

      // After setLoadedCount triggers the effect above,
      // “visibleStations” will become the next slice, etc.
    },
    [loadedCount]
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
                itemCount={itemCount}
                itemSize={70}
                width="100%"
                itemData={itemData}
                onItemsRendered={onItemsRendered as (
                  props: ListOnItemsRenderedProps
                ) => void}
                ref={ref}
                className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
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
