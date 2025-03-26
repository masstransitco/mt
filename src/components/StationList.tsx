"use client";

import { memo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { StationFeature } from "@/store/stationsSlice";

export interface StationListProps {
  /** Array of station features to display in the list. */
  stations: StationFeature[];
  /** Callback when the user selects a station. */
  onStationClick?: (station: StationFeature) => void;
  /** Optional: user location if you want to display distances. */
  userLocation?: { lat: number; lng: number } | null;
  /** Additional CSS class names for container. */
  className?: string;
}

/**
 * StationList:
 * - Shows only 5 stations at first, and loads more as user scrolls.
 * - Uses a single <motion.div>, so it stays in sync with Framer Motion.
 * - The parent Sheet controls minimize/expand states and overall positioning.
 */
function StationList({
  stations,
  onStationClick,
  userLocation,
  className = "",
}: StationListProps) {
  if (!stations?.length) return null;

  // Track how many stations are currently displayed
  const [visibleCount, setVisibleCount] = useState(5);

  // On scroll, if near the bottom, load 5 more stations
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight + 50 >= el.scrollHeight) {
        setVisibleCount((prev) => Math.min(prev + 5, stations.length));
      }
    },
    [stations.length]
  );

  return (
    <motion.div
      // Add overflow and a max-height so only ~5 items appear initially
      // (adjust as needed for your design)
      className={`${className} overflow-y-auto max-h-[400px]`}
      onScroll={handleScroll}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {stations.slice(0, visibleCount).map((station) => {
        const distanceDisplay = computeDistanceDisplay(userLocation ?? null, station);
        return (
          <button
            key={station.id}
            onClick={() => onStationClick?.(station)}
            className="w-full text-left p-2 mb-2 bg-gray-800/50 rounded-md shadow-sm hover:bg-gray-700 transition-colors"
          >
            <div className="text-sm font-medium text-white">
              {station.properties.Place}
            </div>
            <div className="text-xs text-gray-400">
              {station.properties.Address || "No address"}
              {distanceDisplay && ` • ${distanceDisplay}`}
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

/** Example distance calculation, returns e.g. "245m away" or "2.5km away". */
function computeDistanceDisplay(
  userLocation: { lat: number; lng: number } | null,
  station: StationFeature
): string | null {
  if (!userLocation) return null;

  const [stationLng, stationLat] = station.geometry.coordinates;
  const dx = stationLng - userLocation.lng;
  const dy = stationLat - userLocation.lat;
  const distanceInDegrees = Math.sqrt(dx * dx + dy * dy);

  // Roughly convert degrees to meters (111 km per degree).
  const distanceInMeters = distanceInDegrees * 111000;

  if (distanceInMeters < 1000) {
    return `${distanceInMeters.toFixed(0)}m away`;
  } else {
    const distanceInKm = distanceInMeters / 1000;
    return `${distanceInKm.toFixed(1)}km away`;
  }
}

export default memo(StationList);