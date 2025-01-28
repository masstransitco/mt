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
  const Icon = isDeparture ? MapPin : Navigation;

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
        px-4 py-3 cursor
