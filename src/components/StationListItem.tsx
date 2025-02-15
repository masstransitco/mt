"use client";

import React, { memo, useCallback, useMemo } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Zap } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppSelector } from "@/store/store";
import { StationFeature } from "@/store/stationsSlice";
import { selectBookingStep } from "@/store/bookingSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/userSlice";

/**
 * The data object passed by react-window to each list item:
 * - `items` is your array of StationFeature
 * - optional `searchLocation` for distance
 * - optional `onStationSelected` callback
 */
interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
  /**
   * We no longer do the direct dispatch in the child.
   * We rely on the parent's callback if they want to set departure/arrival.
   */
  onStationSelected?: (station: StationFeature) => void;
}

/**
 * The props for a single row in react-window:
 * - `data` must be of type `StationListItemData`.
 */
interface StationListItemProps extends ListChildComponentProps {
  data: StationListItemData;
}

/**
 * A single row item in the station list.
 * We do NOT dispatch from here. Instead, we call `onStationSelected(station)`
 * and let the parent decide whether it’s departure or arrival.
 */
const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const { items: stations, searchLocation, onStationSelected } = data;

  // The station corresponding to this row
  const station = stations[index];

  // Only read from Redux to highlight the currently selected departure/arrival
  const bookingStep = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId; // For icon display if selected

  // Optionally compute distance if we have a searchLocation
  const distance = useMemo(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      return station.distance; // fallback if station.distance is available
    }
    const [lng, lat] = station.geometry.coordinates;
    const distMeters = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return distMeters / 1000; // kilometers
  }, [station, searchLocation]);

  // onClick => call parent's callback. No dispatch or step logic here.
  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No onStationSelected callback provided");
      return;
    }
    onStationSelected(station);
  }, [onStationSelected, station]);

  return (
    <div
      style={style}
      onClick={handleClick}
      className={`
        px-4 py-3 cursor-pointer
        hover:bg-muted/20 transition-colors
        ${isSelected ? "bg-accent/10" : ""}
      `}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isSelected && (
              <div className="text-primary">
                {isDeparture ? (
                  <MapPin className="w-4 h-4" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
              </div>
            )}
            <h3 className="font-medium text-foreground">
              {station.properties.Place}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{station.properties.maxPower} kW max</span>
            <span className="px-1">·</span>
            <span>{station.properties.availableSpots} Available</span>
          </div>
        </div>
        {typeof distance === "number" && (
          <div className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
            {distance.toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
});

StationListItem.displayName = "StationListItem";

export default StationListItem;
