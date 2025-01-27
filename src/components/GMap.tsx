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
  resetBookingFlow,
} from '@/store/bookingSlice';

// UI
import Sheet from '@/components/ui/sheet';
import { Zap as ZapIcon } from 'lucide-react';

/* --------------------------- Constants --------------------------- */
const LIBRARIES: ('geometry')[] = ['geometry'];

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

const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 };

/* ------------------ Helpers ------------------ */
function buildSheetTitle(step: number, departureId: number | null, arrivalId: number | null) {
  // Example step indicator: 2 steps total
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
  // Fallback if needed:
  return 'Nearby Stations';
}

/* -------------------------- GMap ---------------------------- */
interface GMapProps {
  googleApiKey: string;
}

/* StationListItem (react-window) */
interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}
const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];

  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  const handleClick = useCallback(() => {
    if (step === 1) {
      dispatch(selectDepartureStation(station.id));
      toast.success('Departure station selected!');
    } else if (step === 2) {
      dispatch(selectArrivalStation(station.id));
      toast.success('Arrival station selected!');
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

  // Stations & Cars
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  // Two-station flow
  const step = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  const userLocation = useAppSelector(selectUserLocation);

  // UI
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Used to handle manual vs. automatic toggling of the sheet
  const [sheetManualOverride, setSheetManualOverride] = useState(false);

  // For the station list
  const memoizedStations = useMemo(() => stations, [stations]);

  // Google Maps loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Overlay or spinner
  const [overlayVisible, setOverlayVisible] = useState(true);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Optionally request geolocation
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // dispatch(setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch]);

  // Fetch stations/cars on mount
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

  // Hide overlay once script & data are loaded
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Auto-expand/collapse the sheet if the user hasn't manually overridden
  useEffect(() => {
    if (sheetManualOverride) return; // user has manually toggled the sheet

    const needsDeparture = step === 1 && !departureStationId;
    const needsArrival = step === 2 && !arrivalStationId;
    const userNeedsToPick = needsDeparture || needsArrival;

    if (viewState === 'showMap') {
      if (userNeedsToPick && isSheetMinimized) {
        dispatch(toggleSheet());
      } else if (!userNeedsToPick && !isSheetMinimized) {
        dispatch(toggleSheet());
      }
    }
  }, [
    step,
    departureStationId,
    arrivalStationId,
    viewState,
    isSheetMinimized,
    sheetManualOverride,
    dispatch,
  ]);

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

  if (overlayVisible) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background">
        <div className="flex flex-col items-center text-muted-foreground gap-2">
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

  const sheetTitle = buildSheetTitle(step, departureStationId, arrivalStationId);

  // Render station list or station details
  function renderSelectedStationDetails() {
    if (step === 1 && departureStationId !== null) {
      return <DepartureStationDetails />;
    }
    if (step === 2 && arrivalStationId !== null) {
      return <ArrivalStationDetails />;
    }

    // Else show instructions + station list
    return (
      <>
        {step === 1 && !departureStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Please select your <strong>departure station</strong>.
          </div>
        )}
        {step === 2 && !arrivalStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Please select your <strong>arrival station</strong>.
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

  // When the user taps the sheet toggle button themselves,
  // we set manual override to prevent auto-toggling
  const handleSheetToggle = () => {
    dispatch(toggleSheet());
    setSheetManualOverride(true);
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
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
                onClick={() => {
                  // Pan to the station
                  if (mapRef.current) {
                    mapRef.current.panTo({ lat, lng });
                    mapRef.current.setZoom(15);
                  }
                  // pick departure/arrival
                  if (step === 1) {
                    dispatch(selectDepartureStation(station.id));
                    toast.success('Departure station selected!');
                  } else if (step === 2) {
                    dispatch(selectArrivalStation(station.id));
                    toast.success('Arrival station selected!');
                  }
                }}
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
          onToggle={handleSheetToggle}
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
function DepartureStationDetails() {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationId = useAppSelector(selectDepartureStationId);

  if (stationId === null) {
    return <p className="p-4 text-destructive">No departure station set.</p>;
  }
  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const handleClear = () => {
    dispatch(selectDepartureStation(null));
  };

  // "Confirm" goes to step=2
  const handleConfirm = () => {
    dispatch(advanceBookingStep(2));
    toast.success('Departure station confirmed. Now select your arrival station.');
  };

  // "Change Station" lets user pick again in step=1
  // (set departureId=null or just keep the same step=1)
  const handleChangeStation = () => {
    dispatch(selectDepartureStation(null));
    // If you want to keep step=1, do that. If you're already on step=2, do step=1 again
    dispatch(advanceBookingStep(1));
    toast('You can now pick a new departure station.');
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

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear
        </button>
        <button
          onClick={handleConfirm}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Confirm Departure
        </button>
        <button
          onClick={handleChangeStation}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Change Station
        </button>
      </div>
    </div>
  );
}

/* --------------------- Arrival Station Details -------------------- */
function ArrivalStationDetails() {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationId = useAppSelector(selectArrivalStationId);

  if (stationId === null) {
    return <p className="p-4 text-destructive">No arrival station set.</p>;
  }
  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const handleClear = () => {
    dispatch(selectArrivalStation(null));
  };

  // Confirm arrival => step=3 or next flow
  const handleConfirm = () => {
    dispatch(advanceBookingStep(3));
    toast.success('Arrival station confirmed!');
  };

  // "Back to Step 1" if user wants to change departure again
  const handleBackToDeparture = () => {
    // Clear arrival
    dispatch(selectArrivalStation(null));
    // Force step=1 so user can repick departure
    dispatch(advanceBookingStep(1));
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

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear
        </button>
        <button
          onClick={handleConfirm}
          className="px-3 py-2 bg-green-600 text-white rounded-md text-sm"
        >
          Confirm Arrival
        </button>
        <button
          onClick={handleBackToDeparture}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Back to Departure
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

/* -------------- Export -------------- */
export default function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
}
