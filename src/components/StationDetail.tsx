"use client";

import React, { memo, useEffect } from "react";
import { MapPin, Navigation, Zap, Clock } from "lucide-react";
import { toast } from "react-hot-toast";

import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
} from "@/store/bookingSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/userSlice";
import { StationFeature } from "@/store/stationsSlice";

interface StationDetailProps {
  stations: StationFeature[];
  activeStation: StationFeature | null;
  /** Optional callback triggered after confirming departure in the UI. */
  onConfirmDeparture?: () => void;
}

export const StationDetail = memo<StationDetailProps>((props) => {
  const { stations, activeStation, onConfirmDeparture } = props;

  const dispatch = useAppDispatch();

  // Selectors
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // Debug logs (optional)
  useEffect(() => {
    console.log("[StationDetail] step=", step);
    console.log("[StationDetail] departureId=", departureId);
    console.log("[StationDetail] arrivalId=", arrivalId);
  }, [step, departureId, arrivalId]);

  // If step <= 2 => departure flow, else => arrival flow
  const isDepartureFlow = step <= 2;

  // If there's no active station, show instructions
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

  // Determine which icon to show
  const Icon = isDepartureFlow ? MapPin : Navigation;

  // If we have route info, display distance & duration
  let routeDistanceKm: string | null = null;
  let routeDurationMin: string | null = null;
  if (route && departureId && arrivalId) {
    routeDistanceKm = (route.distance / 1000).toFixed(1);
    routeDurationMin = Math.round(route.duration / 60).toString();
  }

  // Confirm button logic:
  // Step 2 => 3, or Step 4 => 5
  const handleConfirm = () => {
    // If we're in departure flow, maybe step=1 or 2. But we only do confirm for step=2.
    if (isDepartureFlow) {
      if (step === 2) {
        dispatch(advanceBookingStep(3)); // selected_departure => selecting_arrival
        toast.success("Departure station confirmed! Now select your arrival station.");
      }
      // Optionally handle step=1, but from your spec, step=1→2 happens on the map click
      // so we do nothing else here.
      onConfirmDeparture?.();
    } else {
      // arrival flow => step=3 or 4. We only confirm at step=4 => 5
      if (step === 4) {
        dispatch(advanceBookingStep(5)); // arrival selected => final/purchase flow
        toast.success("Arrival station confirmed! Proceeding to payment...");
      }
      // step=3 => 4 is done by map click, so do nothing else here.
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-1 text-primary" />
        <div className="flex-1">
          <h3 className="font-medium">{activeStation.properties.Place}</h3>
          <p className="text-sm text-muted-foreground">
            {isDepartureFlow ? "Departure Station" : "Arrival Station"}
          </p>
        </div>
      </div>

      {/* Station Details */}
      <div className="space-y-2 pl-8">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available Spots</span>
          <span className="font-medium">
            {activeStation.properties.availableSpots}
            <span className="text-muted-foreground pl-1">
              / {activeStation.properties.totalSpots}
            </span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Max Power</span>
          <span className="font-medium">{activeStation.properties.maxPower} kW</span>
        </div>
        {activeStation.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">{activeStation.properties.waitTime} min</span>
          </div>
        )}

        {/* If route is available, show distance/time */}
        {routeDistanceKm && routeDurationMin ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Route Distance</span>
              <span className="font-medium">{routeDistanceKm} km</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated Drive Time</span>
              <span className="font-medium">{routeDurationMin} min</span>
            </div>
          </>
        ) : (
          activeStation.distance !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distance from You</span>
              <span className="font-medium">
                {activeStation.distance.toFixed(1)} km
              </span>
            </div>
          )
        )}
      </div>

      {/* Confirm Button */}
      <div className="pt-2">
        <button
          onClick={handleConfirm}
          // If we haven't actually advanced to step=2 or 4 yet (i.e. still step=1 or 3),
          // we can disable the button. Or you can choose to hide it, etc.
          disabled={!(step === 2 || step === 4)}
          className="w-full px-4 py-2 text-sm font-medium text-white
                     bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed
                     rounded-lg transition-colors"
        >
          {isDepartureFlow ? "Confirm Departure" : "Confirm Arrival"}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = "StationDetail";

export default StationDetail;
