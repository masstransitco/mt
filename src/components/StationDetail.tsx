"use client";

import React, { memo, useEffect, useState, Suspense } from "react";
import { MapPin, Navigation, Zap, Clock, CarFront, Route, Map } from "lucide-react";
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
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";

// Dynamically import MapCard only when needed
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
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapCardLoaded, setMapCardLoaded] = useState(false);

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

  // Toggle map visibility
  const toggleMap = () => {
    setIsMapOpen(!isMapOpen);
    
    // If opening the map for the first time, mark it as loaded
    if (!isMapOpen && !mapCardLoaded) {
      setMapCardLoaded(true);
    }
  };

  // If there's no active station => show placeholder
  if (!activeStation) {
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

  // Extract coordinates for MapCard
  const stationCoordinates = activeStation ? 
    [activeStation.geometry.coordinates[0], activeStation.geometry.coordinates[1]] as [number, number] :
    [0, 0] as [number, number];

  return (
    <motion.div 
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Station name + address */}
      <div className="pl-0 space-y-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-1.5 rounded-full">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <h4 className="text-base font-semibold text-white">
            {activeStation.properties.Place}
          </h4>
          <button 
            onClick={toggleMap}
            className="ml-auto bg-gray-800 hover:bg-gray-700 p-1.5 rounded-full transition-colors"
            aria-label={isMapOpen ? "Hide 3D map" : "Show 3D map"}
          >
            <Map className="w-4 h-4 text-blue-400" />
          </button>
        </div>
        <p className="text-sm text-gray-300 ml-8">
          {activeStation.properties.Address}
        </p>
      </div>

      {/* MapCard component - only rendered when needed */}
      {(isMapOpen || mapCardLoaded) && (
        <Suspense fallback={
          <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        }>
          <MapCard 
            coordinates={stationCoordinates}
            name={activeStation.properties.Place}
            isOpen={isMapOpen}
            onClose={() => setIsMapOpen(false)}
            className="mt-2 mb-2"
          />
        </Suspense>
      )}

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

        {/* Route info or distance */}
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
            isDepartureFlow
              ? "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50"
              : "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50",
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
