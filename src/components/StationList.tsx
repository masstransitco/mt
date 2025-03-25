"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { StationFeature } from "@/store/stationsSlice";

export interface StationListProps {
  /** Array of station features to display in the list. */
  stations: StationFeature[];
  /** Callback when the user selects a station. */
  onStationClick?: (station: StationFeature) => void;
  /** Whether the list is visible. Parent can hide the sheet altogether if needed. */
  isVisible?: boolean;
  /** Optional: user location if you want to display distances or highlight the closest station. */
  userLocation?: { lat: number; lng: number } | null;
  /** Additional CSS class names for container. */
  className?: string;
}

/**
 * StationList:
 * - Renders a scrollable list of stations.
 * - Expects the parent to handle open/close or step logic.
 * - No overscroll or sheet logic inside; parent’s sheet handles that.
 */
function StationList({
  stations,
  onStationClick,
  isVisible = true,
  userLocation,
  className = "",
}: StationListProps) {
  if (!isVisible || !stations?.length) return null;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {stations.map((station) => {
        // Force null if userLocation is undefined
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

/** Utility to compute a simple distance label if userLocation is available. */
function computeDistanceDisplay(
  userLocation: { lat: number; lng: number } | null,
  station: StationFeature
): string | null {
  if (!userLocation) return null;

  // Make sure station.geometry.coordinates is [lng, lat]:
  const [stationLng, stationLat] = station.geometry.coordinates;

  const R = 6371e3; // Earth radius in meters
  const toRad = (val: number) => (val * Math.PI) / 180;

  const lat1 = toRad(userLocation.lat);
  const lat2 = toRad(stationLat);
  const deltaLat = toRad(stationLat - userLocation.lat);
  const deltaLng = toRad(stationLng - userLocation.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // in meters

  if (distance < 1000) {
    return `${Math.round(distance)}m away`;
  }
  return `${(distance / 1000).toFixed(1)}km away`;
}

export default memo(StationList);