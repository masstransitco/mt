'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { FixedSizeList } from 'react-window';
import { toast } from 'react-hot-toast';

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
  selectUserLocation,
  selectViewState,
} from '@/store/userSlice';
import {
  toggleSheet,
  selectIsSheetMinimized,
} from '@/store/uiSlice';
import { selectBookingStep } from '@/store/bookingSlice';

import Sheet from '@/components/ui/sheet';
import { StationListItem } from './StationListItem';
import { StationDetail } from './StationDetail';
import { LoadingSpinner } from './LoadingSpinner';
import StationSelector from './StationSelector';

// Constants
const LIBRARIES: ("geometry" | "places")[] = ["geometry", "places"];
const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: 'calc(100vh - 64px)',
};
const DEFAULT_CENTER = { lat: 22.3193, lng: 114.1694 }; // Hong Kong center
const DEFAULT_ZOOM = 11;

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  
  // Local state
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);

  // Redux state
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const step = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const userLocation = useAppSelector(selectUserLocation);
  const viewState = useAppSelector(selectViewState);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Maps API loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    libraries: LIBRARIES,
  });

  // Initialize map options and services
  useEffect(() => {
    if (isLoaded && window.google) {
      setDirectionsService(new google.maps.DirectionsService());
      setMapOptions({
        mapId: 'ev_station_map',
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        clickableIcons: false,
        backgroundColor: '#f8fafc',
        restriction: {
          latLngBounds: {
            north: 22.6,
            south: 22.1,
            east: 114.4,
            west: 113.8,
          },
          strictBounds: true,
        },
      });
      setMarkerIcons({
        user: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        departureStation: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#34D399',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        arrivalStation: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#F87171',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        activeStation: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#6366F1',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        inactiveStation: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#6B7280',
          fillOpacity: 0.8,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
        car: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          fillColor: '#8B5CF6',
          fillOpacity: 0.8,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
        },
      });
    }
  }, [isLoaded]);

  // Calculate and draw route when stations change
  useEffect(() => {
    const calculateRoute = async () => {
      if (!directionsService || !departureStationId || !arrivalStationId) {
        setRoutePath([]);
        setRouteInfo(null);
        return;
      }

      const departureStation = stations.find(s => s.id === departureStationId);
      const arrivalStation = stations.find(s => s.id === arrivalStationId);

      if (!departureStation || !arrivalStation) return;

      const [departureLng, departureLat] = departureStation.geometry.coordinates;
      const [arrivalLng, arrivalLat] = arrivalStation.geometry.coordinates;

      try {
        const result = await directionsService.route({
          origin: { lat: departureLat, lng: departureLng },
          destination: { lat: arrivalLat, lng: arrivalLng },
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: true,
        });

        if (result.routes.length > 0 && result.routes[0].overview_path) {
          setRoutePath(result.routes[0].overview_path);
          
          // Update route info
          const route = result.routes[0].legs[0];
          setRouteInfo({
            distance: route.distance?.text || '',
            duration: route.duration?.text || '',
          });

          // Adjust map bounds
          if (mapRef.current) {
            const bounds = new google.maps.LatLngBounds();
            result.routes[0].overview_path.forEach(point => bounds.extend(point));
            mapRef.current.fitBounds(bounds, { padding: 50 });
          }
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        toast.error('Failed to calculate route');
        setRoutePath([]);
        setRouteInfo(null);
      }
    };

    calculateRoute();
  }, [directionsService, departureStationId, arrivalStationId, stations]);

  // Sort stations by distance to a point
  const sortStationsByDistanceToPoint = useCallback((point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
    if (!google?.maps?.geometry?.spherical) return stationsToSort;

    return [...stationsToSort].sort((a, b) => {
      const [lngA, latA] = a.geometry.coordinates;
      const [lngB, latB] = b.geometry.coordinates;
      
      const distA = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(latA, lngA),
        new google.maps.LatLng(point.lat, point.lng)
      );
      const distB = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(latB, lngB),
        new google.maps.LatLng(point.lat, point.lng)
      );
      
      return distA - distB;
    });
  }, []);

  // Map interaction handlers
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (stations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      stations.forEach(station => {
        const [lng, lat] = station.geometry.coordinates;
        bounds.extend({ lat, lng });
      });
      map.fitBounds(bounds, 50);
    }
  }, [stations]);

  const handleMarkerClick = useCallback((station: StationFeature) => {
    if (!mapRef.current) return;

    const [lng, lat] = station.geometry.coordinates;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(15);

    setActiveStation(station);
    setSelectedStationId(station.id);
  }, []);

  const handleMarkerHover = useCallback((station: StationFeature | null) => {
    setActiveStation(station);
  }, []);

  const handleAddressSearch = useCallback((location: google.maps.LatLngLiteral) => {
    if (!mapRef.current) return;

    setSearchLocation(location);
    mapRef.current.panTo(location);
    mapRef.current.setZoom(15);

    const sorted = sortStationsByDistanceToPoint(location, stations);
    setSortedStations(sorted);

    if (isSheetMinimized) {
      dispatch(toggleSheet());
    }
  }, [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]);

  // Sheet controls
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  const getSheetTitle = useCallback(() => {
    if (routeInfo) {
      return `Route: ${routeInfo.distance} (${routeInfo.duration})`;
    }
    if (searchLocation) return "Nearby Stations";
    if (activeStation) return "Station Details";
    return step === 1 ? 'Select Departure Station' : 'Select Arrival Station';
  }, [routeInfo, searchLocation, activeStation, step]);

  // Marker styling
  const getMarkerIcon = useCallback((station: StationFeature) => {
    if (!markerIcons) return null;
    
    if (station.id === departureStationId) {
      return markerIcons.departureStation;
    }
    if (station.id === arrivalStationId) {
      return markerIcons.arrivalStation;
    }
    const isActive = station.id === activeStation?.id;
    return isActive ? markerIcons.activeStation : markerIcons.inactiveStation;
  }, [markerIcons, departureStationId, arrivalStationId, activeStation]);

  // Error handling
  if (loadError || stationsError || carsError) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] bg-background text-destructive p-4">
        <div className="text-center space-y-2">
          <p className="font-medium">Error loading map data</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm underline hover:text-destructive/80"
          >
            Try reloading
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isLoaded || overlayVisible) {
    return <LoadingSpinner />;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={mapOptions || {}}
          onLoad={handleMapLoad}
        >
          {/* User location marker */}
          {userLocation && markerIcons && (
            <Marker
              position={userLocation}
              icon={markerIcons.user}
              clickable={false}
            />
          )}

          {/* Station markers */}
          {(searchLocation ? sortedStations : stations).map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                onClick={() => handleMarkerClick(station)}
                onMouseOver={() => handleMarkerHover(station)}
                onMouseOut={() => handleMarkerHover(null)}
                icon={getMarkerIcon(station)}
              />
            );
          })}

          {/* Car markers */}
          {cars.map((car) => (
            <Marker
              key={car.id}
              position={{ lat: car.lat, lng: car.lng }}
              title={car.name}
              icon={markerIcons?.car}
            />
          ))}

          {/* Route polyline */}
          {routePath.length > 0 && (
            <Polyline
              path={routePath}
              options={{
                strokeColor: '#4285F4',
                strokeWeight: 4,
                strokeOpacity: 0.8,
                geodesic: true,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 3,
                  },
                  offset: '50%',
                  repeat: '100px',
                }],
              }}
            />
          )}
        </GoogleMap>
      </div>

      <StationSelector onAddressSearch={handleAddressSearch} />

      {viewState === 'showMap' && (
        <Sheet
          isOpen={!isSheetMinimized}
          onToggle={handleSheetToggle}
          title={getSheetTitle()}
          count={(searchLocation ? sortedStations : stations).length}
        >
          <StationDetail 
            stations={searchLocation ? sortedStations : stations}
            activeStation={activeStation}
            routeInfo={routeInfo}
          />
        </Sheet>
      )}

      {/* Route information overlay */}
      {routeInfo && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-border">
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-foreground">Route Details</h3>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Distance: {routeInfo.distance}
              </p>
              <p className="text-sm text-muted-foreground">
                Duration: {routeInfo.duration}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data initialization effect */}
      {useEffect(() => {
        const init = async () => {
          try {
            await Promise.all([
              dispatch(fetchStations()).unwrap(),
              dispatch(fetchCars()).unwrap()
            ]);
            setOverlayVisible(false);
          } catch (err) {
            console.error('Error fetching data:', err);
            toast.error('Failed to load map data');
          }
        };
        init();
      }, [dispatch])}
    </div>
  );
}

// Type for StationDetail props
interface StationDetailProps {
  stations: StationFeature[];
  activeStation: StationFeature | null;
  routeInfo?: {
    distance: string;
    duration: string;
  } | null;
}

// Helper function to format station details
function formatStationDetails(station: StationFeature) {
  return {
    title: station.properties.Place,
    address: station.properties.Address,
    stats: [
      { label: 'Max Power', value: `${station.properties.maxPower} kW` },
      { label: 'Available', value: `${station.properties.availableSpots}/${station.properties.totalSpots}` },
      station.properties.waitTime 
        ? { label: 'Wait Time', value: `${station.properties.waitTime} min` }
        : null
    ].filter(Boolean)
  };
}

// Export types for external use
export type { GMapProps, StationDetailProps };
