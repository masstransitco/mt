"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import type { StationFeature } from "@/store/stationsSlice";
import StationListModal from "./StationListModal";

export interface StationListProps {
  stations: StationFeature[];
  onStationClick?: (station: StationFeature) => void;
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
}

/**
 * StationList:
 * - Shows the 3 nearest stations initially
 * - Offers a button to view the full list in a modal
 */
function StationList({
  stations,
  onStationClick,
  userLocation,
  className = "",
}: StationListProps) {
  if (!stations?.length) return null;

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Show only the first 3 by default
  const visibleStations = stations.slice(0, 3);
  const hasMoreStations = stations.length > 3;

  return (
    <>
      <motion.div
        className={`${className} station-list-container`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="space-y-2">
          {visibleStations.map((station) => (
            <button
              key={station.id}
              onClick={() => onStationClick?.(station)}
              className="w-full text-left p-2 bg-gray-800/50 rounded-md shadow-sm hover:bg-gray-700 transition-colors"
            >
              <div className="text-sm font-medium text-white">
                {station.properties.Place}
              </div>
              <div className="text-xs text-gray-400">
                {station.properties.Address || "No address"}
              </div>
            </button>
          ))}
        </div>

        {/* Button to show all stations in a modal */}
        {hasMoreStations && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-3 py-2 text-sm text-blue-400 bg-blue-900/20 rounded-md hover:bg-blue-900/30 transition-colors"
          >
            Show more stations ({stations.length - 3} remaining)
          </button>
        )}
      </motion.div>

      {/* The full-list modal */}
      {isModalOpen && (
        <StationListModal
          stations={stations}
          userLocation={userLocation}
          onStationClick={onStationClick}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

export default memo(StationList);