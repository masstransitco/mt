"use client";

import React, { memo, useCallback, useMemo } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Zap } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppSelector } from "@/store/store";
import { StationFeature } from "@/store/stationsSlice";
/**
 * IMPORTANT: We now import station IDs from the **booking slice**:
 */
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";

interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
  onStationSelected?: (station: StationFeature) => void;
}

interface StationListItemProps extends ListChildComponentProps {
  data: StationListItemData;
}

/**
 * A single row item in the station list (via react-window).
 * Displays station info and highlights if it's selected as departure/arrival.
 */
export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const { items: stations, searchLocation, onStationSelected } = data;

  // The station corresponding to this list row
  const station = stations[index];

  // Instead of from userSlice, now from bookingSlice
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId; // for icon display vs arrival

  // Optionally compute distance if we have a searchLocation.
  const distance = useMemo(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      // fallback to station.distance if present in your StationFeature
      return station.distance;
    }
    const [lng, lat] = station.geometry.coordinates;
    const distMeters = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return distMeters / 1000; // convert to kilometers
  }, [station, searchLocation]);

  const handleClick = useCallback(() => {
    if (!onStationSelected) {
      toast("No onStationSelected callback provided.");
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
