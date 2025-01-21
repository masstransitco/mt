import React, {
  useState,
  useEffect,
  useCallback,
  PropsWithChildren,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectStation, selectViewState } from '@/store/userSlice';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Zap } from 'lucide-react';
import { FixedSizeList } from 'react-window';
import Sheet from '@/components/ui/sheet';

/* --------------------------- Constants --------------------------- */
// Move libraries array outside component to prevent recreation
const LIBRARIES: ("geometry")[] = ['geometry'];

// Extract map options as a constant
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

const CONTAINER_STYLE = {
  width: '100%',
  height: 'calc(100vh - 64px)',
} as const;

const DEFAULT_CENTER = { lat: 22.3, lng: 114.0 } as const;

// Cache configuration
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/* --------------------------- Interfaces --------------------------- */
// ... [Previous interfaces remain the same]

/* ----------------------- Station List Item ------------------------ */
const StationListItem = React.memo(({ data, index, style }: any) => {
  const station = data[index];
  const dispatch = useDispatch();

  const handleClick = useCallback(() => {
    dispatch(selectStation(station.id));
  }, [dispatch, station.id]);

  return (
    <div
      style={style}
      className="px-4 py-3 hover:bg-muted/20 cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="font-medium text-foreground">{station.properties.Place}</h3>
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

/* -------------------------- Main GMap ---------------------------- */
function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);

  const [stations, setStations] = useState<StationFeature[]>([]);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the Google Maps API with static libraries array
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Memoize the distance calculation function
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      if (!google?.maps?.geometry?.spherical) return 0;
      const from = new google.maps.LatLng(lat1, lon1);
      const to = new google.maps.LatLng(lat2, lon2);
      return google.maps.geometry.spherical.computeDistanceBetween(from, to) / 1000;
    },
    []
  );

  // Memoize the location getter
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoadingLocation(false);
      },
      (err) => {
        setError('Failed to get your location');
        console.error('Geolocation error:', err);
        setIsLoadingLocation(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Memoize the stations fetcher
  const fetchStations = useCallback(async () => {
    try {
      const cached = localStorage.getItem('stations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setStations(data);
          return;
        }
      }

      const res = await fetch('/stations.geojson');
      if (!res.ok) throw new Error('Failed to fetch stations');
      const data = await res.json();
      if (data.type === 'FeatureCollection') {
        setStations(data.features);
        localStorage.setItem(
          'stations',
          JSON.stringify({
            data: data.features,
            timestamp: Date.now(),
          })
        );
      }
    } catch (err) {
      setError('Failed to load stations');
      console.error('Error fetching stations:', err);
    }
  }, []);

  // Memoize marker click handler
  const handleMarkerClick = useCallback(
    (station: StationFeature) => {
      dispatch(selectStation(station.id));
      setIsSheetMinimized(false);
    },
    [dispatch]
  );

  // Memoize sheet toggle
  const toggleSheet = useCallback(() => {
    setIsSheetMinimized((prev) => !prev);
  }, []);

  useEffect(() => {
    fetchStations();
    getUserLocation();
  }, [fetchStations, getUserLocation]);

  useEffect(() => {
    if (userLocation && stations.length > 0) {
      const stationsWithDistance = stations
        .map((station) => ({
          ...station,
          distance: calculateDistance(
            userLocation.lat,
            userLocation.lng,
            station.geometry.coordinates[1],
            station.geometry.coordinates[0]
          ),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

      setStations(stationsWithDistance);
    }
  }, [userLocation, stations, calculateDistance]);

  if (error) return <div className="text-destructive">{error}</div>;
  if (loadError) return <div className="text-destructive">Error loading Google Maps: {loadError.message}</div>;
  if (!isLoaded || !google?.maps) return <div className="text-muted-foreground">Loading Google Map...</div>;

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={14}
          options={MAP_OPTIONS}
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
              />
            );
          })}
        </GoogleMap>
      </div>

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={toggleSheet}
          title="Nearby Stations"
          count={stations.length}
        >
          <FixedSizeList
            height={400}
            width="100%"
            itemCount={stations.length}
            itemSize={80}
            itemData={stations}
          >
            {StationListItem}
          </FixedSizeList>
        </Sheet>
      )}
    </div>
  );
}

export default function GMapWithErrorBoundary(props: GMapProps) {
  return (
    <MapErrorBoundary>
      <GMap {...props} />
    </MapErrorBoundary>
  );
}
