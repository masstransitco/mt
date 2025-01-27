'use client';

import React, {
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
  CSSProperties,
  useState,
} from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import { Zap } from 'lucide-react';

// Optional: if you have a toast library, e.g. react-hot-toast:
import { toast } from 'react-hot-toast';

// Redux
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
  selectDepartureStation,
  selectArrivalStation,
  selectUserLocation,
  // setUserLocation, // if you want to set user location on geolocation
} from '@/store/userSlice';
import {
  toggleSheet,
  selectViewState,
  selectIsSheetMinimized,
} from '@/store/uiSlice';

// Booking slice
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

/** Helper to build the step-based sheet title */
function buildSheetTitle(step: number, departureId: number | null, arrivalId: number | null) {
  // Optionally, if you have more steps, you could say "Step 1 of 2", etc.
  if (step === 1) {
    return departureId
      ? 'Step 1 of 2: Departure Station Selected'
      : 'Step 1 of 2: Select Departure Station';
  }
  if (step === 2) {
    return arrivalId
      ? 'Step 2 of 2: Arrival Station Selected'
      : 'Step 2 of 2: Select Arrival Station';
  }
  return 'Nearby Stations';
}

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

  // Station & Car data
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  // Booking step
  const step = useAppSelector(selectBookingStep);

  // userSlice: departure, arrival, user location
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const userLocation = useAppSelector(selectUserLocation);

  // UI states
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // For react-window performance
  const memoizedStations = useMemo(() => stations, [stations]);

  // Loading states
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Manage local “is everything loaded?” quickly
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Keep reference to map instance
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Request geolocation (optional)
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // If you want to set user location, uncomment:
        // dispatch(setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch]);

  // On mount, fetch stations & cars, get user location
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

  // Once everything is loaded, hide the overlay
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  /**
   * Auto-expand or auto-collapse the sheet based on user needing to pick a station
   * If user hasn't picked the station for the current step, we open the sheet;
   * if they've selected, we can collapse it to give more map room.
   */
  useEffect(() => {
    const needsDeparture = step === 1 && !departureStationId;
    const needsArrival = step === 2 && !arrivalStationId;
    const userNeedsToPick = needsDeparture || needsArrival;

    if (viewState === 'showMap') {
      if (userNeedsToPick && isSheetMinimized) {
        dispatch(toggleSheet()); // open sheet
      } else if (!userNeedsToPick && !isSheetMinimized) {
        dispatch(toggleSheet()); // close sheet
      }
    }
  }, [
    step,
    departureStationId,
    arrivalStationId,
    viewState,
    isSheetMinimized,
    dispatch,
  ]);

  /**
   * Handle station marker click:
   * - pan/zoom the map to that station
   * - if step=1 => selectDepartureStation
   * - if step=2 => selectArrivalStation
   * - optional: toast for feedback
   */
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      const [lng, lat] = station.geometry.coordinates;
      // Pan the map to the station
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(15);
      }

      if (step === 1) {
        dispatch(selectDepartureStation(station.id));
        toast.success('Departure station selected!');
      } else if (step === 2) {
        dispatch(selectArrivalStation(station.id));
        toast.success('Arrival station selected!');
      }
    },
    [dispatch, step]
  );

  // Combine any major errors
  const combinedError = stationsError || carsError || loadError;
  if (combinedError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
        {combinedError instanceof Error
          ? `Error loading map or data: ${combinedError.message}`
          : combinedError}
      </div>
    );
  }

  // If we're still loading script or data, show an overlay
  if (overlayVisible) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background">
        <div className="flex flex-col items-center text-muted-foreground gap-2">
          {/* Example tailwind spinner, or replace with your own spinner */}
          <svg
            className="w-6 h-6 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            ></path>
          </svg>
          <span>Loading map & stations...</span>
        </div>
      </div>
    );
  }

  // Build a dynamic sheet title (with step indicator)
  const sheetTitle = buildSheetTitle(step, departureStationId, arrivalStationId);

  /**
   * Renders either the departure or arrival detail component
   * if they've been selected, or the station list if not.
   */
  function renderSelectedStationDetails() {
    // If step=1 & user has selected departure => show detail
    if (step === 1 && departureStationId !== null) {
      return <DepartureStationDetails stationId={departureStationId} />;
    }
    // If step=2 & user selected arrival => show detail
    if (step === 2 && arrivalStationId !== null) {
      return <ArrivalStationDetails stationId={arrivalStationId} />;
    }

    // Otherwise, show instructions + station list
    return (
      <>
        {/* Inline instructions for the user */}
        {step === 1 && !departureStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Please select your <strong>departure station</strong> from the map
            or the list below:
          </div>
        )}
        {step === 2 && !arrivalStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Please select your <strong>arrival station</strong> from the map
            or the list below:
          </div>
        )}

        <FixedSizeList
          height={400}
          width="100%"
          itemCount={memoizedStations.length}
          itemSize={80}
          itemData={memoizedStations}
        >
          {StationListItem}
        </FixedSizeList>
      </>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* MAP Container */}
      <div className="absolute inset-0">
        <MemoizedGoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={14}
          options={MAP_OPTIONS}
          onLoad={handleMapLoad}
        >
          {/* User location marker (if you set userLocation) */}
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
                  path: 'M -2 -2 L 2 -2 L 2 2 L -2 2 z', // small square
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
          {renderSelectedStationDetails()}
        </Sheet>
      )}
    </div>
  );
}

/* -------------------- Departure Station Details ------------------- */
function DepartureStationDetails({ stationId }: { stationId: number }) {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);

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
    toast.success('Departure station confirmed. Now select your arrival station.');
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

  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  // Clear the arrival station
  const handleClear = () => {
    dispatch(selectArrivalStation(null));
  };

  // Confirm arrival => next step is step=3 (or whichever flow)
  const handleConfirmArrival = () => {
    dispatch(advanceBookingStep(3));
    toast.success('Arrival station confirmed! Next: payment or finalizing...');
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
        <div className="text-destructive p-4">
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
