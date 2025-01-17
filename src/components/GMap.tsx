'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectStation, selectViewState } from '@/store/userSlice';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Clock, Battery, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import Sheet from '@/components/ui/sheet';

interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
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

const containerStyle = { width: '100%', height: 'calc(100vh - 280px)' };

const mapOptions = {
  mapId: '94527c02bbb6243',
  gestureHandling: 'greedy',
  disableDefaultUI: true,
};

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: ['geometry']
  });

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    if (!google?.maps?.geometry?.spherical) return 0;
    const from = new google.maps.LatLng(lat1, lon1);
    const to = new google.maps.LatLng(lat2, lon2);
    return google.maps.geometry.spherical.computeDistanceBetween(from, to) / 1000;
  };

  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
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
        console.error('Error getting location:', error);
        setIsLoadingLocation(false);
      }
    );
  }, []);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/stations.geojson');
        const data = await res.json();
        if (data.type === 'FeatureCollection') {
          setStations(data.features);
        }
      } catch (err) {
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
  }, [userLocation, stations.length]);

  const handleMarkerClick = useCallback((station: StationFeature) => {
    console.log('Station clicked:', station.properties.Place);
    dispatch(selectStation(station.id));
    setIsSheetMinimized(false);
  }, [dispatch]);

  const toggleSheet = () => {
    setIsSheetMinimized(!isSheetMinimized);
  };

  const defaultCenter = useMemo(() => userLocation || { lat: 22.3, lng: 114.0 }, [userLocation]);

  if (loadError) {
    return <div className="text-destructive">Error loading Google Maps: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div className="text-muted-foreground">Loading Google Map...</div>;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={11}
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
          {stations.map((st) => {
            const [lng, lat] = st.geometry.coordinates;
            return (
              <Marker
                key={st.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(st)}
              />
            );
          })}
        </GoogleMap>
      </div>

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={toggleSheet}
          title="Nearby Chargers"
          subtitle={isSheetMinimized ? undefined : `${stations.length} stations found`}
          headerActions={
            !isSheetMinimized && (
              <div className="flex gap-2">
                <button className="bottom-sheet-filter-btn">Sort By</button>
                <button className="bottom-sheet-filter-btn">72-325 kW</button>
                <button className="bottom-sheet-filter-btn">0-72 kW</button>
              </div>
            )
          }
        >
          <div className="bottom-sheet-list">
            {stations.map((station) => (
              <div
                key={station.id}
                className="bottom-sheet-item"
                onClick={() => handleMarkerClick(station)}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    {station.properties.waitTime && station.properties.waitTime < 5 && (
                      <div className="bottom-sheet-item-detail">
                        <Clock className="w-4 h-4" />
                        &lt;5 minute wait time
                      </div>
                    )}
                    <h3 className="font-medium text-foreground">{station.properties.Place}</h3>
                    <div className="flex items-center gap-4">
                      <div className="bottom-sheet-item-detail">
                        <Zap className="w-4 h-4" />
                        {station.properties.maxPower} kW max
                      </div>
                      <div className="bottom-sheet-item-detail">
                        {station.properties.availableSpots}/{station.properties.totalSpots} Available
                      </div>
                    </div>
                  </div>
                  <div className="bottom-sheet-distance">
                    {station.distance?.toFixed(1)} km
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
