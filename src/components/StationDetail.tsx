"use client";

import React, { memo, useCallback } from "react";
import { toast } from "react-hot-toast";
import { MapPin, Navigation, Zap, Clock } from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectStationsWithDistance } from "@/store/stationsSlice";
import { selectBookingStep, advanceBookingStep } from "@/store/bookingSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
} from "@/store/userSlice";
import { setViewState } from "@/store/uiSlice";

export const StationDetail = memo(() => {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  // Decide which station is currently relevant
  const stationId = step === 1 ? departureId : arrivalId;
  const station = stations.find((s) => s.id === stationId);

  // Even if station is null, we still call these hooks before returning
  const isDeparture = step === 1;
  const Icon = isDeparture ? MapPin : Navigation;

  // For route distance
  const otherStationId = isDeparture ? arrivalId : departureId;
  const otherStation = stations.find((s) => s.id === otherStationId);
  const routeDistance =
    otherStation && station?.distance !== undefined && otherStation.distance !== undefined
      ? (station.distance + otherStation.distance).toFixed(1)
      : null;

  // Clear button handler
  const handleClear = useCallback(() => {
    if (isDeparture) {
      dispatch(clearDepartureStation());
      toast.success("Departure station cleared");
    } else {
      dispatch(clearArrivalStation());
      toast.success("Arrival station cleared");
    }
  }, [dispatch, isDeparture]);

  // Confirm button handler
  const handleConfirm = useCallback(() => {
    if (isDeparture) {
      // Move to step 2: arrival
      dispatch(advanceBookingStep(2));
      toast.success("Departure station confirmed. Now select your arrival station.");
    } else {
      // Both stations selected, proceed to vehicle selection
      if (!departureId || !arrivalId) return;
      dispatch(advanceBookingStep(3));
      dispatch(setViewState("showCar"));
      toast.success("Route confirmed! Select your vehicle.");
    }
  }, [dispatch, isDeparture, departureId, arrivalId]);

  // If no station is selected, render "empty state"
  if (!station) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {step === 1
            ? "Select a departure station from the map or list below"
            : "Select an arrival station to complete your route"}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="p-3 rounded-lg bg-muted/10 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>View charging capacity</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/10 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Check availability</span>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render station details
  return (
    <div className="p-4 space-y-4">
      {/* Station Header */}
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-1 text-primary" />
        <div className="flex-1">
          <h3 className="font-medium">{station.properties.Place}</h3>
          <p className="text-sm text-muted-foreground">
            {isDeparture ? "Departure Station" : "Arrival Station"}
          </p>
        </div>
      </div>

      {/* Station Details */}
      <div className="space-y-2 pl-8">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available Spots</span>
          <span className="font-medium">
            {station.properties.availableSpots}
            <span className="text-muted-foreground pl-1">
              / {station.properties.totalSpots}
            </span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Max Power</span>
          <span className="font-medium">{station.properties.maxPower} kW</span>
        </div>
        {station.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">{station.properties.waitTime} min</span>
          </div>
        )}
        {(station.distance !== undefined || routeDistance) && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {routeDistance ? "Total Route Distance" : "Distance from You"}
            </span>
            <span className="font-medium">
              {routeDistance || station.distance?.toFixed(1)} km
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground 
                     bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 px-4 py-2 text-sm font-medium text-white 
                     bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {isDeparture ? "Confirm & Continue" : "Confirm Route"}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = "StationDetail";

export default StationDetail;
