'use client';

import React, { useCallback, useMemo } from 'react';
import { MapPin, Navigation, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep } from '@/store/bookingSlice';
import { 
  selectDepartureStationId, 
  selectArrivalStationId,
  selectStationsWithDistance,
  clearDepartureStation,
  clearArrivalStation
} from '@/store/userSlice';

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

  // Input bar styles based on selection state
  const getDepartureInputStyle = useMemo(() => {
    if (step === 1) return "ring-2 ring-primary";
    return departureId ? "bg-accent/10" : "bg-muted";
  }, [step, departureId]);

  const getArrivalInputStyle = useMemo(() => {
    if (step === 2) return "ring-2 ring-primary";
    return arrivalId ? "bg-accent/10" : "bg-muted";
  }, [step, arrivalId]);

  // Clear selection handlers
  const handleClearDeparture = useCallback(() => {
    dispatch(clearDepartureStation());
  }, [dispatch]);

  const handleClearArrival = useCallback(() => {
    dispatch(clearArrivalStation());
  }, [dispatch]);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-4 space-y-2">
      {/* Departure Input */}
      <div className={`flex items-center gap-2 p-3 rounded-lg transition-all ${getDepartureInputStyle}`}>
        <MapPin className="w-5 h-5 text-primary" />
        <input 
          type="text"
          placeholder="Choose departure station"
          value={departureStation?.properties.Place || ""}
          readOnly
          className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
        />
        {departureId && (
          <button 
            onClick={handleClearDeparture}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Arrival Input */}
      <div className={`flex items-center gap-2 p-3 rounded-lg transition-all ${getArrivalInputStyle}`}>
        <Navigation className="w-5 h-5 text-primary" />
        <input 
          type="text"
          placeholder="Choose arrival station"
          value={arrivalStation?.properties.Place || ""}
          readOnly
          className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
        />
        {arrivalId && (
          <button 
            onClick={handleClearArrival}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Indicator */}
      <div className="flex justify-between px-2 text-xs text-muted-foreground">
        <span>Step {step} of 2</span>
        <span>
          {step === 1 
            ? 'Select departure station' 
            : 'Select arrival station'}
        </span>
      </div>
    </div>
  );
}
