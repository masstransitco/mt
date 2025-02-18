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
} from "@/store/bookingSlice"; // <-- Now importing from bookingSlice
import { StationFeature } from "@/store/stationsSlice";

interface StationDetailProps {
  stations: StationFeature[];
  activeStation: StationFeature | null;
  /** Optional callback triggered after confirming departure in the UI. */
  onConfirmDeparture?: () => void;
}

function StationDetailComponent(props: StationDetailProps) {
  const { stations, activeStation, onConfirmDeparture } = props;
  const dispatch = useAppDispatch();

  // Booking-related selectors
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // For internal logic: are we in the "selecting departure" flow or "selecting arrival" flow?
  const isDepartureFlow = step <= 2;

  useEffect(() => {
    console.log("[StationDetail] step=", step);
    console.log("[StationDetail] departureId=", departureId);
    console.log("[StationDetail] arrivalId=", arrivalId);
  }, [step, departureId, arrivalId]);

  // If there's no active station, show instructions or an empty state
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

  // If we have route info, display distance & duration
  let routeDistanceKm: string | null = null;
  let routeDurationMin: string | null = null;
  if (route && departureId && arrivalId) {
    routeDistanceKm = (route.distance / 1000).toFixed(1);
    routeDurationMin = Math.round(route.duration / 60).toString();
  }

  // Confirm button logic
  const handleConfirm = () => {
    if (isDepartureFlow) {
      // Confirm departure flow
      if (step === 2) {
        dispatch(advanceBookingStep(3));
        toast.success(
          "Departure station confirmed! Now select your arrival station."
        );
        onConfirmDeparture?.();
      }
    } else {
      // Confirm arrival flow
      if (step === 4) {
        dispatch(advanceBookingStep(5));
        toast.success("Arrival station confirmed! Proceeding to payment...");
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* === Station Name + Address === */}
      <div className="pl-0 space-y-1">
        <h4 className="text-base font-semibold">
          {activeStation.properties.Place}
        </h4>
        <p className="text-sm text-muted-foreground">
          {activeStation.properties.Address}
        </p>
      </div>

      {/* === Station Details (removing AvailableSpots & maxPower if you prefer) === */}
      <div className="space-y-2">
        {activeStation.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">
              {activeStation.properties.waitTime} min
            </span>
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

      {/* === Confirm Button === */}
      <div className="pt-2">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4)}
          className={
            isDepartureFlow
              ? // Departure button: light gray bg, dark text
                "w-full px-4 py-2 text-sm font-medium text-black bg-gray-100 " +
                "hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed " +
                "rounded-md transition-colors"
              : // Arrival button: primary bg, white text
                "w-full px-4 py-2 text-sm font-medium text-white bg-primary " +
                "hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed " +
                "rounded-md transition-colors"
          }
        >
          {isDepartureFlow ? "Confirm Departure" : "Confirm Arrival"}
        </button>
      </div>
    </div>
  );
}

const StationDetail = memo(StationDetailComponent);
StationDetail.displayName = "StationDetail";

export default StationDetail;
