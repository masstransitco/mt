"use client";

import { memo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { StationFeature } from "@/store/stationsSlice";
import { X } from "lucide-react"; // For close button

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
 * StationModal: A full-screen modal that shows all stations
 */
function StationModal({
  stations,
  userLocation,
  onStationClick,
  onClose,
}: {
  stations: StationFeature[];
  userLocation?: { lat: number; lng: number } | null;
  onStationClick?: (station: StationFeature) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[1001] bg-black/90 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-gray-900 w-[90vw] h-[90vh] rounded-xl flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">All Stations</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-800 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        
        {/* Modal content - scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 station-list-modal">
          <div className="space-y-2">
            {stations.map((station) => {
              const distanceDisplay = computeDistanceDisplay(userLocation ?? null, station);
              return (
                <button
                  key={station.id}
                  onClick={() => {
                    onStationClick?.(station);
                    onClose();
                  }}
                  className="w-full text-left p-2 bg-gray-800/50 rounded-md shadow-sm hover:bg-gray-700 transition-colors"
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
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * StationList:
 * - Shows the 3 nearest stations initially
 * - Allows the Sheet to naturally size based on content
 * - Provides a button to view all stations in a modal
 */
function StationList({
  stations,
  onStationClick,
  userLocation,
  className = "",
}: StationListProps) {
  if (!stations?.length) return null;
  
  // State to control modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Only show the first 3 stations in the main view
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
        {/* Station list - no fixed height */}
        <div className="space-y-2">
          {visibleStations.map((station) => {
            const distanceDisplay = computeDistanceDisplay(userLocation ?? null, station);
            return (
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
                  {distanceDisplay && ` • ${distanceDisplay}`}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Button to view all stations */}
        {hasMoreStations && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full mt-3 py-2 text-sm text-blue-400 bg-blue-900/20 rounded-md hover:bg-blue-900/30 transition-colors"
          >
            Show more stations ({stations.length - 3} remaining)
          </button>
        )}
      </motion.div>
      
      {/* Modal for viewing all stations */}
      {isModalOpen && (
        <StationModal 
          stations={stations}
          userLocation={userLocation}
          onStationClick={onStationClick}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
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