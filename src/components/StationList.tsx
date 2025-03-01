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

/**
 * Props for StationList
 */
interface StationListProps {
  /** An array of station data (possibly paged from Redux) */
  stations: StationFeature[];
  /** Callback when user selects a station */
  onStationSelected?: (station: StationFeature) => void;
  /** Optional scrollable height for the list container */
  height?: number;
  /** Whether to show a top legend row */
  showLegend?: boolean;
  /** The user's location (for walking time calc) */
  userLocation?: google.maps.LatLngLiteral | null;
}

/** Helper to calculate walking time */
function calculateWalkingTime(
  station: StationFeature,
  userLocation: google.maps.LatLngLiteral | null
): number {
  if (!userLocation || !station.geometry?.coordinates) return 0;

  const [lng, lat] = station.geometry.coordinates;

  // Basic haversine to get distance in km
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

  // ~12 min per km
  return Math.round(distanceKm * 12);
}

/** Helper to calculate a rough driving time (demo only) */
function calculateDrivingTime(station: StationFeature): number {
  if (!station.geometry?.coordinates) return 0;
  const [lng, lat] = station.geometry.coordinates;

  // “dispatch hub”
  const centerLat = 22.302;
  const centerLng = 114.177;

  // simplistic approach
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
  // Pull from Redux
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * Process the stations immediately so that walkTime/drivingTime are
   * populated on first render (no second pass).
   */
  const processedStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    return stations.map((st) => {
      const walkTime = userLocation ? calculateWalkingTime(st, userLocation) : 0;
      const drivingTime = calculateDrivingTime(st);
      return {
        ...st,
        walkTime,
        drivingTime,
        properties: {
          ...st.properties,
          walkTime,
          drivingTime,
        },
      };
    });
  }, [stations, userLocation]);

  /**
   * For infinite scrolling, maintain how many have been “loaded” into view.
   */
  const [loadedCount, setLoadedCount] = useState(5);
  const [visibleStations, setVisibleStations] = useState<StationFeature[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Whenever processedStations changes, reset or update visible
  useEffect(() => {
    if (processedStations.length === 0) {
      setVisibleStations([]);
      setHasMore(false);
      return;
    }
    const slice = processedStations.slice(0, loadedCount);
    setVisibleStations(slice);
    setHasMore(slice.length < processedStations.length);
  }, [processedStations, loadedCount]);

  /** The data given to each row in react-window */
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: visibleStations,
      onStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
    };
  }, [visibleStations, onStationSelected, departureId, arrivalId, dispatchRoute]);

  /** If we still have more, itemCount includes an extra “placeholder” row. */
  const itemCount = hasMore ? visibleStations.length + 1 : visibleStations.length;

  /** Is item loaded? */
  const isItemLoaded = useCallback(
    (index: number) => index < visibleStations.length,
    [visibleStations]
  );

  /** Called when user scrolls near bottom. */
  const loadMoreItems = useCallback(
    async (startIndex: number, stopIndex: number) => {
      // Example approach: load 5 more each time
      setLoadedCount((prev) => prev + 5);
    },
    []
  );

  return (
    <div className="flex flex-col w-full">
      {showLegend && (
        <div className="px-4 py-2 bg-gray-900/60 border-b border-gray-800 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {stations.length} stations found
          </div>
          <div className="flex gap-3">
            {/* Legend for pickup */}
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-full bg-blue-600">
                <MapPin className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs text-gray-300">Pickup</span>
            </div>
            {/* Legend for dropoff */}
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