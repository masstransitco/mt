'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import { Navigation, Target } from 'lucide-react'; // Example icons

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
  setUserLocation,
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
import { StationListItem } from './StationListItem'; // We'll reuse your StationListItem for listing

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

  // New local state to show/hide the StationList sheet
  const [isStationListOpen, setIsStationListOpen] = useState(false);

  // Also store whether the CarSheet is open in local state
  // (If you prefer to keep the same logic that uses Redux or bookingStep, adapt accordingly)
  const [isCarSheetOpen, setIsCarSheetOpen] = useState(false);

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

  // For station marker styling logic
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

  // Toggling the general bottom sheet from Redux
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // (1) LOCATE ME BUTTON => requests geolocation, updates user location, shows station list
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        // Store user location in Redux
        dispatch(setUserLocation(newLocation));

        // Re-center map
        if (mapRef.current) {
          mapRef.current.panTo(newLocation);
          mapRef.current.setZoom(15);
        }

        // Sort stations by the new location
        const sorted = sortStationsByDistanceToPoint(newLocation, stations);
        setSortedStations(sorted);

        // Show the station list sheet
        setIsStationListOpen(true);
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  // (2) CAR BUTTON => toggles CarSheet
  const handleCarToggle = () => {
    setIsCarSheetOpen((prev) => !prev);
  };

  // Decide icon for station markers
  const getStationIcon = (station: StationFeature):
    | string
    | google.maps.Symbol
    | google.maps.Icon
    | undefined => {
    if (!markerIcons) return undefined; // No icons yet, so return undefined

    // ... same logic from before
    if (station.id === departureStationId) {
      return markerIcons.departureStation;
    }
    if (station.id === arrivalStationId) {
      return markerIcons.arrivalStation;
    }
    if (station.id === activeStation?.id) {
      return markerIcons.activeStation;
    }
    return markerIcons.station;
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* If there's an error loading data */}
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
          {/* The Map */}
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
                      setActiveStation(station);
                      if (bookingStep < 3) {
                        dispatch({ type: 'user/selectDepartureStation', payload: station.id });
                      } else {
                        dispatch({ type: 'user/selectArrivalStation', payload: station.id });
                      }
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

          {/* Two Icon Buttons in the top-left (or wherever you prefer) */}
          <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
            {/* Locate Me Button */}
            <button
              onClick={handleLocateMe}
              className="p-3 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center gap-2"
            >
              <Target className="w-5 h-5" />
              <span>Locate Me</span>
            </button>

            {/* Car Toggle Button */}
            <button
              onClick={handleCarToggle}
              className="p-3 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center gap-2"
            >
              <Navigation className="w-5 h-5" />
              <span>Car</span>
            </button>
          </div>

          {/* The Station Selector (unchanged) */}
          <StationSelector onAddressSearch={handleAddressSearch} />

          {/* We reuse the existing CarSheet, but it’s controlled by local state isCarSheetOpen */}
          <CarSheet
            isOpen={isCarSheetOpen}
            onToggle={() => setIsCarSheetOpen((v) => !v)}
          />

          {/* A new StationList bottom sheet that shows when isStationListOpen is true */}
          <Sheet
            isOpen={isStationListOpen}
            onToggle={() => setIsStationListOpen(false)}
            title="Nearby Stations"
            count={sortedStations.length}
          >
            <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
              {sortedStations.map((station) => (
                <StationListItem
                  key={station.id}
                  index={0}  // the react-window index doesn’t matter if we’re not using react-window here
                  style={{}}
                  data={{ items: sortedStations }}
                />
              ))}
            </div>
          </Sheet>

          {/* 
            You still have the logic for showing StationDetail or CarSheet 
            based on bookingStep, etc. 
            If you prefer to keep that flow, adapt or remove as needed. 
          */}
        </>
      )}
    </div>
  );
}
