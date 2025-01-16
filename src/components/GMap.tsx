'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectStation, selectViewState } from '@/store/userSlice';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Clock, Battery } from 'lucide-react';

interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: { type: 'Point'; coordinates: [number, number]; };
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

  // Bottom sheet should only show when viewing the map
  const showBottomSheet = viewState === 'showMap';

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
  }, [dispatch]);

  const defaultCenter = useMemo(() => userLocation || { lat: 22.3, lng: 114.0 }, [userLocation]);

  if (loadError) {
    return <div className="text-red-500">Error loading Google Maps: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div>Loading Google Map...</div>;
  }

  return (
    <div className="relative h-screen">
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

      {showBottomSheet && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg transform transition-transform duration-300 ease-in-out"
          style={{ height: '70vh' }}
        >
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nearby Chargers</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50">
                  Sort By
                </button>
                <button className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50">
                  72-325 kW
                </button>
                <button className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50">
                  0-72 kW
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto h-[calc(70vh-64px)]">
            {stations.map((station) => (
              <div
                key={station.id}
                className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => handleMarkerClick(station)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    {station.properties.waitTime && station.properties.waitTime < 5 && (
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Clock className="w-4 h-4 mr-1" />
                        &lt;5 minute wait time
                      </div>
                    )}
                    <h3 className="font-medium">{station.properties.Place}</h3>
                    <div className="text-sm text-gray-500">
                      {station.properties.maxPower} kW max · {station.properties.availableSpots}/{station.properties.totalSpots} Available
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded px-2 py-1 text-sm">
                    {station.distance?.toFixed(1)} km
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
