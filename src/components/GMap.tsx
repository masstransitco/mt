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

// Optional: if you use react-hot-toast
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

const CONTAINER_STYLE: CSSProperties = {
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

/** Dynamically build a bottom-sheet title that includes the step. */
function buildSheetTitle(step: number, departureId: number | null, arrivalId: number | null) {
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

/* ----------------------- Station List Item ------------------------ */
interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}

const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  // When user clicks a station from the list
  const handleClick = useCallback(() => {
    if (step === 1) {
      dispatch(selectDepartureStation(station.id));
      toast.success('Departure station selected!');
    } else if (step === 2) {
      dispatch(selectArrivalStation(station.id));
      toast.success('Arrival station selected!');
    }
  }, [dispatch, step, station.id]);

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

/* ------------------ Memoized GoogleMap ------------------ */
const MemoizedGoogleMap = memo(GoogleMap);

/* -------------------------- Main GMap ---------------------------- */
interface GMapProps {
  googleApiKey: string;
}

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

  // Step 1 or 2
  const step = useAppSelector(selectBookingStep);

  // Which station IDs are selected
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Geolocation (if set)
  const userLocation = useAppSelector(selectUserLocation);

  // UI
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  const memoizedStations = useMemo(() => stations, [stations]);

  // Google Maps script loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Simple overlay state
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Keep map ref
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Optional: get user geolocation
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

  // On mount, fetch stations/cars
  useEffect(() => {
    const initialize = async () => {
      try {
        await dispatch(fetchStations()).unwrap();
        await dispatch(fetchCars()).unwrap();
        getUserLocation();
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    initialize();
  }, [dispatch, getUserLocation]);

  // Once loaded, remove overlay
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Auto-open/close sheet based on whether user still needs to pick a station
  useEffect(() => {
    const needsDeparture = step === 1 && !departureStationId;
    const needsArrival = step === 2 && !arrivalStationId;
    const mustPick = needsDeparture || needsArrival;

    if (viewState === 'showMap') {
      if (mustPick && isSheetMinimized) {
        dispatch(toggleSheet());
      } else if (!mustPick && !isSheetMinimized) {
        dispatch(toggleSheet());
      }
    }
  }, [
    step,
    departureStationId,
    arrivalStationId,
    isSheetMinimized,
    viewState,
    dispatch,
  ]);

  // Combine errors
  const combinedError = stationsError || carsError || loadError;
  if (combinedError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
        {combinedError instanceof Error
          ? `Error loading Google Maps: ${combinedError.message}`
          : combinedError}
      </div>
    );
  }

  // If still loading
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
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading map & stations...</span>
        </div>
      </div>
    );
  }

  // Build sheet title
  const sheetTitle = buildSheetTitle(step, departureStationId, arrivalStationId);

  // Decide what to render in the sheet:
  // either "StationDetail" if station selected for this step, or station list if not
  function renderSheetContent() {
    // If user has chosen a station for the current step, show detail
    if ((step === 1 && departureStationId !== null) || (step === 2 && arrivalStationId !== null)) {
      return <StationDetail />;
    }
    // Otherwise, show instructions & station list
    return (
      <>
        {step === 1 && !departureStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Select your <strong>departure station</strong> from the map or list below:
          </div>
        )}
        {step === 2 && !arrivalStationId && (
          <div className="p-3 text-sm text-muted-foreground">
            Select your <strong>arrival station</strong> from the map or list below:
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

  // Marker click => pan + select station
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      const [lng, lat] = station.geometry.coordinates;
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
          {/* If you set userLocation */}
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

      {/* Bottom Sheet */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => dispatch(toggleSheet())}
          title={sheetTitle}
          count={stations.length}
        >
          {renderSheetContent()}
        </Sheet>
      )}
    </div>
  );
}

/* ----------------- Station Detail (Unified) ---------------- */
function StationDetail() {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  // For step=1, use departureStationId; for step=2, use arrivalStationId
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const stationId = step === 1 ? departureStationId : arrivalStationId;
  if (stationId == null) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return <p className="p-4 text-destructive">Station not found.</p>;
  }

  const modeLabel = step === 1 ? 'Departure' : 'Arrival';

  const handleClear = () => {
    if (step === 1) {
      dispatch(selectDepartureStation(null));
    } else {
      dispatch(selectArrivalStation(null));
    }
  };

  // Confirm => advance to next step
  const handleConfirm = () => {
    dispatch(advanceBookingStep(step + 1));
    if (step === 1) {
      toast.success('Departure confirmed. Now pick an arrival station.');
    } else {
      toast.success('Arrival confirmed! Next: Payment or finalizing...');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {station.properties.Place} ({modeLabel})
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
          onClick={handleConfirm}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Confirm {modeLabel}
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

/* -------------- Export With Error Boundary -------------- */
export default function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
}
