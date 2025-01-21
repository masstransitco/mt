import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useTransition,
  Suspense,
  startTransition
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectStation, selectViewState } from '@/store/userSlice';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Zap, Loader2 } from 'lucide-react';
import { FixedSizeList } from 'react-window';
import { useVirtualizer } from '@tanstack/react-virtual';
import Sheet from '@/components/ui/sheet';
import useDebounce from '@/hooks/useDebounce';

/* --------------------------- Constants --------------------------- */
const LIBRARIES: ("geometry")[] = ['geometry'];
const MAP_OPTIONS = {
  mapId: '94527c02bbb6243',
  gestureHandling: 'greedy' as const,
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
} as const;

// Create map instance cache
const mapInstanceCache = new WeakMap();

/* --------------------------- Custom Hooks --------------------------- */
const useStationsData = () => {
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStations = useCallback(async () => {
    try {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Check cache first
      const cached = localStorage.getItem('stations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setStations(data);
          return;
        }
      }

      const res = await fetch('/stations.geojson', {
        signal: abortControllerRef.current.signal
      });
      
      if (!res.ok) throw new Error('Failed to fetch stations');
      
      const data = await res.json();
      if (data.type === 'FeatureCollection') {
        startTransition(() => {
          setStations(data.features);
          localStorage.setItem(
            'stations',
            JSON.stringify({
              data: data.features,
              timestamp: Date.now(),
            })
          );
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      setError('Failed to load stations');
      console.error('Error fetching stations:', err);
    }
  }, []);

  useEffect(() => {
    fetchStations();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStations]);

  return { stations, error, refetch: fetchStations };
};

const useGeolocation = () => {
  const [location, setLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      setIsLoading(false);
      return;
    }

    // Watch position instead of getting it once
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        setError('Failed to get location');
        console.error('Geolocation error:', err);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }, []);

  useEffect(() => {
    getLocation();
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [getLocation]);

  return { location, error, isLoading };
};

/* -------------------------- Optimized Markers ---------------------------- */
const StationMarker = React.memo(({ 
  station,
  onClick 
}: { 
  station: StationFeature;
  onClick: (station: StationFeature) => void;
}) => {
  const [lng, lat] = station.geometry.coordinates;
  
  return (
    <Marker
      position={{ lat, lng }}
      onClick={() => onClick(station)}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#FF4136',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
      }}
      optimized={true}
    />
  );
});

StationMarker.displayName = 'StationMarker';

/* -------------------------- Main GMap ---------------------------- */
function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [isPending, startTransition] = useTransition();
  
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const { stations, error: stationsError, refetch } = useStationsData();
  const { location: userLocation, error: locationError, isLoading: isLoadingLocation } = useGeolocation();
  
  // Debounce map bounds changes
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const debouncedBounds = useDebounce(mapBounds, 500);

  // Load the Google Maps API with static libraries array
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Memoize the visible stations based on map bounds
  const visibleStations = useMemo(() => {
    if (!debouncedBounds || !stations.length) return stations;
    
    return stations.filter(station => {
      const [lng, lat] = station.geometry.coordinates;
      return debouncedBounds.contains({ lat, lng });
    });
  }, [stations, debouncedBounds]);

  // Optimize marker click handler
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      startTransition(() => {
        dispatch(selectStation(station.id));
        setIsSheetMinimized(false);
      });
    },
    [dispatch]
  );

  // Map load handler
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    mapInstanceCache.set(map, true);
  }, []);

  // Handle map bounds changes
  const onBoundsChanged = useCallback(() => {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      if (bounds) {
        setMapBounds(bounds);
      }
    }
  }, []);

  // Error handling
  const error = locationError || stationsError || loadError;
  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  if (!isLoaded || !google?.maps) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={14}
          options={MAP_OPTIONS}
          onLoad={onMapLoad}
          onBoundsChanged={onBoundsChanged}
        >
          {/* User Location Marker */}
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
            />
          )}

          {/* Station Markers */}
          <Suspense fallback={null}>
            {visibleStations.map((station) => (
              <StationMarker
                key={station.id}
                station={station}
                onClick={handleMarkerClick}
              />
            ))}
          </Suspense>
        </GoogleMap>
      </div>

      {/* Station List Sheet with loading states */}
      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={() => setIsSheetMinimized(prev => !prev)}
          title={`Nearby Stations ${isPending ? '(Updating...)' : ''}`}
          count={visibleStations.length}
        >
          <Suspense fallback={<div>Loading stations...</div>}>
            <FixedSizeList
              height={400}
              width="100%"
              itemCount={visibleStations.length}
              itemSize={80}
              itemData={visibleStations}
              overscanCount={5}
            >
              {StationListItem}
            </FixedSizeList>
          </Suspense>
        </Sheet>
      )}
    </div>
  );
}

export default React.memo(function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
});
