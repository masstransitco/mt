// src/components/StationList.tsx
"use client";

import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
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
 * StationList props.
 */
interface StationListProps {
  /** Stations to display */
  stations: StationFeature[];
  /** React-window list height. */
  height?: number;
  /** Whether to show a small legend row at the top. */
  showLegend?: boolean;
  /** The user's location, typed as LatLngLiteral or null. */
  userLocation?: google.maps.LatLngLiteral | null; // Possibly undefined or null
  /** Whether this list is currently visible (un-minimized). */
  isVisible?: boolean;
  /** Whether to hide the station count (if it's already shown in the header) */
  hideStationCount?: boolean;

  /**
   * Optional callback for station clicks.
   * If not supplied, the component uses its default logic
   * (selecting departure/arrival based on step).
   */
  onStationClick?: (station: StationFeature) => void;
}

/** Basic walking time calculation */
function calculateWalkingTime(
  station: StationFeature,
  userLocation: google.maps.LatLngLiteral | null
): number {
  if (!userLocation || !station.geometry?.coordinates) return 0;

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

  // e.g. walking ~12 min per km
  return Math.round(distanceKm * 12);
}

/** Placeholder driving time calculation */
function calculateDrivingTime(station: StationFeature): number {
  // For demonstration only:
  if (!station.geometry?.coordinates) return 0;
  return 8; // e.g., 8 minutes
}

/**
 * Main StationList component using react-window + infinite scrolling.
 */
function StationList({
  stations,
  height = 300,
  showLegend = true,
  userLocation,
  isVisible = true,
  hideStationCount = false,
  onStationClick,
}: StationListProps) {
  const dispatch = useAppDispatch();
  const listRef = useRef<List | null>(null);

  // For forcing re-renders on visibility changes
  const [forceRenderKey, setForceRenderKey] = useState(0);
  const visibilityChangedRef = useRef(false);

  // Redux states
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  /**
   * If the user didn't supply onStationClick,
   * we use the default logic to set departure or arrival.
   */
  const handleStationSelected = useCallback(
    (station: StationFeature) => {
      if (onStationClick) {
        // If parent provided a custom callback, use that instead
        onStationClick(station);
        return;
      }

      // Otherwise do the default selection logic
      if (step <= 2) {
        dispatch(actionSelectDeparture(station.id));
      } else if (step >= 3 && step <= 4) {
        dispatch(actionSelectArrival(station.id));
      } else {
        toast("Cannot select station at this stage.");
      }
    },
    [onStationClick, step, dispatch]
  );

  /**
   * Preprocess the stations array to embed walkTime + drivingTime.
   * We coerce userLocation to null if it's undefined.
   */
  const processedStations = useMemo(() => {
    return stations.map((st) => {
      const walkTime = calculateWalkingTime(st, userLocation || null);
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

  // Basic infinite-load states
  const [loadedCount, setLoadedCount] = useState(10);
  const [visibleStations, setVisibleStations] = useState<StationFeature[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Update stations slice when loadedCount changes
  useEffect(() => {
    if (!processedStations.length) {
      setVisibleStations([]);
      setHasMore(false);
      return;
    }
    const slice = processedStations.slice(0, loadedCount);
    setVisibleStations(slice);
    setHasMore(slice.length < processedStations.length);
  }, [processedStations, loadedCount]);

  // Force re-render when we become visible again
  useEffect(() => {
    if (isVisible && visibilityChangedRef.current) {
      setForceRenderKey((prev) => prev + 1);
      // Reset loaded count so it can re-load
      setLoadedCount(10);
      visibilityChangedRef.current = false;

      // Reset list's scroll
      if (listRef.current) {
        listRef.current.scrollTo(0);
        // Some versions of react-window have resetAfterIndex
        if (
          "resetAfterIndex" in listRef.current &&
          typeof (listRef.current as any).resetAfterIndex === "function"
        ) {
          (listRef.current as any).resetAfterIndex(0, true);
        }
      }
    } else if (!isVisible) {
      // Mark that we changed visibility
      visibilityChangedRef.current = true;
    }
  }, [isVisible]);

  // Setup itemData for each row
  const itemData = useMemo<StationListItemData>(() => {
    return {
      items: visibleStations,
      onStationSelected: handleStationSelected,
      departureId,
      arrivalId,
      dispatchRoute,
      forceRenderKey,
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
  const loadMoreItems = useCallback(() => {
    setLoadedCount((prev) => prev + 5);
  }, []);

  // The actual row renderer
  const renderItem = useCallback((props: any) => {
    return <StationListItem {...props} />;
  }, []);

  // If not visible, render hidden placeholder
  if (!isVisible) {
    return <div className="hidden" />;
  }

  return (
    <div
      className="flex flex-col w-full"
      key={`station-list-container-${forceRenderKey}`}
    >
      {showLegend && (
        <div className="px-4 py-2 bg-gray-900/60 border-b border-gray-800 flex justify-between items-center">
          
          {/* Always show legend icons, even when count is hidden */}
          <div className={`flex gap-3 ${hideStationCount ? "w-full justify-end" : ""}`}>
            {/* Example legend icons */}
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
                if (typeof ref === "function") {
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
}

export default memo(StationList);