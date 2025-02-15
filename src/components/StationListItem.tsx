"use client";

import React, { memo, useCallback, useMemo } from "react";
import { ListChildComponentProps } from "react-window";
import { MapPin, Navigation, Zap } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppSelector, useAppDispatch } from "@/store/store";
import { StationFeature } from "@/store/stationsSlice";
import { selectBookingStep, advanceBookingStep } from "@/store/bookingSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/userSlice";

/**
 * The data object passed by react-window to each list item:
 * - `items` is your array of StationFeature
 * - optional `searchLocation` for distance
 */
interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
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
 * This component now handles station selection by dispatching updates based on the booking step.
 */
export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const { items: stations, searchLocation } = data;

  // The station corresponding to this list row
  const station = stations[index];

  // Redux dispatch and state
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId; // for icon display

  // Optionally compute distance if we have a searchLocation.
  const distance = useMemo(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      return station.distance; // fallback to station.distance if present
    }
    const [lng, lat] = station.geometry.coordinates;
    const distMeters = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return distMeters / 1000; // kilometers
  }, [station, searchLocation]);

  /**
   * Handle click on a station item.
   * - If bookingStep is 1 or 2, update (or replace) the departure station.
   * - If bookingStep is 3 or 4, update (or replace) the arrival station.
   */
  const handleClick = useCallback(() => {
    if (bookingStep === 1 || bookingStep === 2) {
      dispatch({ type: "user/selectDepartureStation", payload: station.id });
      if (bookingStep === 1) {
        dispatch(advanceBookingStep(2));
      }
      toast.success("Departure station selected! (Confirm in station detail.)");
    } else if (bookingStep === 3 || bookingStep === 4) {
      dispatch({ type: "user/selectArrivalStation", payload: station.id });
      if (bookingStep === 3) {
        dispatch(advanceBookingStep(4));
      }
      toast.success("Arrival station selected! (Confirm in station detail.)");
    } else {
      toast(`Station clicked, but no action—currently at step ${bookingStep}`);
    }
  }, [bookingStep, dispatch, station]);

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
