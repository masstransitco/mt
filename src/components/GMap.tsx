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
import { selectUserLocation } from '@/store/userSlice';
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
  // bookingStep meanings (as defined in your updated booking slice):
  // 1: selecting_departure_station
  // 2: selected_departure_station
  // 3: selecting_arrival_station
  // 4: selected_arrival_station
  // (Steps 5+ for later parts of the flow)

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

  // Sort stations by distance to a given point
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

  // Map initialization: fit bounds to stations if available
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

  // Data initialization: fetch stations and cars
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

  // Hide overlay when data is loaded
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Determine if an error exists
  const hasError = stationsError || carsError || loadError;

  // Sheet toggle control
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Determine sheet title based on booking step
  let sheetTitle = "";
  if (bookingStep === 1 || bookingStep === 2) {
    sheetTitle = "Station Details";
  } else if (bookingStep === 4) {
    sheetTitle = "Select Arrival Station";
  }

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
                    onClick={() => {
                      // When a station marker is clicked, set it as active.
                      setActiveStation(station);
                      // Optionally, if the sheet is minimized, open it.
                      if (isSheetMinimized) {
                        dispatch(toggleSheet());
                      }
                      // Update booking step based on current state:
                      if (bookingStep === 1) {
                        // For departure selection: once a station is clicked, move to "selected_departure_station" (step 2)
                        dispatch({ type: 'booking/advanceBookingStep', payload: 2 });
                      } else if (bookingStep === 3) {
                        // For arrival selection: once a station is clicked, move to "selected_arrival_station" (step 4)
                        dispatch({ type: 'booking/advanceBookingStep', payload: 4 });
                      }
                    }}
                    icon={markerIcons?.default}
                  />
                );
              })}

              {/* Car Markers */}
              {cars.map((car) => (
                <Marker
                  key={car.id}
                  position={{ lat: car.lat, lng: car.lng }}
                  title={car.name}
                  icon={markerIcons?.car}
                />
              ))}
            </GoogleMap>
          </div>

          {/* Render the StationSelector */}
          <StationSelector onAddressSearch={handleAddressSearch} />

          {/* Render bottom sheet based on booking step */}
          {(bookingStep === 1 || bookingStep === 2 || bookingStep === 4) && (
            bookingStep === 1 ? (
              // Step 1: selecting_departure_station
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
              // Step 2: selected_departure_station
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
              // Step 4: selected_arrival_station
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
