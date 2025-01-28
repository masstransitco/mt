'use client';

import React, { memo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { MapPin, Navigation } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectStationsWithDistance } from '@/store/stationsSlice';
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation,
  selectArrivalStation,
  clearDepartureStation,
  clearArrivalStation,
} from '@/store/userSlice';

export const StationDetail = memo(() => {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const stationId = step === 1 ? departureId : arrivalId;
  const station = stations.find((s) => s.id === stationId);

  if (!station) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {step === 1 
          ? 'Select a departure station from the map'
          : 'Select an arrival station from the map'}
      </div>
    );
  }

  const isDeparture = step === 1;
  const Icon = isDeparture ? MapPin : Navigation;

  const handleClear = useCallback(() => {
    if (isDeparture) {
      dispatch(clearDepartureStation());
    } else {
      dispatch(clearArrivalStation());
    }
  }, [dispatch, isDeparture]);

  const handleConfirm = useCallback(() => {
    if (isDeparture) {
      dispatch(advanceBookingStep(2));
      toast.success('Departure station confirmed. Now select your arrival station.');
    } else {
      if (!departureId || !arrivalId) return;
      
      // Both stations selected - proceed with booking
      toast.success('Route confirmed! Proceeding with booking...');
      // TODO: Navigate to booking confirmation or next step
    }
  }, [dispatch, isDeparture, departureId, arrivalId]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-1 text-primary" />
        <div className="flex-1">
          <h3 className="font-medium">
            {station.properties.Place}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isDeparture ? 'Departure Station' : 'Arrival Station'}
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-8">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available Spots</span>
          <span className="font-medium">{station.properties.availableSpots}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Max Power</span>
          <span className="font-medium">{station.properties.maxPower} kW</span>
        </div>
        {station.distance !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distance</span>
            <span className="font-medium">{station.distance.toFixed(1)} km</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          {isDeparture ? 'Confirm & Continue' : 'Confirm Route'}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = 'StationDetail';
