"use client";

import React, { memo, useCallback } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Zap, Clock, Footprints } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppSelector } from "@/store/store";
import { StationFeature } from "@/store/stationsSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import {
  selectDispatchRoute, // driving time from dispatch hub->station
} from "@/store/dispatchSlice";

/** 
 * The data shape we pass to react-window's List:
 * - an array of StationFeature
 * - a callback when user selects a station 
 */
interface StationListItemData {
  items: StationFeature[];
  onStationSelected?: (station: StationFeature) => void;
}

interface StationListItemProps extends ListChildComponentProps {
  data: StationListItemData;
}

/**
 * A single row item in the station list (react-window).
 * Now:
 * 1) Darker text
 * 2) Footprints icon + walking time
 * 3) Driving-time pill on the right side if station is the chosen departure
 */
function StationListItemComponent(props: StationListItemProps) {
  const { index, style, data } = props;
  const { items: stations, onStationSelected } = data;

  // The station for this row
  const station = stations[index];

  // Redux store
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute); 
  // e.g. { distance, duration, ... } for the *currently selected* departure station

  // Is this station selected?
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  // onClick => call parent's callback
  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No onStationSelected callback provided.");
      return;
    }
    onStationSelected(station);
  }, [onStationSelected, station]);

  // We'll format the dispatch driving time if this station is the departure
  let dispatchTimePill: JSX.Element | null = null;
  if (isDeparture && dispatchRoute?.duration) {
    const drivingMins = Math.round(dispatchRoute.duration / 60);
    dispatchTimePill = (
      <div className="px-3 py-1.5 rounded-full bg-gray-700 text-sm text-white">
        {drivingMins} min
      </div>
    );
  }

  // We'll also show the walking time from user → station (minutes)
  // assuming it's stored in station.properties.walkTime
  const walkTime = station.walkTime ?? 0; // fallback 0

  return (
    <div
      style={style}
      onClick={handleClick}
      // Prevent scroll events from bubbling up
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className={`
        px-4 py-3 cursor-pointer
        hover:bg-gray-200 transition-colors
        ${isSelected ? "bg-gray-100" : ""}
      `}
    >
      <div className="flex justify-between items-start">
        {/* Left side: station name + foot icon */}
        <div className="space-y-2">
          {/* Station name row */}
          <div className="flex items-center gap-2">
            {/* If selected: show pin icon (departure) or nav icon (arrival) */}
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
              {station.properties.Place}
            </h3>
          </div>

          {/* Replaced the old maxPower line with footprints + walking time */}
          <div className="flex items-center gap-2 text-sm text-gray-900">
            <Footprints className="w-4 h-4" />
            <span>{walkTime} min walk</span>
          </div>
        </div>

        {/* Right side: dispatch driving time (pill) if this station is the departure */}
        {dispatchTimePill}
      </div>
    </div>
  );
}

export const StationListItem = memo(StationListItemComponent);
StationListItem.displayName = "StationListItem";

export default StationListItem;
