// GMap.tsx
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
  selectDepartureStationId,
  selectArrivalStationId,
  selectUserLocation,
} from '@/store/userSlice';
import {
  toggleSheet,
  selectViewState,
  selectIsSheetMinimized,
} from '@/store/uiSlice';
import { selectBookingStep } from '@/store/bookingSlice';

import Sheet from '@/components/ui/sheet';
import { StationDetail } from './StationDetail';
import { LoadingSpinner } from './LoadingSpinner';
import StationSelector from './StationSelector';
import CarSheet from './CarSheet';

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
  // Refs and local state
  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Redux state
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const step = useAppSelector(selectBookingStep);
  const userLocation = useAppSelector(selectUserLocation);
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Maps API loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Set up map options and marker icons when Maps API is ready
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Sort stations by distance
  const sortStationsByDistanceToPoint = useCallback((point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
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
  }, []);

  // Handle address search from StationSelector
  const handleAddressSearch = useCallback((location: google.maps.LatLngLiteral) => {
    if (!mapRef.current) return;
    setSearchLocation(location);
    mapRef.current.panTo(location);
    mapRef.current.setZoom(15);
    const sorted = sortStationsByDistanceToPoint(location, stations);
    setSortedStations(sorted);
    if (isSheetMinimized) {
      dispatch(toggleSheet());
    }
  }, [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]);

  // Map load and fit bounds to stations
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (stations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      stations.forEach(station => {
        const [lng, lat] = station.geometry.coordinates;
        bounds.extend({ lat, lng });
      });
      map.fitBounds(bounds, 50);
    }
  }, [stations]);

  // (Other effects and marker handlers would remain the same...)
  // …

  // Sheet toggle handler
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Loading and error handling
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  if (stationsError || carsError || loadError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
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
    );
  }

  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
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

          {/* Render markers based on viewState */}
          {viewState === 'showMap' &&
            (searchLocation ? sortedStations : stations).map((station) => {
              const [lng, lat] = station.geometry.coordinates;
              return (
                <Marker
                  key={station.id}
                  position={{ lat, lng }}
                  onClick={() => {
                    // your handleMarkerClick implementation
                  }}
                  icon={/* your marker icon logic */}
                />
              );
            })
          }

          {viewState === 'showCar' &&
            cars.map((car) => (
              <Marker
                key={car.id}
                position={{ lat: car.lat, lng: car.lng }}
                title={car.name}
                icon={markerIcons?.car}
              />
            ))
          }
        </GoogleMap>
      </div>

      {/* Conditionally render the Station sheet only when in "showMap" view */}
      {viewState === 'showMap' && (
        <>
          <StationSelector onAddressSearch={handleAddressSearch} />
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
        </>
      )}

      {/* Conditionally render the Car sheet only when in "showCar" view */}
      {viewState === 'showCar' && (
        <CarSheet 
          isOpen={!isSheetMinimized}
          onToggle={handleSheetToggle}
        />
      )}

      {overlayVisible && <LoadingSpinner />}
    </div>
  );
}
