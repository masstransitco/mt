'use client';

import React, { memo } from 'react';
import { MapPin, Navigation, Zap, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
} from '@/store/userSlice';
import { StationFeature } from '@/store/stationsSlice';

interface StationDetailProps {
  stations: StationFeature[];
  activeStation: StationFeature | null;
}

/**
 * Step meanings (summarized):
 *   1 = selecting_departure_station
 *   2 = selected_departure_station
 *   3 = selecting_arrival_station
 *   4 = selected_arrival_station
 */
export const StationDetail = memo<StationDetailProps>(({ stations, activeStation }) => {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // steps 1 or 2 => departure flow, steps 3 or 4 => arrival flow
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

  const Icon = isDepartureFlow ? MapPin : Navigation;

  // For distance calculations
  const otherStationId = isDepartureFlow ? arrivalId : departureId;
  const otherStation = stations.find(s => s.id === otherStationId);
  const routeDistance =
    otherStation &&
    activeStation.distance !== undefined &&
    otherStation.distance !== undefined
      ? (activeStation.distance + otherStation.distance).toFixed(1)
      : null;

  const handleClear = () => {
    if (isDepartureFlow) {
      dispatch(clearDepartureStation());
      // Revert to step=1 (selecting_departure_station)
      dispatch(advanceBookingStep(1));
      toast.success('Departure station cleared');
    } else {
      dispatch(clearArrivalStation());
      // Revert to step=3 (selecting_arrival_station)
      dispatch(advanceBookingStep(3));
      toast.success('Arrival station cleared');
    }
  };

  const handleConfirm = () => {
    if (isDepartureFlow) {
      // Step 1 or 2 => departure selection
      dispatch({ type: 'user/selectDepartureStation', payload: activeStation.id });

      if (step === 1) {
        // Move to step=2 => selected_departure_station
        dispatch(advanceBookingStep(2));
        toast.success('Departure station selected.');
      } else if (step === 2) {
        // Move to step=3 => selecting_arrival_station
        dispatch(advanceBookingStep(3));
        toast.success('Departure station confirmed. Now select your arrival station.');
      }
    } else {
      // Step 3 or 4 => arrival selection
      dispatch({ type: 'user/selectArrivalStation', payload: activeStation.id });

      if (step === 3) {
        // Move to step=4 => selected_arrival_station
        dispatch(advanceBookingStep(4));
        toast.success('Arrival station selected.');
      } else if (step === 4) {
        // Move to step=5 => payment or finalizing
        dispatch(advanceBookingStep(5));
        toast.success('Route confirmed! Next: payment or finalizing.');
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Station Header */}
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-1 text-primary" />
        <div className="flex-1">
          <h3 className="font-medium">
            {activeStation.properties.Place}
          </h3>
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
          <span className="font-medium">{activeStation.properties.maxPower} kW</span>
        </div>
        {activeStation.properties.waitTime && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Wait Time</span>
            <span className="font-medium">{activeStation.properties.waitTime} min</span>
          </div>
        )}
        {(activeStation.distance !== undefined || routeDistance) && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {routeDistance ? 'Total Route Distance' : 'Distance from You'}
            </span>
            <span className="font-medium">
              {routeDistance || activeStation.distance?.toFixed(1)} km
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
          {isDepartureFlow ? 'Confirm Departure' : 'Confirm Arrival'}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = 'StationDetail';

export default StationDetail;
