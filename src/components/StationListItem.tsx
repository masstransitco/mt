'use client';

import React, { memo, useCallback } from 'react';
import { ListChildComponentProps } from 'react-window';
import { MapPin, Navigation, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { StationFeature } from '@/store/stationsSlice';
import { selectBookingStep } from '@/store/bookingSlice';
import { 
  selectDepartureStation, 
  selectArrivalStation,
  selectDepartureStationId,
  selectArrivalStationId 
} from '@/store/userSlice';

interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}

export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];
  const dispatch = useAppDispatch();
  
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  const handleClick = useCallback(() => {
    if (step === 1) {
      dispatch(selectDepartureStation(station.id));
      toast.success('Departure station selected');
    } else if (step === 2) {
      if (station.id === departureId) {
        toast.error('Cannot select same station for arrival');
        return;
      }
      dispatch(selectArrivalStation(station.id));
      toast.success('Arrival station selected');
    }
  }, [dispatch, station.id, step, departureId]);

  return (
    <div
      style={style}
      onClick={handleClick}
      className={`
        px-4 py-3 cursor-pointer
        hover:bg-muted/20 transition-colors
        ${isSelected ? 'bg-accent/10' : ''}
      `}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isSelected && (
              <div className="text-primary">
                {isDeparture ? <MapPin className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
              </div>
            )}
            <h3 className="font-medium text-foreground">
              {station.properties.Place}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{station.properties.maxPower} kW max</span>
            <span className="px-1">·</span>
            <span>{station.properties.availableSpots} Available</span>
          </div>
        </div>
        {station.distance !== undefined && (
          <div className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
            {station.distance.toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
});

StationListItem.displayName = 'StationListItem';
