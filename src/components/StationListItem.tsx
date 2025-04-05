"use client";

import React, { memo, useCallback } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Footprints, CarFront } from "lucide-react";
import { toast } from "react-hot-toast";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";

/** If you define your RouteInfo interface separately. */
interface RouteInfo {
  duration?: number;
  distance?: number;
  polyline?: string;
}

/** 
 * The data shape we pass to react-window's List: 
 */
export interface StationListItemData {
  items: StationFeature[];
  onStationSelected?: (station: StationFeature) => void;
  departureId?: number | null;
  arrivalId?: number | null;
  dispatchRoute?: RouteInfo | null;
  forceRenderKey?: number; // Added key for forced rerenders
}

interface StationListItemProps
  extends ListChildComponentProps<StationListItemData> {}

/** A single row item in the station list (react-window). */
function StationListItemComponent(props: StationListItemProps) {
  const { index, style, data } = props;
  const {
    items: stations,
    onStationSelected,
    departureId,
    arrivalId,
    dispatchRoute,
    forceRenderKey, // This is used to force rerenders but doesn't need to be directly accessed
  } = data;

  const station = stations[index];
  if (!station) {
    // placeholder row
    return (
      <div 
        style={style} 
        className="px-4 py-3 text-gray-400 bg-gray-900/50 border-b border-gray-800"
      >
        <div className="animate-pulse flex space-x-4">
          <div className="h-3 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const isDeparture = station.id === departureId;
  const isArrival = station.id === arrivalId;
  const isSelected = isDeparture || isArrival;

  // On click, we call the parent
  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No callback for station selection!");
      return;
    }
    onStationSelected(station);
  }, [onStationSelected, station]);

  // Maybe show walkTime or dispatch time
  const walkTime = station.walkTime ?? station.properties?.walkTime ?? 0;
  const showWalkTime = walkTime > 0;

  let displayTime: number | null = null;
  let showCarIcon = false;
  if (isDeparture && dispatchRoute?.duration) {
    displayTime = Math.round(dispatchRoute.duration / 60);
    showCarIcon = true;
  }

  return (
    <div
      style={style}
      onClick={handleClick}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors border-b border-gray-800",
        isSelected ? "bg-gray-800" : "bg-black hover:bg-gray-900"
      )}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
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

          {(showWalkTime || displayTime) && (
            <div className="flex items-center gap-4 text-xs">
              {showWalkTime && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Footprints className="w-3.5 h-3.5 text-gray-500" />
                  <span>{walkTime} min walk</span>
                </div>
              )}
              {showCarIcon && displayTime && (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <CarFront className="w-3.5 h-3.5 text-gray-500" />
                  <span>{displayTime} mins away</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const StationListItem = memo(StationListItemComponent);
StationListItem.displayName = "StationListItem";

export default StationListItem;