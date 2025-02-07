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

  // Basic local states
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);

  // We keep track of which sheet is open, and which sheet was previously open
  const [openSheet, setOpenSheet] = useState<'none' | 'car' | 'list' | 'detail'>('car');
  const [previousSheet, setPreviousSheet] = useState<'none' | 'car' | 'list' | 'detail'>('none');

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

  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Once the map is loaded, create options + marker icons
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Helper: sort stations by distance
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

  // StationSelector => address search
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;
      setSearchLocation(location);
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSortedStations(sorted);

      // If we have a minimized sheet, open it
      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]
  );

  // Map load => fit bounds
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

  // Hide overlay after data loads
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  const hasError = stationsError || carsError || loadError;

  // Toggling the general bottom sheet
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Helper: open a new sheet => hide the old one, store old in `previousSheet`
  const openNewSheet = (newSheet: 'none' | 'car' | 'list' | 'detail') => {
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  // Helper: close the current sheet => revert to previous
  const closeCurrentSheet = () => {
    const current = openSheet;
    setOpenSheet(previousSheet);
    setPreviousSheet('none');
    // If we closed the detail or list, maybe also clear activeStation
    if (current === 'detail') {
      setActiveStation(null);
    }
  };

  // 1) "Locate Me" => set user location => open station list => close others
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        dispatch(setUserLocation(loc));
        if (mapRef.current) {
          mapRef.current.panTo(loc);
          mapRef.current.setZoom(15);
        }
        const sorted = sortStationsByDistanceToPoint(loc, stations);
        setSortedStations(sorted);

        // Clear any active station
        setActiveStation(null);
        // Open the station list sheet
        openNewSheet('list');
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  // 2) "Car" => toggles CarSheet => if turning off, revert to previous
  const handleCarToggle = () => {
    if (openSheet === 'car') {
      // If car is open => close it => revert to previous
      closeCurrentSheet();
    } else {
      // If car is not open => open it => hide detail/list
      openNewSheet('car');
      // Clear station if we want to hide detail
      setActiveStation(null);
    }
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

  // Clicking a station => open "detail" => close others
  const handleStationClick = (station: StationFeature) => {
    setActiveStation(station);
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }

    openNewSheet('detail');
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
          {/* The Map */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={handleMapLoad}
            >
              {/* User Location */}
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
                    onClick={() => handleStationClick(station)}
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

          {/* Station Selector at the top-left */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <StationSelector onAddressSearch={handleAddressSearch} />
          </div>

          {/* 
            Buttons below StationSelector: 
            Use top-[9rem] or so to ensure no overlap 
          */}
          <div className="absolute top-[9rem] left-4 z-30 flex flex-col space-y-2">
            {/* Locate Me */}
            <button
              onClick={handleLocateMe}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Target className="w-5 h-5" />
            </button>

            {/* Car Toggle */}
            <button
              onClick={handleCarToggle}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>

          {/* 1) CarSheet => visible if openSheet === 'car' */}
          {openSheet === 'car' && (
            <CarSheet
              isOpen={true} 
              onToggle={handleCarToggle} // toggling it again closes (-> closeCurrentSheet or logic)
            />
          )}

          {/* 2) StationList => visible if openSheet === 'list' */}
          {openSheet === 'list' && (
            <Sheet
              isOpen
              onToggle={closeCurrentSheet}
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
          )}

          {/* 3) StationDetail => visible if openSheet === 'detail' & we have an activeStation */}
          {openSheet === 'detail' && activeStation && (
            <Sheet
              isOpen
              onToggle={closeCurrentSheet}
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
