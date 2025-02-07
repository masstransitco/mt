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
 * 1) Define a local interface for the `data` object that
 *    react-window passes. This includes your items, any optional
 *    searchLocation, and the onStationSelected callback.
 */
interface StationListItemData {
  items: StationFeature[];
  searchLocation?: google.maps.LatLngLiteral | null;
  /**
   * (Optional) Callback invoked when the user selects (clicks) a station.
   * Put it here in `data` so react-window recognizes it as part of the
   * standard `ListChildComponentProps`.
   */
  onStationSelected?: (station: StationFeature) => void;
}

/**
 * 2) Extend the default react-window props, ensuring `data` is typed
 *    as `StationListItemData`.
 */
interface StationListItemProps extends ListChildComponentProps {
  data: StationListItemData;
}

export const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;

  // 3) Extract the fields from `data`
  const { items: stations, searchLocation, onStationSelected } = data;
  const station = stations[index];

  // Redux & booking
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // Are we departure or arrival?
  const isSelected = station.id === departureId || station.id === arrivalId;
  const isDeparture = station.id === departureId;

  // Calculate distance if searchLocation is provided
  const getDistance = useCallback(() => {
    if (!searchLocation || !google?.maps?.geometry?.spherical) {
      return station.distance; // Possibly a precomputed distance
    }
    const [lng, lat] = station.geometry.coordinates;
    const dist = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      new google.maps.LatLng(searchLocation.lat, searchLocation.lng)
    );
    return dist / 1000; // km
  }, [station, searchLocation]);

  // On click => set departure/arrival, then call onStationSelected?
  const handleClick = useCallback(() => {
    if (step === 1) {
      // Step 1 => selecting departure station
      if (station.id === arrivalId) {
        toast.error('Cannot select same station for departure and arrival');
        return;
      }
      dispatch(setDepartureStation(station.id));
      toast.success('Departure station selected');
    } else if (step === 2) {
      // Step 2 => selecting arrival station
      if (station.id === departureId) {
        toast.error('Cannot select same station for arrival');
        return;
      }
      dispatch(setArrivalStation(station.id));
      toast.success('Arrival station selected');
    }

    // 4) If parent provided a callback, pass them the chosen station
    onStationSelected?.(station);
  }, [dispatch, station, step, departureId, arrivalId, onStationSelected]);

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
          {/* Station name & icon if selected */}
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

          {/* Station details: maxPower, availableSpots */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{station.properties.maxPower} kW max</span>
            <span className="px-1">·</span>
            <span>{station.properties.availableSpots} Available</span>
          </div>
        </div>

        {/* Distance display if computed */}
        {typeof distance === 'number' && (
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
