'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { FixedSizeList } from 'react-window';
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
import { StationListItem } from './StationListItem';
import { StationDetail } from './StationDetail';
import { LoadingSpinner } from './LoadingSpinner';
import StationSelector from './StationSelector';

const LIBRARIES: ('geometry')[] = ['geometry'];
const CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 };

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  backgroundColor: '#111111',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
};

interface GMapProps {
  googleApiKey: string;
}

function buildSheetTitle(step: number): string {
  return step === 1 
    ? 'Select Departure Station' 
    : 'Select Arrival Station';
}

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [sheetManualOverride, setSheetManualOverride] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Selectors
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const step = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const userLocation = useAppSelector(selectUserLocation);
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  const getMarkerIcon = useCallback((station: StationFeature) => {
    if (station.id === departureStationId) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#22C55E', // Green for departure
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      };
    }
    if (station.id === arrivalStationId) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#EF4444', // Red for arrival
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      };
    }
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#6B7280', // Gray for unselected
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    };
  }, [departureStationId, arrivalStationId]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMarkerClick = useCallback((station: StationFeature) => {
    const [lng, lat] = station.geometry.coordinates;
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(15);
    }
    
    // Show station details in sheet
    if (isSheetMinimized) {
      dispatch(toggleSheet());
    }
  }, [dispatch, isSheetMinimized]);

  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
    setSheetManualOverride(true);
  }, [dispatch]);

  useEffect(() => {
    const init = async () => {
      try {
        await dispatch(fetchStations()).unwrap();
        await dispatch(fetchCars()).unwrap();
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    init();
  }, [dispatch]);

  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Handle errors
  if (stationsError || carsError || loadError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
        Error loading map data
      </div>
    );
  }

  // Handle loading
  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={14}
          options={MAP_OPTIONS}
          onLoad={handleMapLoad}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
              }}
              clickable={false}
            />
          )}

          {/* Station Markers */}
          {stations.map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(station)}
                icon={getMarkerIcon(station)}
              />
            );
          })}

          {/* Car Markers */}
          {cars.map((car) => (
            <Marker
              key={car.id}
              position={{ lat: car.lat, lng: car.lng }}
              title={car.name}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#333333',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#0000FF',
              }}
            />
          ))}
        </GoogleMap>
      </div>

      {/* Station Selector UI */}
      <StationSelector />

      {/* Bottom Sheet */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={handleSheetToggle}
          title={buildSheetTitle(step)}
          count={stations.length}
        >
          <StationDetail />
        </Sheet>
      )}
    </div>
  );
}
