"use client";

import React, { memo, useCallback } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Footprints } from "lucide-react";
import { toast } from "react-hot-toast";
import { StationFeature } from "@/store/stationsSlice";

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

  // The station for this row
  const station = stations[index];

  if (!station) {
    // If this index is beyond our actual stations, you can render a placeholder
    return (
      <div style={style} className="px-4 py-3 text-gray-500">
        Loading...
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

  // Show "dispatch driving time" if station is departure & we have dispatchRoute
  let dispatchTimePill: JSX.Element | null = null;
  if (isDeparture && dispatchRoute?.duration) {
    const drivingMins = Math.round(dispatchRoute.duration / 60);
    dispatchTimePill = (
      <div className="px-3 py-1.5 rounded-full bg-gray-700 text-sm text-white">
        {drivingMins} min
      </div>
    );
  }

  // Show walking time from user → station (if available)
  const walkTime = station.walkTime ?? station.properties?.walkTime ?? 0;

  return (
    <div
      style={style}
      onClick={handleClick}
      onWheel={(e) => e.stopPropagation()}   // prevent scroll from bubbling
      onTouchMove={(e) => e.stopPropagation()}
      className={`px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors ${
        isSelected ? "bg-gray-100" : ""
      }`}
    >
      <div className="flex justify-between items-start">
        {/* LEFT: Station name + footprints icon */}
        <div className="space-y-2">
          {/* Station name row */}
          <div className="flex items-center gap-2">
            {isSelected && (
              <div className="text-blue-600">
                {isDeparture ? (
                  <MapPin className="w-4 h-4" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </div>
            )}
            <h3 className="font-medium text-black">
              {station.properties?.Place ?? "Unnamed Station"}
            </h3>
          </div>

          {/* Footprints + walking time */}
          <div className="flex items-center gap-2 text-sm text-gray-900">
            <Footprints className="w-4 h-4" />
            <span>{walkTime} min walk</span>
          </div>
        </div>

        {/* RIGHT: Dispatch driving time pill (if any) */}
        {dispatchTimePill}
      </div>
    </div>
  );
}

export const StationListItem = memo(StationListItemComponent);
StationListItem.displayName = "StationListItem";

export default StationListItem;
