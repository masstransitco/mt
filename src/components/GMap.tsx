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
import { Zap } from 'lucide-react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

import { useAppDispatch, useAppSelector } from '@/store/store';

// -- stationsSlice: fetch + station data
import {
  fetchStations,
  selectStationsWithDistance,
  selectStationsLoading,
  selectStationsError,
} from '@/store/stationsSlice';

// -- userSlice: user location & selected station
import {
  setUserLocation,
  selectUserLocation,
  selectStation,
} from '@/store/userSlice';

// -- uiSlice: UI states (view mode, sheet toggles)
import {
  selectViewState,
  selectIsSheetMinimized,
  toggleSheet,
} from '@/store/uiSlice';

// -- carSlice: fetch + car data
import {
  fetchCars,
  selectAllCars,
  selectCarsLoading,
  selectCarsError,
} from '@/store/carSlice';

import Sheet from '@/components/ui/sheet';
import type { StationFeature } from '@/store/stationsSlice';

/* --------------------------- Constants --------------------------- */
const LIBRARIES: ('geometry')[] = ['geometry'];

const MAP_OPTIONS: google.maps.MapOptions = {
  mapId: '94527c02bbb6243',
  gestureHandling: 'greedy',
  disableDefaultUI: true,
  backgroundColor: '#111111',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
  restriction: {
    latLngBounds: {
      north: 22.6,
      south: 22.1,
      east: 114.4,
      west: 113.8,
    },
    strictBounds: true,
  },
};

const CONTAINER_STYLE = {
  width: '100%',
  height: 'calc(100vh - 64px)',
} as const;

const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 } as const;

/* --------------------------- Interfaces --------------------------- */
interface GMapProps {
  googleApiKey: string;
}

interface StationListItemProps extends ListChildComponentProps {
  data: StationFeature[];
}

/* ----------------------- Station List Item ------------------------ */
const StationListItem = memo<StationListItemProps>((props) => {
  const { index, style, data } = props;
  const station = data[index];
  const dispatch = useAppDispatch();

  const handleClick = useCallback(() => {
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
        <div className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
          {station.distance?.toFixed(1)} km
        </div>
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

  // -- Station data
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);

  // -- Car data
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  // -- User location
  const userLocation = useAppSelector(selectUserLocation);

  // -- UI states: which view + sheet minimization
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Memoize stations to prevent unnecessary re-renders in FixedSizeList
  const memoizedStations = useMemo(() => stations, [stations]);

  // Load Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Keep reference to the map instance
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Request user location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        dispatch(
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        );
      },
      (err) => {
        console.error('Geolocation error:', err);
        // Optionally handle location error or fallback
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [dispatch]);

  // On mount, fetch stations + cars + user location
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1) Fetch stations
        await dispatch(fetchStations()).unwrap();
        // 2) Fetch cars
        await dispatch(fetchCars()).unwrap();
        // 3) Get user location
        getUserLocation();
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    initialize();
  }, [dispatch, getUserLocation]);

  // When a station marker is clicked, select it and toggle the sheet
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      dispatch(selectStation(station.id));
      dispatch(toggleSheet());
    },
    [dispatch]
  );

  // Handle potential errors from stations, cars, or Google Maps load
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

  // If Google Maps script isn’t loaded yet
  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading Google Map...</div>;
  }

  // If either stations or cars are still loading, show a combined loading state
  if (stationsLoading || carsLoading) {
    return (
      <div className="text-muted-foreground">
        Loading {stationsLoading ? 'stations' : 'cars'}...
      </div>
    );
  }

  // Render the map + bottom sheet
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
          {/* Marker: User location */}
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

          {/* Markers: Stations */}
          {stations.map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(station)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#FF4136',
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: '#FFFFFF',
                }}
                clickable={true}
                visible={true}
              />
            );
          })}

          {/* Markers: Cars */}
          {cars.map((car) => (
            <Marker
              key={car.id}
              position={{ lat: car.lat, lng: car.lng }}
              title={car.name}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#1CBB13', // a distinct color for cars
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
              }}
            />
          ))}
        </MemoizedGoogleMap>
      </div>

      {/* If the UI is in "showMap" mode, display the bottom sheet (still listing stations) */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => dispatch(toggleSheet())}
          title="Nearby Stations"
          count={stations.length}
        >
          {stationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading stations...
            </div>
          ) : (
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

/* ------------------ Error Boundary ------------------ */
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
