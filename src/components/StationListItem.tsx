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

/**
 * The data object passed by react-window to each list item:
 * - `items` is your array of StationFeature
 * - optional `searchLocation` for distance
 * - optional `onStationSelected` callback
 */
interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
  onStationSelected?: (station: StationFeature) => void;
}

/**
 * The props for a single row in react-window:
 * - `data` must be of type `StationListItemData`.
 */
interface StationListItemProps extends ListChildComponentProps {
  data: StationListItemData;
}

export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const { items: stations, searchLocation, onStationSelected } = data;

  const station = stations[index];
  const dispatch = useAppDispatch();

  // Current booking step, e.g. 1=selecting_departure, 2=selecting_arrival
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // Is this station the selected departure or arrival?
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  // Optionally compute distance if searchLocation is provided
  const getDistance = useCallback(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      return station.distance;
    }
    const [lng, lat] = station.geometry.coordinates;
    const distMeters = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return distMeters / 1000; // in km
  }, [station, searchLocation]);

  const distance = getDistance();

  // On click => set departure/arrival, then call onStationSelected if any
  const handleClick = useCallback(() => {
    if (step === 1) {
      // selecting departure
      if (station.id === arrivalId) {
        toast.error('Cannot select the same station for departure and arrival');
        return;
      }
      dispatch(setDepartureStation(station.id));
      toast.success('Departure station selected');
    } else if (step === 2) {
      // selecting arrival
      if (station.id === departureId) {
        toast.error('Cannot select the same station for arrival');
        return;
      }
      dispatch(setArrivalStation(station.id));
      toast.success('Arrival station selected');
    }
    // If parent provided a callback, call it
    onStationSelected?.(station);
  }, [station, step, arrivalId, departureId, dispatch, onStationSelected]);

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
                {isDeparture ? (
                  <MapPin className="w-4 h-4" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
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
