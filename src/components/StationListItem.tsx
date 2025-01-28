'use client';

import React, { memo, useCallback, CSSProperties } from 'react';
import { ListChildComponentProps } from 'react-window';
import { Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { StationFeature } from '@/store/stationsSlice';
import { selectBookingStep } from '@/store/bookingSlice';
import { selectDepartureStation, selectArrivalStation } from '@/store/userSlice';

interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}

const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  const handleClick = useCallback(() => {
    if (step === 1) {
      dispatch(selectDepartureStation(station.id));
      toast.success('Departure station selected!');
    } else if (step === 2) {
      dispatch(selectArrivalStation(station.id));
      toast.success('Arrival station selected!');
    }
  }, [dispatch, station.id, step]);

  return (
    <div
      style={style as CSSProperties}
      className="px-4 py-3 hover:bg-muted/20 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="font-medium text-foreground">
            {station.properties.Place}
          </h3>
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

export default StationListItem;
