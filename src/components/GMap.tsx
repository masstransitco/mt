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

function buildSheetTitle(step: number, departureId: number | null, arrivalId: number | null): string {
  if (step === 1) {
    return departureId
      ? 'Step 1 of 2: Departure Selected'
      : 'Step 1 of 2: Select Departure Station';
  }
  if (step === 2) {
    return arrivalId
      ? 'Step 2 of 2: Arrival Selected'
      : 'Step 2 of 2: Select Arrival Station';
  }
  return 'Nearby Stations';
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

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMarkerClick = useCallback((station: StationFeature) => {
    const [lng, lat] = station.geometry.coordinates;
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(15);
    }
  }, []);

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

  useEffect(() => {
    if (sheetManualOverride) return;

    const needDeparture = step === 1 && !departureStationId;
    const needArrival = step === 2 && !arrivalStationId;
    const mustPick = needDeparture || needArrival;

    if (viewState === 'showMap') {
      if (mustPick && isSheetMinimized) {
        dispatch(toggleSheet());
      } else if (!mustPick && !isSheetMinimized) {
        dispatch(toggleSheet());
      }
    }
  }, [
    sheetManualOverride,
    step,
    departureStationId,
    arrivalStationId,
    viewState,
    isSheetMinimized,
    dispatch,
  ]);

  const renderSheetContent = useCallback(() => {
    const haveDepartureSelected = step === 1 && departureStationId != null;
    const haveArrivalSelected = step === 2 && arrivalStationId != null;

    if (haveDepartureSelected || haveArrivalSelected) {
      return <StationDetail />;
    }

    return (
      <>
        {step === 1 && !departureStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Select your <strong>departure station</strong> below:
          </div>
        )}
        {step === 2 && !arrivalStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Select your <strong>arrival station</strong> below:
          </div>
        )}
        <FixedSizeList
          height={400}
          width="100%"
          itemCount={stations.length}
          itemSize={80}
          itemData={stations}
        >
          {StationListItem}
        </FixedSizeList>
      </>
    );
  }, [step, departureStationId, arrivalStationId, stations]);

  // Handle errors
  const combinedError = stationsError || carsError || loadError;
  if (combinedError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
        {combinedError instanceof Error
          ? `Error loading data: ${combinedError.message}`
          : combinedError}
      </div>
    );
  }

  // Handle loading
  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  const sheetTitle = buildSheetTitle(step, departureStationId, arrivalStationId);

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
                icon={{
                  path: 'M -2 -2 L 2 -2 L 2 2 L -2 2 z',
                  scale: 4,
                  fillColor: '#D3D3D3',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#FFFFFF',
                }}
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

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={handleSheetToggle}
          title={sheetTitle}
          count={stations.length}
        >
          {renderSheetContent()}
        </Sheet>
      )}
    </div>
  );
}
