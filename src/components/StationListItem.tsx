"use client";

import React, { memo, useCallback, useEffect, useState } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Footprints, Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";

/**
 * If you define your RouteInfo interface separately,
 * be sure it includes optional fields and can be null:
 */
interface RouteInfo {
  duration?: number;
  distance?: number;
  polyline?: string;
}

/**
 * The data shape we pass to react-window's List:
 * - an array of StationFeature
 * - a callback when user selects a station
 * - optional Redux-derived props, so we don't do store lookups here
 */
export interface StationListItemData {
  items: StationFeature[];
  onStationSelected?: (station: StationFeature) => void;
  departureId?: number | null;
  arrivalId?: number | null;
  /**
   * Must allow null if your store says dispatchRoute can be null
   */
  dispatchRoute?: RouteInfo | null;
}

interface StationListItemProps extends ListChildComponentProps<StationListItemData> {}

/**
 * A single row item in the station list (react-window).
 */
function StationListItemComponent(props: StationListItemProps) {
  const { index, style, data } = props;
  const { items: stations, onStationSelected, departureId, arrivalId, dispatchRoute } = data;
  
  // State to ensure we have walking time calculated
  const [calculatedWalkTime, setCalculatedWalkTime] = useState<number | null>(null);

  // The station for this row
  const station = stations[index];

  // Calculate walk time when component mounts or station changes
  useEffect(() => {
    if (station) {
      // Use the station's walkTime, fallback to properties.walkTime, or default to 0
      const walkTime = station.walkTime ?? station.properties?.walkTime ?? 0;
      setCalculatedWalkTime(walkTime);
    }
  }, [station]);

  if (!station) {
    // If this index is beyond our actual stations, you can render a placeholder
    return (
      <div 
        style={style} 
        className="px-4 py-3 text-gray-400 bg-gray-900/50 border-b border-gray-800"
      >
        <div className="animate-pulse flex space-x-4">
          <div className="h-3 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // Compare station.id (number) to departureId/arrivalId (number | null)
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No onStationSelected callback provided.");
      return;
    }
    onStationSelected(station);
  }, [onStationSelected, station]);

  // Get the dispatch driving time if this is a departure station
  const getDispatchDrivingTime = (): number | null => {
    if (isDeparture && dispatchRoute?.duration) {
      return Math.round(dispatchRoute.duration / 60);
    }
    return null;
  };

  // Walking time and dispatch time
  const walkTime = calculatedWalkTime ?? 0;
  const dispatchDrivingTime = getDispatchDrivingTime();

  return (
    <div
      style={style}
      onClick={handleClick}
      onWheel={(e) => e.stopPropagation()}   // prevent scroll from bubbling
      onTouchMove={(e) => e.stopPropagation()}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors border-b border-gray-800",
        isSelected 
          ? "bg-gray-800" 
          : "bg-black hover:bg-gray-900"
      )}
    >
      <div className="flex justify-between items-start">
        {/* LEFT: Station name + footprints icon */}
        <div className="space-y-2">
          {/* Station name row */}
          <div className="flex items-center gap-2">
            {isSelected ? (
              <div className={cn(
                "p-1 rounded-full",
                isDeparture ? "bg-blue-600" : "bg-green-600"
              )}>
                {isDeparture ? (
                  <MapPin className="w-3 h-3 text-white" />
                ) : (
                  <Navigation className="w-3 h-3 text-white" />
                )}
              </div>
            ) : (
              <div className="p-1 rounded-full bg-gray-800">
                <MapPin className="w-3 h-3 text-gray-400" />
              </div>
            )}
            <h3 className={cn(
              "font-medium",
              isSelected ? "text-white" : "text-gray-300"
            )}>
              {station.properties?.Place ?? "Unnamed Station"}
            </h3>
          </div>

          {/* Bottom row with walk time and dispatch time (if available) */}
          <div className="flex items-center gap-4 text-xs">
            {/* Footprints + walking time */}
            <div className="flex items-center gap-1.5 text-gray-400">
              <Footprints className="w-3.5 h-3.5 text-gray-500" />
              <span>{walkTime} min walk</span>
            </div>
            
            {/* Dispatch driving time (instead of available spots) */}
            {dispatchDrivingTime && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span>{dispatchDrivingTime} min drive</span>
              </div>
            )}
          </div>
        </div>
        
        {/* RIGHT: Empty now that we moved dispatch time to the bottom row */}
      </div>
    </div>
  );
}

export const StationListItem = memo(StationListItemComponent);
StationListItem.displayName = "StationListItem";

export default StationListItem;