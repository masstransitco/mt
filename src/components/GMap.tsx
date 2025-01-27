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
  selectUserLocation,
  selectStation,       // Import the selectStation action
  selectSelectedStationId, // We'll need this to know which station is selected
} from '@/store/userSlice';
import {
  toggleSheet,
  selectViewState,
  selectIsSheetMinimized,
} from '@/store/uiSlice';

// Booking slice (to advance steps, etc.)
import {
  advanceBookingStep,
  selectBookingStep,
} from '@/store/bookingSlice';

// UI
import Sheet from '@/components/ui/sheet';

/* --------------------------- Constants --------------------------- */
const LIBRARIES: ('geometry')[] = ['geometry'];
const MAP_OPTIONS: google.maps.MapOptions = { /* ... */ };
const CONTAINER_STYLE = { /* ... */ };
const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 };

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

  const handleClick = useCallback(() => {
    // When clicking on a station list item, select it
    dispatch(selectStation(station.id));
  }, [dispatch, station.id]);

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
            <Zap className="w-4 h-4" />
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

/* ---------------------- Memoized GoogleMap ---------------------- */
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

  // User location + selected station
  const userLocation = useAppSelector(selectUserLocation);
  const selectedStationId = useAppSelector(selectSelectedStationId);

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

  // Keep reference of the map instance
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Get user location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // dispatch user location
      },
      (err) => {
        console.error('Geolocation error:', err);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch]);

  // On mount, fetch stations, fetch cars, get user location
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

  // When marker clicked, select the station & open bottom sheet
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      dispatch(selectStation(station.id));
      dispatch(toggleSheet());
    },
    [dispatch]
  );

  // Handle errors
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
          {/* User location */}
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
                  path: 'M -2 -2 L 2 -2 L 2 2 L -2 2 z', // square
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

      {/* BOTTOM SHEET: either station list or selected station details */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => dispatch(toggleSheet())}
          title={
            selectedStationId
              ? 'Selected Station'
              : 'Nearby Stations'
          }
          // If showing a single station, no need for a big count
          count={selectedStationId ? undefined : stations.length}
        >
          {stationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading stations...
            </div>
          ) : selectedStationId ? (
            /* ----------------- Show selected station details here ----------------- */
            <SelectedStationDetails stationId={selectedStationId} />
          ) : (
            /* ----------------- Otherwise, show the station list ----------------- */
            <FixedSizeList
              height={400}
              width="100%"
              itemCount={stations.length}
              itemSize={80}
              itemData={memoizedStations}
            >
              {StationListItem}
            </FixedSizeList>
          )}
        </Sheet>
      )}
    </div>
  );
}

/* ------------------ Station Details Component ------------------ */
function SelectedStationDetails({ stationId }: { stationId: number }) {
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);

  // Find the station object from your stations array
  const station = stations.find((s) => s.id === stationId);

  // If it doesn’t exist (edge case)
  if (!station) {
    return (
      <div className="p-4">
        <p className="text-destructive">Station not found.</p>
      </div>
    );
  }

  const handleClearSelection = () => {
    dispatch(selectStation(null)); // Clear station selection
  };

  const handleProceed = () => {
    // Example: go to the next booking step
    dispatch(advanceBookingStep(2));
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">{station.properties.Place}</h3>
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
          onClick={handleClearSelection}
          className="px-3 py-2 bg-gray-200 rounded-md text-sm"
        >
          Clear Selection
        </button>
        <button
          onClick={handleProceed}
          className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
        >
          Next Step
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
