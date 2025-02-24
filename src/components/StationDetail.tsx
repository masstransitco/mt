"use client";

import React, { memo, useEffect } from "react";
import { MapPin, Navigation, Zap, Clock } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import { StationFeature } from "@/store/stationsSlice";

interface StationDetailProps {
  /**
   * The currently selected / active station.
   * If null, we show placeholder text.
   */
  activeStation: StationFeature | null;
  
  /**
   * The entire list of stations, if needed inside the detail.
   * This is optional, so we mark it with a '?'
   */
  stations?: StationFeature[];

  /** Optional callback after confirming departure. */
  onConfirmDeparture?: () => void;
}

function StationDetailComponent({
  activeStation,
  stations,
  onConfirmDeparture,
}: StationDetailProps) {
  const dispatch = useAppDispatch();

  // Booking-related
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const isDepartureFlow = step <= 2;

  useEffect(() => {
    console.log("[StationDetail] step=", step);
    if (stations && stations.length > 0) {
      console.log("[StationDetail] stations array length=", stations.length);
    }
  }, [step, stations]);

  // If there's no active station => show placeholder
  if (!activeStation) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {isDepartureFlow
            ? "Select a departure station from the map or list below."
            : "Select an arrival station from the map or list below."}
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

  // If we have route info, distance/duration
  let routeDistanceKm: string | null = null;
  let routeDurationMin: string | null = null;
  if (route && departureId && arrivalId) {
    routeDistanceKm = (route.distance / 1000).toFixed(1);
    routeDurationMin = Math.round(route.duration / 60).toString();
  }

  const handleConfirm = () => {
    if (isDepartureFlow) {
      if (step === 2) {
        dispatch(advanceBookingStep(3));
        toast.success("Departure station confirmed! Now select your arrival station.");
        onConfirmDeparture?.();
      }
    } else {
      if (step === 4) {
        dispatch(advanceBookingStep(5));
        toast.success("Arrival station confirmed! Proceeding to payment...");
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Station name + address */}
      <div className="pl-0 space-y-1">
        <h4 className="text-base font-semibold">
          {activeStation.properties.Place}
        </h4>
        <p className="text-sm text-black">
          {activeStation.properties.Address}
        </p>
      </div>

      {/* Station stats: wait time, distance, etc. */}
      <div className="space-y-2">
        {activeStation.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">
              {activeStation.properties.waitTime} min
            </span>
          </div>
        )}

        {routeDistanceKm && routeDurationMin ? (
          <>
            <div className="flex justify-between text-zinc-900">
              <span className="text-muted-foreground">Total Route Distance</span>
              <span className="font-medium">{routeDistanceKm} km</span>
            </div>
            <div className="flex justify-between text-zinc-800">
              <span className="text-muted-foreground">Estimated Drive Time</span>
              <span className="font-medium">{routeDurationMin} min</span>
            </div>
          </>
        ) : (
          activeStation.distance !== undefined && (
            <div className="flex justify-between text-zinc-800">
              <span className="text-muted-foreground">Distance from You</span>
              <span className="font-medium">
                {activeStation.distance.toFixed(1)} km
              </span>
            </div>
          )
        )}
      </div>

      {/* Confirm button */}
      <div className="pt-2">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4)}
          className={
            isDepartureFlow
              ? "w-full px-4 py-2 text-sm font-medium text-black bg-gray-100 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors"
              : "w-full px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed rounded-md transition-colors"
          }
        >
          {isDepartureFlow ? "Choose return station" : "Confirm trip"}
        </button>
      </div>
    </div>
  );
}

export default memo(StationDetailComponent);
