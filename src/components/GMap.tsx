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

// ---- Import from stationsSlice (fetch & station data) ----
import {
  fetchStations,
  selectStationsWithDistance,
  selectStationsLoading,
  selectStationsError,
} from '@/store/stationsSlice';

// ---- Import from userSlice (user location & selected station) ----
import {
  setUserLocation,
  selectUserLocation,
  selectStation,
} from '@/store/userSlice';

// ---- Import from uiSlice (UI states) ----
import {
  selectViewState,
  selectIsSheetMinimized,
  toggleSheet,
} from '@/store/uiSlice';

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
    // Select the station in userSlice
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

  // ---- Selectors from each slice ----
  const stations = useAppSelector(selectStationsWithDistance);
  const isLoading = useAppSelector(selectStationsLoading);
  const error = useAppSelector(selectStationsError);

  const userLocation = useAppSelector(selectUserLocation);

  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Memoize stations for the list
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

  // On mount, fetch stations and get user location
  useEffect(() => {
    const initialize = async () => {
      try {
        await dispatch(fetchStations()).unwrap();
        getUserLocation();
      } catch (err) {
        console.error('Error fetching stations:', err);
      }
    };
    initialize();
  }, [dispatch, getUserLocation]);

  // When a station marker is clicked, select it and toggle the sheet
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      dispatch(selectStation(station.id));
      dispatch(toggleSheet()); // from uiSlice
    },
    [dispatch]
  );

  // Error handling
  if (error || loadError) {
    return (
      <div className="text-destructive">
        {error || `Error loading Google Maps: ${loadError?.message}`}
      </div>
    );
  }

  // If Google Maps script isn’t loaded yet
  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading Google Map...</div>;
  }

  // ---- Render the Google Map plus the sheet/list ----
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
        </MemoizedGoogleMap>
      </div>

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => dispatch(toggleSheet())}
          title="Nearby Stations"
          count={stations.length}
        >
          {isLoading ? (
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

/* --------------- Error Boundary Class ---------------------- */
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

/* ------------------ Main Export with Error Boundary ------------------ */
export default function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
}