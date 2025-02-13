"use client";

import React, { memo } from 'react';
import { MapPin, Navigation, Zap, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
} from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from '@/store/userSlice';
import { StationFeature } from '@/store/stationsSlice';

interface StationDetailProps {
  stations: StationFeature[];
  activeStation: StationFeature | null;

  /**
   * Called if the user confirms departure in step=1 or step=2.
   * For arrival, we handle it directly here.
   */
  onConfirmDeparture?: () => void;
}

/**
 * Step meanings (summarized):
 *  1 = selecting_departure_station
 *  2 = selected_departure_station
 *  3 = selecting_arrival_station
 *  4 = selected_arrival_station
 *  5 = payment
 */
export const StationDetail = memo<StationDetailProps>((props) => {
  const { stations, activeStation, onConfirmDeparture } = props;

  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);

  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // If step <= 2 => departure flow, else arrival flow
  const isDepartureFlow = step <= 2;

  // If no station is active, show instructions
  if (!activeStation) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {isDepartureFlow
            ? 'Select a departure station from the map or list below.'
            : 'Select an arrival station from the map or list below.'}
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

  // Icon based on flow
  const Icon = isDepartureFlow ? MapPin : Navigation;

  // If a route object is available, show distance/time
  let routeDistanceKm: string | null = null;
  let routeDurationMin: string | null = null;
  if (route && departureId && arrivalId) {
    routeDistanceKm = (route.distance / 1000).toFixed(1);
    routeDurationMin = Math.round(route.duration / 60).toString();
  }

  // Confirm station selection
  const handleConfirm = () => {
    if (isDepartureFlow) {
      // DEPARTURE FLOW
      dispatch({ type: 'user/selectDepartureStation', payload: activeStation.id });

      if (step === 1) {
        // Step 1 => selected_departure_station
        dispatch(advanceBookingStep(2));
        toast.success('Departure station selected.');
      } else if (step === 2) {
        // Step 2 => selecting_arrival_station
        dispatch(advanceBookingStep(3));
        toast.success('Departure station confirmed. Now select your arrival station.');
      }

      // If parent wants extra logic on confirm
      onConfirmDeparture?.();
    } else {
      // ARRIVAL FLOW
      dispatch({ type: 'user/selectArrivalStation', payload: activeStation.id });
      // Step=3 => step=4 is handled by GMap, so if we got here:
      // we are likely in step=4 => we "Confirm Arrival" => step=5 => payment
      if (step === 4) {
        dispatch(advanceBookingStep(5));
        toast.success('Arrival station confirmed! Opening payment options...');
      }
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
            {isDepartureFlow ? 'Departure Station' : 'Arrival Station'}
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
          <span className="font-medium">
            {activeStation.properties.maxPower} kW
          </span>
        </div>
        {activeStation.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">
              {activeStation.properties.waitTime} min
            </span>
          </div>
        )}

        {/* Driving distance/time if route is available */}
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
          // Otherwise show distance from user if available
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

      {/* Single Action Button => Confirm */}
      <div className="pt-2">
        <button
          onClick={handleConfirm}
          className="w-full px-4 py-2 text-sm font-medium text-white
                     bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {isDepartureFlow ? 'Confirm Departure' : 'Confirm Arrival'}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = 'StationDetail';

export default StationDetail;
