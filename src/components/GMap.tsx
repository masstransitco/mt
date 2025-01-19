'use client';
import React, { useState, useEffect, useCallback, useMemo, PropsWithChildren } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectStation, selectViewState } from '@/store/userSlice';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Zap } from 'lucide-react';
import Sheet from '@/components/ui/sheet';

interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: { 
    type: 'Point'; 
    coordinates: [number, number]; 
  };
  properties: {
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
  };
  distance?: number;
}

interface GMapProps {
  googleApiKey: string;
}

const containerStyle = { 
  width: '100%', 
  height: 'calc(100vh - 64px)' 
};

interface MapErrorBoundaryState {
  hasError: boolean;
}

class MapErrorBoundary extends React.Component<PropsWithChildren, MapErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
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
      return <div className="text-destructive">Something went wrong loading the map. Please try again.</div>;
    }
    return this.props.children;
  }
}

function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const libraries = useMemo(() => ["geometry"] as ("geometry")[], []);
  
  const mapOptions = useMemo(() => ({
    mapId: '94527c02bbb6243',
    gestureHandling: 'greedy',
    disableDefaultUI: true,
    backgroundColor: '#111111'
  }), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries
  });

  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    if (!google?.maps?.geometry?.spherical) return 0;
    const from = new google.maps.LatLng(lat1, lon1);
    const to = new google.maps.LatLng(lat2, lon2);
    return google.maps.geometry.spherical.computeDistanceBetween(from, to) / 1000;
  }, []);

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
      (error) => {
        setError('Failed to get your location');
        console.error('Geolocation error:', error);
        setIsLoadingLocation(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/stations.geojson');
        if (!res.ok) throw new Error('Failed to fetch stations');
        const data = await res.json();
        if (data.type === 'FeatureCollection') {
          setStations(data.features);
        }
      } catch (err) {
        setError('Failed to load stations');
        console.error('Error fetching stations:', err);
      }
    };

    fetchStations();
    getUserLocation();
  }, [getUserLocation]);

  useEffect(() => {
    if (userLocation && stations.length > 0) {
      const stationsWithDistance = stations.map((station) => ({
        ...station,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          station.geometry.coordinates[1],
          station.geometry.coordinates[0]
        ),
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      setStations(stationsWithDistance);
    }
  }, [userLocation, stations.length, calculateDistance]);

  const handleMarkerClick = useCallback((station: StationFeature) => {
    dispatch(selectStation(station.id));
    setIsSheetMinimized(false);
  }, [dispatch]);

  const toggleSheet = useCallback(() => {
    setIsSheetMinimized(prev => !prev);
  }, []);

  const defaultCenter = useMemo(() => userLocation || { lat: 22.3, lng: 114.0 }, [userLocation]);

  const memoizedMarkers = useMemo(() => 
    stations.map((st) => {
      const [lng, lat] = st.geometry.coordinates;
      return (
        <Marker
          key={st.id}
          position={{ lat, lng }}
          onClick={() => handleMarkerClick(st)}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#FF4136",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#FFFFFF",
          }}
        />
      );
    }), [stations, handleMarkerClick]
  );

  const memoizedStationList = useMemo(() => 
    stations.map((station) => (
      <div
        key={station.id}
        className="px-4 py-3 hover:bg-muted/20 cursor-pointer"
        onClick={() => handleMarkerClick(station)}
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
    )), [stations, handleMarkerClick]
  );

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  if (loadError) {
    return <div className="text-destructive">Error loading Google Maps: {loadError.message}</div>;
  }

  if (!isLoaded || !google?.maps) {
    return <div className="text-muted-foreground">Loading Google Map...</div>;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={14}
          options={mapOptions}
        >
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF",
              }}
            />
          )}
          {memoizedMarkers}
        </GoogleMap>
      </div>

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={toggleSheet}
          title="Nearby Stations"
          count={stations.length}
        >
          <div className="divide-y divide-border/10">
            {memoizedStationList}
          </div>
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
