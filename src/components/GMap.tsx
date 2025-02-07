'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import { Navigation, Target } from 'lucide-react';

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
import { StationListItem } from './StationListItem';

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
  const mapRef = useRef<google.maps.Map | null>(null);

  // Local state
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);

  // Sheets
  const [isStationListOpen, setIsStationListOpen] = useState(false);
  const [isCarSheetOpen, setIsCarSheetOpen] = useState(true); // CarSheet open by default

  // Redux
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

  // For station styling
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Once loaded, create map options & marker icons
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Sort stations by distance
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

  // Address search from StationSelector
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

  // Map initialization
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

  // Fetch stations & cars
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

  // Hide overlay
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Check errors
  const hasError = stationsError || carsError || loadError;

  // Toggle sheet from Redux
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Locate me => geolocation => userLocation => show station list
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        dispatch(setUserLocation(newLoc));

        if (mapRef.current) {
          mapRef.current.panTo(newLoc);
          mapRef.current.setZoom(15);
        }

        const sorted = sortStationsByDistanceToPoint(newLoc, stations);
        setSortedStations(sorted);

        // If user is opening station list, we close CarSheet (and any station detail).
        setIsCarSheetOpen(false);
        setActiveStation(null);

        // Show station list
        setIsStationListOpen(true);
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  // Toggle CarSheet => close station list, active station
  const handleCarToggle = () => {
    setIsCarSheetOpen((prev) => !prev);
    setIsStationListOpen(false);
    setActiveStation(null);
  };

  // Decide station icon
  const getStationIcon = (station: StationFeature):
    | string
    | google.maps.Symbol
    | google.maps.Icon
    | undefined => {
    if (!markerIcons) return undefined;
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

  // If user clicks a station => open station detail => hide station list
  const handleStationClick = (station: StationFeature) => {
    setActiveStation(station);
    setIsStationListOpen(false);

    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    if (isSheetMinimized) {
      dispatch(toggleSheet());
    }
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
          {/* The map */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={handleMapLoad}
            >
              {/* User location */}
              {userLocation && markerIcons && (
                <Marker
                  position={userLocation}
                  icon={markerIcons.user}
                  clickable={false}
                />
              )}

              {/* Stations */}
              {(searchLocation ? sortedStations : stations).map((station) => {
                const [lng, lat] = station.geometry.coordinates;
                return (
                  <Marker
                    key={station.id}
                    position={{ lat, lng }}
                    icon={getStationIcon(station)}
                    onClick={() => handleStationClick(station)}
                  />
                );
              })}

              {/* Cars */}
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

          {/* Station Selector (top-left) */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <StationSelector onAddressSearch={handleAddressSearch} />
          </div>

          {/* Two icon buttons below the StationSelector (z-30 so they appear on top).
              Using top-[7.5rem] or so if StationSelector is e.g. 4rem tall. 
              Adjust as needed. */}
          <div className="absolute top-[7.5rem] left-4 z-30 flex flex-col space-y-2">
            {/* Locate Me button (no text, just icon) */}
            <button
              onClick={handleLocateMe}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Target className="w-5 h-5" />
            </button>

            {/* Car toggle button (no text, just icon) */}
            <button
              onClick={handleCarToggle}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>

          {/* CarSheet open by default. Clicking the Car icon toggles it. */}
          <CarSheet
            isOpen={isCarSheetOpen}
            onToggle={() => setIsCarSheetOpen((v) => !v)}
          />

          {/* StationList sheet (only open if user pressed "Locate me" and hasn't toggled something else) */}
          <Sheet
            isOpen={isStationListOpen}
            onToggle={() => setIsStationListOpen(false)}
            title="Nearby Stations"
            count={sortedStations.length}
          >
            <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
              {sortedStations.map((station, idx) => (
                <StationListItem
                  key={station.id}
                  index={idx}
                  style={{}}
                  data={{ items: sortedStations }}
                />
              ))}
            </div>
          </Sheet>

          {/* StationDetail can still appear if user clicks a station (activeStation) */}
          {(bookingStep === 1 || bookingStep === 2 || bookingStep === 4) && activeStation && (
            <Sheet
              isOpen
              onToggle={() => setActiveStation(null)} // or any logic
              title="Station Details"
              count={(searchLocation ? sortedStations : stations).length}
            >
              <StationDetail
                stations={searchLocation ? sortedStations : stations}
                activeStation={activeStation}
              />
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}
