'use client';

import React, { useCallback, useMemo } from 'react';
import { MapPin, Navigation, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
  setViewState
} from '@/store/userSlice';
import { selectStationsWithDistance } from '@/store/stationsSlice';

export default function StationSelector() {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const departureStation = useMemo(() =>
    stations.find(s => s.id === departureId),
    [stations, departureId]
  );

  const arrivalStation = useMemo(() =>
    stations.find(s => s.id === arrivalId),
    [stations, arrivalId]
  );

  // Calculate route distance if both stations are selected
  const routeDistance = useMemo(() => {
    if (!departureStation || !arrivalStation) return null;
    const distance = departureStation.distance && arrivalStation.distance
      ? departureStation.distance + arrivalStation.distance
      : null;
    return distance ? distance.toFixed(1) : null;
  }, [departureStation, arrivalStation]);

  // Enhanced input styles with disabled states
  const getDepartureInputStyle = useMemo(() => {
    const baseStyle = "transition-all duration-200";
    if (step === 1) return `${baseStyle} ring-2 ring-primary bg-background`;
    if (departureId) return `${baseStyle} bg-accent/10`;
    return `${baseStyle} bg-muted/50`;
  }, [step, departureId]);

  const getArrivalInputStyle = useMemo(() => {
    const baseStyle = "transition-all duration-200";
    if (step === 2) return `${baseStyle} ring-2 ring-primary bg-background`;
    if (arrivalId) return `${baseStyle} bg-accent/10`;
    return `${baseStyle} bg-muted/50`;
  }, [step, arrivalId]);

  // Enhanced clear handlers with feedback
  const handleClearDeparture = useCallback(() => {
    dispatch(clearDepartureStation());
    toast.success('Departure station cleared');
  }, [dispatch]);

  const handleClearArrival = useCallback(() => {
    dispatch(clearArrivalStation());
    toast.success('Arrival station cleared');
  }, [dispatch]);

  // Handle input click for disabled state feedback
  const handleInputClick = useCallback((inputType: 'departure' | 'arrival') => {
    if (inputType === 'departure' && step !== 1) {
      toast.error('Please confirm arrival station first');
    } else if (inputType === 'arrival' && step !== 2) {
      toast.error('Please select departure station first');
    }
  }, [step]);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-4 space-y-3">
      {/* Departure Input */}
      <div 
        className={`flex items-center gap-2 p-3 rounded-lg ${getDepartureInputStyle}`}
        onClick={() => handleInputClick('departure')}
      >
        <MapPin className={`w-5 h-5 ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`} />
        <input
          type="text"
          placeholder="Choose departure station"
          value={departureStation?.properties.Place || ""}
          readOnly
          disabled={step !== 1}
          className={`
            flex-1 bg-transparent border-none focus:outline-none
            ${step === 1 ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-not-allowed'}
            placeholder:text-muted-foreground
          `}
        />
        {departureId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearDeparture();
            }}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Arrival Input */}
      <div 
        className={`flex items-center gap-2 p-3 rounded-lg ${getArrivalInputStyle}`}
        onClick={() => handleInputClick('arrival')}
      >
        <Navigation className={`w-5 h-5 ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`} />
        <input
          type="text"
          placeholder="Choose arrival station"
          value={arrivalStation?.properties.Place || ""}
          readOnly
          disabled={step !== 2}
          className={`
            flex-1 bg-transparent border-none focus:outline-none
            ${step === 2 ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-not-allowed'}
            placeholder:text-muted-foreground
          `}
        />
        {arrivalId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearArrival();
            }}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Info Bar */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Step {step} of 2</span>
          <span>•</span>
          <span>
            {step === 1 ? 'Select departure station' : 'Select arrival station'}
          </span>
        </div>
        {routeDistance && (
          <div className="text-xs font-medium">
            Total Route: {routeDistance} km
          </div>
        )}
      </div>

      {/* Warning for invalid selection */}
      {departureId && arrivalId && departureId === arrivalId && (
        <div className="flex items-center gap-2 px-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>Departure and arrival stations cannot be the same</span>
        </div>
      )}
    </div>
  );
}
