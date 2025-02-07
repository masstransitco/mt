'use client';

import React, { memo, useCallback } from 'react';
import { ListChildComponentProps } from 'react-window';
import { MapPin, Navigation, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import { StationFeature } from '@/store/stationsSlice';
import { selectBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation as setDepartureStation,
  selectArrivalStation as setArrivalStation,
} from '@/store/userSlice';

// 1) Extend the interface to allow an optional onStationSelected callback
interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
  /**
   * (Optional) A callback that the parent (e.g. GMap) can provide to do additional
   * actions (like opening a StationDetail sheet) once a station is selected from the list.
   */
  onStationSelected?: (selectedStation: StationFeature) => void;
}

interface StationListItemProps extends ListChildComponentProps {
  // 2) Our `data` object now has the StationListItemData type
  data: StationListItemData;
}

export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const { items: stations, searchLocation, onStationSelected } = data;

  const station = stations[index];
  const dispatch = useAppDispatch();

  // 3) Booking context from Redux
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // 4) Is this station currently selected?
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  // 5) (Optional) Distance calculation if `searchLocation` is available
  const getDistance = useCallback(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      return station.distance; // Maybe you already stored station.distance
    }
    const [lng, lat] = station.geometry.coordinates;
    const dist = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return dist / 1000; // km
  }, [station, searchLocation]);

  // 6) Handling station click => set departure/arrival in Redux => optional callback
  const handleClick = useCallback(() => {
    if (step === 1) {
      // selecting departure station
      if (station.id === arrivalId) {
        toast.error('Cannot select the same station for departure and arrival');
        return;
      }
      dispatch(setDepartureStation(station.id));
      toast.success('Departure station selected');
    } else if (step === 2) {
      // selecting arrival station
      if (station.id === departureId) {
        toast.error('Cannot select the same station for arrival');
        return;
      }
      dispatch(setArrivalStation(station.id));
      toast.success('Arrival station selected');
    }
    // 7) If the parent passed an onStationSelected callback, call it now
    onStationSelected?.(station);
  }, [
    step,
    station,
    arrivalId,
    departureId,
    dispatch,
    onStationSelected,
  ]);

  const distance = getDistance();

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
          {/* Station name + icon */}
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

          {/* Station info (maxPower, availableSpots, etc.) */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{station.properties.maxPower} kW max</span>
            <span className="px-1">·</span>
            <span>{station.properties.availableSpots} Available</span>
          </div>
        </div>

        {/* Distance if available */}
        {distance !== undefined && (
          <div className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
            {distance.toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
});

StationListItem.displayName = 'StationListItem';
export default StationListItem;
