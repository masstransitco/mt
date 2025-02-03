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

  // --- Force the sheet to be minimized on first mount, if not already ---
  const sheetInitRef = useRef(false);
  useEffect(() => {
    if (!sheetInitRef.current) {
      if (!isSheetMinimized) {
        dispatch(toggleSheet());
      }
      sheetInitRef.current = true;
    }
  }, [dispatch, isSheetMinimized]);

  // --- Initialize map options/icons once Google Maps loads ---
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // --- Sort stations by distance to an address search location ---
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!google?.maps?.geometry?.spherical) return stationsToSort;

      return [...stationsToSort].sort((a, b) => {
        const [lngA, latA] = a.geometry.coordinates;
        const [lngB, latB] = b.geometry.coordinates;
        const distA = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latA, lngA),
          new google.maps.LatLng(point.lat, point.lng),
        );
        const distB = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latB, lngB),
          new google.maps.LatLng(point.lat, point.lng),
        );
        return distA - distB;
      });
    },
    [],
  );

  // --- Handle user address search ---
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;

      setSearchLocation(location);
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSortedStations(sorted);
      // Sheet remains minimized by default
    },
    [stations, sortStationsByDistanceToPoint],
  );

  // --- Once the map is loaded, fit bounds to stations ---
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
    [stations],
  );

  // --- Effect to handle station selection side-effects ---
  useEffect(() => {
    if (selectedStationId === null) return;

    const station = stations.find(s => s.id === selectedStationId);
    if (!station) return;

    // Validate not using the same station for departure and arrival
    const isValidSelection =
      (step === 1 && station.id !== arrivalStationId) ||
      (step === 2 && station.id !== departureStationId);

    if (!isValidSelection) {
      toast.error('Cannot use same station for departure and arrival');
      setSelectedStationId(null);
      return;
    }

    if (step === 1) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
      toast.success('Departure station selected');
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
      toast.success('Arrival station selected');
    }

    // If the sheet is open, toggle it to minimize
    if (!isSheetMinimized) {
      dispatch(toggleSheet());
    }

    setSelectedStationId(null);
  }, [
    selectedStationId,
    stations,
    step,
    arrivalStationId,
    departureStationId,
    dispatch,
    isSheetMinimized,
  ]);

  // --- Marker interactions ---
  const handleMarkerClick = useCallback((station: StationFeature) => {
    if (!mapRef.current) return;

    const [lng, lat] = station.geometry.coordinates;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(15);

    setActiveStation(station);
    setSelectedStationId(station.id);
  }, []);

  const handleMarkerHover = useCallback((station: StationFeature | null) => {
    setActiveStation(station);
  }, []);

  // --- Toggling the sheet manually ---
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // --- Dynamic bottom sheet title ---
  const getSheetTitle = useCallback(() => {
    if (searchLocation) return 'Nearby Stations';
    if (activeStation) return 'Station Details';
    return step === 1 ? 'Select Departure Station' : 'Select Arrival Station';
  }, [searchLocation, activeStation, step]);

  // --- Marker icon logic ---
  const getMarkerIcon = useCallback(
    (station: StationFeature) => {
      if (!markerIcons) return null;

      if (station.id === departureStationId) {
        return markerIcons.departureStation;
      }
      if (station.id === arrivalStationId) {
        return markerIcons.arrivalStation;
      }
      const isActive = station.id === activeStation?.id;
      return isActive ? markerIcons.activeStation : markerIcons.inactiveStation;
    },
    [markerIcons, departureStationId, arrivalStationId, activeStation],
  );

  // --- Data init effect ---
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

  // --- Loading state effect ---
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // --- Handle top-level errors ---
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

  // --- Show spinner while data is still loading ---
  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  // Offset the sheet so it doesn't overlap StationSelector
  const sheetTopOffset = 150; // Adjust as desired

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">
      {/* The map behind everything, fully occupying the container */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={mapOptions || {}}
          onLoad={handleMapLoad}
        >
          {userLocation && markerIcons && (
            <Marker
              position={userLocation}
              icon={markerIcons.user}
              clickable={false}
            />
          )}

          {(searchLocation ? sortedStations : stations).map((station) => {
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
              icon={markerIcons?.car}
            />
          ))}
        </GoogleMap>
      </div>

      {/* StationSelector pinned at the top (z-10 in your Tailwind config) */}
      <StationSelector onAddressSearch={handleAddressSearch} />

      {/* Show bottom sheet only if we're in 'showMap' mode */}
      {viewState === 'showMap' && (
        <div
          className="absolute left-0 right-0"
          style={{
            top: `${sheetTopOffset}px`,
            bottom: 0,
            // no overflow -> prevents browser scroll
            // pointerEvents: none -> allows clicks on map behind
            pointerEvents: 'none',
            zIndex: 5, // put it under the StationSelector (z-10)
          }}
        >
          {/* This inner div re-enables pointer events for the sheet itself */}
          <div
            style={{
              pointerEvents: 'auto',
              height: '100%',
            }}
          >
            <Sheet
              isOpen={!isSheetMinimized}
              onToggle={handleSheetToggle}
              title={getSheetTitle()}
              count={(searchLocation ? sortedStations : stations).length}
              // The sheet content can have overflow-y: auto if needed,
              // ensuring only the sheet scrolls, not the entire window.
            >
              <StationDetail
                stations={searchLocation ? sortedStations : stations}
                activeStation={activeStation}
              />
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}
