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
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';

import Sheet from '@/components/ui/sheet';
import StationSelector from './StationSelector';
import { LoadingSpinner } from './LoadingSpinner';
import CarSheet from '@/components/booking/CarSheet';
import StationDetail from './StationDetail';

// Import the StationListItem that expects "onStationSelected" in the "data" object
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

type OpenSheetType = 'none' | 'car' | 'list' | 'detail';

export default function GMap({ googleApiKey }: GMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);

  // Basic local states
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Active station for StationDetail
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);

  // Which sheet is open? By default, CarSheet is open
  const [openSheet, setOpenSheet] = useState<OpenSheetType>('car');
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>('none');

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

  // Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Once map is loaded, create map options & marker icons
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Sort stations by distance to a point
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
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);

      // If we have a minimized sheet, open it
      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]
  );

  // Map init => fit bounds
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

  // Toggling general sheet
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  // Helper: open a new sheet => store current in previous => setOpenSheet
  const openNewSheet = (newSheet: OpenSheetType) => {
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  // Helper: close current => revert to previous
  const closeCurrentSheet = () => {
    const old = openSheet;
    setOpenSheet(previousSheet);
    setPreviousSheet('none');

    // If detail was closed => clear activeStation
    if (old === 'detail') {
      setActiveStation(null);
    }
  };

  // 1) "Locate Me" => geolocation => close CarSheet => show station list
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
        setSearchLocation(loc);
        setSortedStations(sorted);

        // Clear active station
        setActiveStation(null);
        // Show station list => hide car if open
        openNewSheet('list');
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  // 2) "Car" => toggles CarSheet => if open => close => revert, else open => hide detail/list
  const handleCarToggle = () => {
    if (openSheet === 'car') {
      closeCurrentSheet();
    } else {
      setActiveStation(null);
      openNewSheet('car');
    }
  };

  // Marker icon logic
  const getStationIcon = (station: StationFeature) => {
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

  // Click station marker => open detail => hide list/car
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

  // 3) If user selects from StationList => open detail
  const handleStationSelectedFromList = (station: StationFeature) => {
    setActiveStation(station);
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    openNewSheet('detail');
  };

  // 4) Confirm departure => step=3 => hide all sheets
  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(3)); // => selecting_arrival_station
    setPreviousSheet('none');
    setOpenSheet('none');
    setActiveStation(null);
  };

  // 5) Clear station => revert to previous
  const handleClearStationDetail = () => {
    closeCurrentSheet();
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
            e.g. top-[9rem] for no overlap 
          */}
          <div className="absolute top-[9rem] left-4 z-30 flex flex-col space-y-2">
            {/* Locate Me => close others, open list */}
            <button
              onClick={handleLocateMe}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Target className="w-5 h-5" />
            </button>

            {/* Car => toggles CarSheet */}
            <button
              onClick={handleCarToggle}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80
                         flex items-center justify-center text-foreground shadow"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>

          {/* CarSheet => open if openSheet='car' */}
          {openSheet === 'car' && (
            <CarSheet
              isOpen
              onToggle={handleCarToggle}
            />
          )}

          {/* StationList => open if openSheet='list' */}
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
                    // Pass everything inside data
                    data={{
                      items: sortedStations,
                      // Pass a callback inside data to handle station selection
                      onStationSelected: () => handleStationSelectedFromList(station),
                    }}
                  />
                ))}
              </div>
            </Sheet>
          )}

          {/* StationDetail => open if openSheet='detail' & we have activeStation */}
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
                onConfirmDeparture={handleConfirmDeparture}
                onClear={handleClearStationDetail}
              />
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}
