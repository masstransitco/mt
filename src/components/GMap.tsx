'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  fetchStations,
  selectStationsWithDistance,
  selectStationsLoading,
  selectStationsError,
  StationFeature,
} from '@/store/stationsSlice';
import {
  fetchCars,
  selectAllCars,
  selectCarsLoading,
  selectCarsError,
} from '@/store/carSlice';
import {
  selectUserLocation,
  selectDepartureStationId,
  selectArrivalStationId,
} from '@/store/userSlice';
import {
  toggleSheet,
  selectIsSheetMinimized,
} from '@/store/uiSlice';
import { selectBookingStep } from '@/store/bookingSlice';

import Sheet from '@/components/ui/sheet';
import StationSelector from './StationSelector';
import { LoadingSpinner } from './LoadingSpinner';
import CarSheet from '@/components/booking/CarSheet';
import StationDetail from './StationDetail';

import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
} from '@/constants/map';

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);

  // Local state
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);

  // Redux state
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const userLocation = useAppSelector(selectUserLocation);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);
  const bookingStep = useAppSelector(selectBookingStep);

  // For marker styling logic
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Load the Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Initialize map options and marker icons when Maps API is ready
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Helper to sort stations by distance to a given point
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!google?.maps?.geometry?.spherical) return stationsToSort;
      return [...stationsToSort].sort((a, b) => {
        const [lngA, latA] = a.geometry.coordinates;
        const [lngB, latB] = b.geometry.coordinates;
        const distA = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latA, lngA),
          new google.maps.LatLng(point.lat, point.lng)
        );
        const distB = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latB, lngB),
          new google.maps.LatLng(point.lat, point.lng)
        );
        return distA - distB;
      });
    },
    []
  );

  // Handle address search from StationSelector
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;
      setSearchLocation(location);
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSortedStations(sorted);

      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]
  );

  // Map initialization: fit bounds to all stations
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }
    },
    [stations]
  );

  // Fetch station & car data
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchCars()).unwrap(),
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error('Failed to load map data');
      }
    };
    init();
  }, [dispatch]);

  // Hide overlay when map & data are loaded
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Error state
  const hasError = stationsError || carsError || loadError;

  // Toggle sheet
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Decide which icon to use for a station
  // Return string | google.maps.Symbol | google.maps.Icon | undefined
  const getStationIcon = (station: StationFeature):
    | string
    | google.maps.Symbol
    | google.maps.Icon
    | undefined => {
    if (!markerIcons) return undefined; // No icons yet, so return undefined

    // If this station is the confirmed departure
    if (station.id === departureStationId) {
      return markerIcons.departureStation;
    }
    // If this station is the confirmed arrival
    if (station.id === arrivalStationId) {
      return markerIcons.arrivalStation;
    }
    // If it's the currently active station
    if (station.id === activeStation?.id) {
      return markerIcons.activeStation;
    }
    // Otherwise, it's just a normal station
    return markerIcons.station;
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {hasError ? (
        <div className="flex items-center justify-center w-full h-full bg-background text-destructive p-4">
          <div className="text-center space-y-2">
            <p className="font-medium">Error loading map data</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm underline hover:text-destructive/80"
            >
              Try reloading
            </button>
          </div>
        </div>
      ) : overlayVisible ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={handleMapLoad}
            >
              {/* User Location Marker */}
              {userLocation && markerIcons && (
                <Marker
                  position={userLocation}
                  icon={markerIcons.user}
                  clickable={false}
                />
              )}

              {/* Station Markers */}
              {(searchLocation ? sortedStations : stations).map((station) => {
                const [lng, lat] = station.geometry.coordinates;
                return (
                  <Marker
                    key={station.id}
                    position={{ lat, lng }}
                    icon={getStationIcon(station)}
                    onClick={() => {
                      // Set the station as active so StationDetail can show it
                      setActiveStation(station);

                      // Immediately store it in Redux so StationSelector can display it
                      if (bookingStep < 3) {
                        dispatch({ type: 'user/selectDepartureStation', payload: station.id });
                      } else {
                        dispatch({ type: 'user/selectArrivalStation', payload: station.id });
                      }

                      // If the sheet is minimized, open it
                      if (isSheetMinimized) {
                        dispatch(toggleSheet());
                      }
                    }}
                  />
                );
              })}

              {/* Car Markers */}
              {cars.map((car) => (
                <Marker
                  key={car.id}
                  position={{ lat: car.lat, lng: car.lng }}
                  icon={markerIcons?.car}
                  title={car.name}
                />
              ))}
            </GoogleMap>
          </div>

          {/* StationSelector with only "Step 1 of 2" or "Step 2 of 2" in the UI */}
          <StationSelector onAddressSearch={handleAddressSearch} />

          {/* Bottom Sheet for steps 1, 2, or 4 (step 3 might hide the sheet) */}
          {(bookingStep === 1 || bookingStep === 2 || bookingStep === 4) && (
            bookingStep === 1 ? (
              // Step 1 = selecting_departure_station
              activeStation ? (
                <Sheet
                  isOpen={!isSheetMinimized}
                  onToggle={handleSheetToggle}
                  title="Station Details"
                  count={(searchLocation ? sortedStations : stations).length}
                >
                  <StationDetail
                    stations={searchLocation ? sortedStations : stations}
                    activeStation={activeStation}
                  />
                </Sheet>
              ) : (
                <CarSheet
                  isOpen={!isSheetMinimized}
                  onToggle={handleSheetToggle}
                />
              )
            ) : bookingStep === 2 ? (
              // Step 2 = selected_departure_station
              <Sheet
                isOpen={!isSheetMinimized}
                onToggle={handleSheetToggle}
                title="Station Details"
                count={(searchLocation ? sortedStations : stations).length}
              >
                <StationDetail
                  stations={searchLocation ? sortedStations : stations}
                  activeStation={activeStation}
                />
              </Sheet>
            ) : bookingStep === 4 ? (
              // Step 4 = selected_arrival_station
              <Sheet
                isOpen={!isSheetMinimized}
                onToggle={handleSheetToggle}
                title="Select Arrival Station"
                count={(searchLocation ? sortedStations : stations).length}
              >
                <StationDetail
                  stations={searchLocation ? sortedStations : stations}
                  activeStation={activeStation}
                />
              </Sheet>
            ) : null
          )}
        </>
      )}
    </div>
  );
}
