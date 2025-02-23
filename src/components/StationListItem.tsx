"use client";

import React, { memo, useCallback } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Footprints } from "lucide-react";
import { toast } from "react-hot-toast";
import { StationFeature } from "@/store/stationsSlice";

interface RouteInfo {
  duration?: number;
  distance?: number;
  polyline?: string;
}

export interface StationListItemData {
  items: StationFeature[];
  onStationSelected?: (station: StationFeature) => void;
  departureId?: number | null;
  arrivalId?: number | null;
  dispatchRoute?: RouteInfo | null;
}

interface StationListItemProps extends ListChildComponentProps<StationListItemData> {}

/** The row component for a single station */
function StationListItemComponent(props: StationListItemProps) {
  const { index, style, data } = props;
  const { items, onStationSelected, departureId, arrivalId, dispatchRoute } = data;

  // If index is beyond the loaded items => "Loading more..." placeholder
  if (index >= items.length) {
    return (
      <div style={style} className="px-4 py-3 text-gray-500">
        Loading more...
      </div>
    );
  }

  const station = items[index];
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No onStationSelected callback provided.");
      return;
    }
    onStationSelected(station);
  }, [onStationSelected, station]);

  let dispatchTimePill: JSX.Element | null = null;
  if (isDeparture && dispatchRoute?.duration) {
    const drivingMins = Math.round(dispatchRoute.duration / 60);
    dispatchTimePill = (
      <div className="px-3 py-1.5 rounded-full bg-gray-700 text-sm text-white">
        {drivingMins} min
      </div>
    );
  }

  const walkTime = station.walkTime ?? station.properties?.walkTime ?? 0;

  return (
    <div
      style={style}
      onClick={handleClick}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className={`px-4 py-3 cursor-pointer hover:bg-gray-200 transition-colors ${
        isSelected ? "bg-gray-100" : ""
      }`}
    >
      <div className="flex justify-between items-start">
        {/* LEFT: station name + footprints */}
        <div className="space-y-2">
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

          <div className="flex items-center gap-2 text-sm text-gray-900">
            <Footprints className="w-4 h-4" />
            <span>{walkTime} min walk</span>
          </div>
        </div>

        {/* RIGHT: dispatch driving time pill */}
        {dispatchTimePill}
      </div>
    </div>
  );
}

// Just named export:
export const StationListItem = memo(StationListItemComponent);
StationListItem.displayName = "StationListItem";