"use client";

import React, { memo, useEffect, useState, useMemo } from "react";
import { Zap, Clock, CarFront, Route, Navigation } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";

/** Dynamically import the MapCard (always visible now) */
const MapCard = dynamic(() => import("./MapCard"), {
  loading: () => (
    <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  ),
  ssr: false, // Disable server-side rendering for this component
});

interface StationDetailProps {
  /**
   * The currently selected / active station.
   * If null, we show a placeholder.
   */
  activeStation: StationFeature | null;
  stations?: StationFeature[];
  onConfirmDeparture?: () => void;
}

function StationDetailComponent({
  activeStation,
  stations,
  onConfirmDeparture,
}: StationDetailProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  const isDepartureFlow = step <= 2;

  useEffect(() => {
    console.log("[StationDetail] step=", step);
    if (stations && stations.length > 0) {
      console.log("[StationDetail] stations array length=", stations.length);
    }
  }, [step, stations]);

  /** 
   * Calculate an estimated pickup time window if we have a dispatch route 
   */
  const estimatedPickupTime = useMemo(() => {
    if (!dispatchRoute?.duration) return null;

    const now = new Date();
    const arrivalTime = new Date(now.getTime() + dispatchRoute.duration * 1000);

    // Create a 15-minute window
    const arrivalTimeEnd = new Date(arrivalTime.getTime() + 15 * 60 * 1000);

    const formatTime = (date: Date) => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      return `${hours}:${minutesStr}${ampm}`;
    };

    return {
      start: formatTime(arrivalTime),
      end: formatTime(arrivalTimeEnd),
    };
  }, [dispatchRoute?.duration]);

  if (!activeStation) {
    // Placeholder when no station is selected
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-gray-300">
          {isDepartureFlow
            ? "Select a departure station from the map or list below."
            : "Select an arrival station from the map or list below."}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-gray-800/50 flex items-center gap-2 text-gray-300">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>View charging capacity</span>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Check availability</span>
          </div>
        </div>
      </div>
    );
  }

  // If we have route info for departureId->arrivalId
  let routeDistanceKm: string | null = null;
  let routeDurationMin: string | null = null;
  if (route && departureId && arrivalId) {
    routeDistanceKm = (route.distance / 1000).toFixed(1);
    routeDurationMin = Math.round(route.duration / 60).toString();
  }

  /** Handle confirmation flow */
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

  /** Decide the detail header text */
  const getHeaderTitle = () => {
    if (step <= 2) {
      return estimatedPickupTime
        ? `Pickup car at ${estimatedPickupTime.start}-${estimatedPickupTime.end}`
        : "Pick-up station";
    } else {
      return "Trip details";
    }
  };

  const getHeaderSubtitle = () => {
    if (step <= 2) {
      return "Your car will be delivered here";
    } else if (step === 4) {
      return (
        <span>
          Starting fare: <strong className="text-white">HKD $50.00</strong> • $1 / min hereafter
        </span>
      );
    } else {
      return "Return the car at your arrival station";
    }
  };

  // Coordinates for the always-visible map
  const stationCoordinates: [number, number] = [
    activeStation.geometry.coordinates[0],
    activeStation.geometry.coordinates[1],
  ];

  return (
    <motion.div
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Header text (e.g. pick-up station) */}
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-white">
          {getHeaderTitle()}
        </h4>
        <p className="text-sm text-gray-300">{getHeaderSubtitle()}</p>
      </div>

      {/* Always render the MapCard; no toggle or close button */}
      <MapCard
        coordinates={stationCoordinates}
        name={activeStation.properties.Place}
        address={activeStation.properties.Address}
        className="mt-2 mb-2"
      />

      {/* Station stats card */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
        {/* Available spots */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <CarFront className="w-4 h-4 text-blue-400" />
            <span>Available Spots</span>
          </div>
          <span className="font-medium text-white">
            {activeStation.properties.availableSpots}/{activeStation.properties.totalSpots}
          </span>
        </div>

        {/* Wait time if any */}
        {activeStation.properties.waitTime && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Est. Wait Time</span>
            </div>
            <span className="font-medium text-white">
              {activeStation.properties.waitTime} min
            </span>
          </div>
        )}

        {/* If there's a route from departure to arrival, show it. Otherwise fallback. */}
        {routeDistanceKm && routeDurationMin ? (
          <>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Route className="w-4 h-4 text-blue-400" />
                <span>Route Distance</span>
              </div>
              <span className="font-medium text-white">{routeDistanceKm} km</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span>Drive Time</span>
              </div>
              <span className="font-medium text-white">{routeDurationMin} min</span>
            </div>
          </>
        ) : (
          // If the station has a 'distance' property, show that
          activeStation.distance !== undefined && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span>Distance from You</span>
              </div>
              <span className="font-medium text-white">
                {activeStation.distance.toFixed(1)} km
              </span>
            </div>
          )
        )}

        {/* Power info */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>Max Charging Power</span>
          </div>
          <span className="font-medium text-white">
            {activeStation.properties.maxPower} kW
          </span>
        </div>
      </div>

      {/* Confirm button */}
      <div className="pt-3">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4)}
          className={cn(
            "w-full py-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
            "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50",
            "disabled:cursor-not-allowed"
          )}
        >
          {isDepartureFlow ? "Choose Return Station" : "Confirm Trip"}
        </button>
      </div>
    </motion.div>
  );
}

export default memo(StationDetailComponent);
