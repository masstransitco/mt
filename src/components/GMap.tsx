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
const DEFAULT_ZOOM = 14;

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  backgroundColor: '#111111',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
  restriction: {
    latLngBounds: {
      north: 22.6,
      south: 22.1,
      east: 114.4,
      west: 113.8,
    },
    strictBounds: true,
  },
};

interface GMapProps {
  googleApiKey: string;
}

function buildSheetTitle(step: number): string {
  return step === 1 ? 'Select Departure Station' : 'Select Arrival Station';
}

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Local state
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Redux state
  const dispatch = useAppDispatch();
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

  // Maps API loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Map initialization
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

  // Station selection logic
  const handleStationSelect = useCallback((station: StationFeature) => {
    if (step === 1) {
      if (station.id === arrivalStationId) {
        toast.error('Cannot use same station for departure and arrival');
        return false;
      }
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
      toast.success('Departure station selected');
      return true;
    } else if (step === 2) {
      if (station.id === departureStationId) {
        toast.error('Cannot use same station for departure and arrival');
        return false;
      }
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
      toast.success('Arrival station selected');
      return true;
    }
    return false;
  }, [dispatch, step, departureStationId, arrivalStationId]);

  // Map interaction handlers
  const handleMarkerClick = useCallback((station: StationFeature) => {
    if (!mapRef.current) return;

    const [lng, lat] = station.geometry.coordinates;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(15);

    const selected = handleStationSelect(station);
    if (selected) {
      setActiveStation(station);
      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    }
  }, [handleStationSelect, isSheetMinimized, dispatch]);

  const handleMarkerHover = useCallback((station: StationFeature | null) => {
    setActiveStation(station);
  }, []);

  // Sheet controls
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Marker styling
  const getMarkerIcon = useCallback((station: StationFeature) => {
    const isHighlighted = (step === 1 && !departureStationId) || 
                         (step === 2 && !arrivalStationId);
    const isActive = station.id === activeStation?.id;
                         
    if (station.id === departureStationId) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#22C55E',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      };
    }
    if (station.id === arrivalStationId) {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#EF4444',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      };
    }
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: isActive ? 7 : (isHighlighted ? 6 : 5),
      fillColor: '#6B7280',
      fillOpacity: isHighlighted ? 0.8 : 0.6,
      strokeWeight: 2,
      strokeColor: '#FFFFFF'
    };
  }, [step, departureStationId, arrivalStationId, activeStation]);

  // Data initialization
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchCars()).unwrap()
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error('Failed to load map data');
      }
    };
    init();
  }, [dispatch]);

  // Loading state management
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Error handling
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
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={MAP_OPTIONS}
          onLoad={handleMapLoad}
        >
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

          {stations.map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(station)}
                onMouseOver={() => handleMarkerHover(station)}
                onMouseOut={() => handleMarkerHover(null)}
                icon={getMarkerIcon(station)}
              />
            );
          })}

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

      <StationSelector />

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
