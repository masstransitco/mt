'use client';

import React, {
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
  CSSProperties,
} from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { Zap } from 'lucide-react';

// Redux
import { useAppDispatch, useAppSelector } from '@/store/store';

// Slices
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
  // userSlice: departure/arrival
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation,
  selectArrivalStation,
  selectUserLocation,
} from '@/store/userSlice';
import {
  toggleSheet,
  selectViewState,
  selectIsSheetMinimized,
} from '@/store/uiSlice';

// Booking slice (tracks step=1 => departure, step=2 => arrival)
import {
  advanceBookingStep,
  selectBookingStep,
} from '@/store/bookingSlice';

// UI
import Sheet from '@/components/ui/sheet';
import { Zap as ZapIcon } from 'lucide-react';

/* --------------------------- Constants --------------------------- */
const LIBRARIES: ('geometry')[] = ['geometry'];

/** Give the map container a real height to ensure visibility. */
const CONTAINER_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  backgroundColor: '#111111',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
};

/** Fallback center if user location is unavailable. */
const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 };

/** Props for the GMap component */
interface GMapProps {
  googleApiKey: string;
}

/* ----------------------- Station List Item ------------------------ */
interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}

const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];
  const dispatch = useAppDispatch();

  // Check which step we're on: 1 => departure, 2 => arrival
  const step = useAppSelector(selectBookingStep);

  // When clicking on a station in the list, decide if it's departure or arrival
  const handleClick = useCallback(() => {
    if (step === 1) {
      dispatch(selectDepartureStation(station.id));
    } else if (step === 2) {
      dispatch(selectArrivalStation(station.id));
    }
  }, [dispatch, station.id, step]);

  return (
    <div
      style={style as CSSProperties}
      className="px-4 py-3 hover:bg-muted/20 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="font-medium text-foreground">
            {station.properties.Place}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ZapIcon className="w-4 h-4" />
            <span>{station.properties.maxPower} kW max</span>
            <span className="px-1">·</span>
            <span>{station.properties.availableSpots} Available</span>
          </div>
        </div>
        {station.distance !== undefined && (
          <div className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
            {station.distance.toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
});

StationListItem.displayName = 'StationListItem';

/* ------------------ Memoized GoogleMap Component ----------------- */
const MemoizedGoogleMap = memo(GoogleMap);

/* -------------------------- Main GMap ---------------------------- */
function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Station data
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);

  // Car data
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  // Booking step: 1 => departure, 2 => arrival
  const step = useAppSelector(selectBookingStep);

  // userSlice: track departure & arrival IDs
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Current user location
  const userLocation = useAppSelector(selectUserLocation);

  // UI states
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // For performance with react-window
  const memoizedStations = useMemo(() => stations, [stations]);

  // Google Maps loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Keep a reference to the map instance
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Request user location (optional)
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Example:
        // dispatch(setUserLocation({
        //   lat: position.coords.latitude,
        //   lng: position.coords.longitude,
        // }));
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch]);

  // On mount, fetch stations + cars, then get user location
  useEffect(() => {
    const initialize = async () => {
      try {
        await dispatch(fetchStations()).unwrap();
        await dispatch(fetchCars()).unwrap();
        getUserLocation();
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    initialize();
  }, [dispatch, getUserLocation]);

  // Marker click -> pick departure if step=1, arrival if step=2
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      if (step === 1) {
        dispatch(selectDepartureStation(station.id));
      } else if (step === 2) {
        dispatch(selectArrivalStation(station.id));
      }
      dispatch(toggleSheet());
    },
    [dispatch, step]
  );

  // Check for errors
  const combinedError = stationsError || carsError || loadError;
  if (combinedError) {
    return (
      <div className="text-destructive">
        {combinedError instanceof Error
          ? `Error loading Google Maps: ${combinedError.message}`
          : combinedError}
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading Google Map...</div>;
  }

  if (stationsLoading || carsLoading) {
    return (
      <div className="text-muted-foreground">
        Loading {stationsLoading ? 'stations' : 'cars'}...
      </div>
    );
  }

  /**
   * We decide which "detail" component to show based on:
   * - current step
   * - whether departure or arrival station is selected
   */
  function renderSelectedStationDetails() {
    if (step === 1 && departureStationId !== null) {
      return <DepartureStationDetails stationId={departureStationId} />;
    }
    if (step === 2 && arrivalStationId !== null) {
      return <ArrivalStationDetails stationId={arrivalStationId} />;
    }
    // No station selected
    return (
      <FixedSizeList
        height={400}
        width="100%"
        itemCount={memoizedStations.length}
        itemSize={80}
        itemData={memoizedStations}
      >
        {StationListItem}
      </FixedSizeList>
    );
  }

  // Show different title in the sheet depending on step
  let sheetTitle = 'Nearby Stations';
  if (step === 1 && departureStationId) {
    sheetTitle = 'Departure Station';
  } else if (step === 1) {
    sheetTitle = 'Select Departure Station';
  } else if (step === 2 && arrivalStationId) {
    sheetTitle = 'Arrival Station';
  } else if (step === 2) {
    sheetTitle = 'Select Arrival Station';
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* MAP */}
      <div className="absolute inset-0">
        <MemoizedGoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={14}
          options={MAP_OPTIONS}
          onLoad={handleMapLoad}
        >
          {/* User location marker */}
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

          {/* Station markers */}
          {stations.map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(station)}
                icon={{
                  path: 'M -2 -2 L 2 -2 L 2 2 L -2 2 z', // a small square
                  scale: 4,
                  fillColor: '#D3D3D3',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#FFFFFF',
                }}
              />
            );
          })}

          {/* Car markers */}
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
        </MemoizedGoogleMap>
      </div>

      {/* BOTTOM SHEET */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => dispatch(toggleSheet())}
          title={sheetTitle}
          count={stations.length}
        >
          {stationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading stations...
            </div>
          ) : (
            renderSelectedStationDetails()
          )}
        </Sheet>
      )}
    </div>
  );
}

/* -------------------- Departure Station Details ------------------- */
function DepartureStationDetails({ stationId }: { stationId: number }) {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);

  // Find the station from the store
  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  // Clear the departure station
  const handleClear = () => {
    dispatch(selectDepartureStation(null));
  };

  // Confirm departure => next step is arrival (step=2)
  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(2));
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {station.properties.Place} (Departure)
      </h3>
      <p className="text-sm text-muted-foreground">
        Max Power: {station.properties.maxPower} kW
      </p>
      <p className="text-sm text-muted-foreground">
        Available spots: {station.properties.availableSpots}
      </p>
      {station.distance !== undefined && (
        <p className="text-sm text-muted-foreground">
          Distance: {station.distance.toFixed(1)} km
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear
        </button>
        <button
          onClick={handleConfirmDeparture}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Confirm Departure
        </button>
      </div>
    </div>
  );
}

/* --------------------- Arrival Station Details -------------------- */
function ArrivalStationDetails({ stationId }: { stationId: number }) {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);

  // Find the station from the store
  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  // Clear the arrival station
  const handleClear = () => {
    dispatch(selectArrivalStation(null));
  };

  // Confirm arrival => next step is step=3 (e.g. payment)
  const handleConfirmArrival = () => {
    dispatch(advanceBookingStep(3));
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {station.properties.Place} (Arrival)
      </h3>
      <p className="text-sm text-muted-foreground">
        Max Power: {station.properties.maxPower} kW
      </p>
      <p className="text-sm text-muted-foreground">
        Available spots: {station.properties.availableSpots}
      </p>
      {station.distance !== undefined && (
        <p className="text-sm text-muted-foreground">
          Distance: {station.distance.toFixed(1)} km
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear
        </button>
        <button
          onClick={handleConfirmArrival}
          className="px-3 py-2 bg-green-600 text-white rounded-md text-sm"
        >
          Confirm Arrival
        </button>
      </div>
    </div>
  );
}

/* -------------- Error Boundary -------------- */
class MapErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('Map Error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-destructive">
          Something went wrong loading the map. Please try again.
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------- Export with Error Boundary -------------- */
export default function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
}
