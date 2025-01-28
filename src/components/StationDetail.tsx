'use client';

import React, { memo, useCallback } from 'react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectStationsWithDistance } from '@/store/stationsSlice';
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation,
  selectArrivalStation,
} from '@/store/userSlice';

export const StationDetail = memo(() => {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const stationId = step === 1 ? departureId : arrivalId;
  if (!stationId) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const isDeparture = step === 1;
  const label = isDeparture ? 'Departure' : 'Arrival';

  const handleClear = useCallback(() => {
    if (isDeparture) {
      dispatch(selectDepartureStation(null));
    } else {
      dispatch(selectArrivalStation(null));
    }
  }, [dispatch, isDeparture]);

  const handleConfirm = useCallback(() => {
    dispatch(advanceBookingStep(step + 1));
    if (isDeparture) {
      toast.success('Departure station confirmed. Now pick your arrival station.');
    } else {
      toast.success('Arrival station confirmed!');
    }
  }, [dispatch, isDeparture, step]);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {station.properties.Place} ({label})
      </h3>
      <p className="text-sm text-muted-foreground">
        Max Power: {station.properties.maxPower} kW
      </p>
      <p className="text-sm text-muted-foreground">
        Available spots: {station.properties.availableSpots}
      </p>
      {station.distance !== undefined && (
        <p className="text-sm text-muted-foreground">
          Distance: {station.distance.toFixed(1)} km
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear
        </button>
        <button
          onClick={handleConfirm}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Confirm {label}
        </button>
      </div>
    </div>
  );
});

StationDetail.displayName = 'StationDetail';
