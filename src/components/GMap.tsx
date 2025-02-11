'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import { Car, Locate } from 'lucide-react';
import * as THREE from 'three';
import { ThreeJSOverlayView } from '@googlemaps/three';

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
  selectUserLocation,
  setUserLocation,
  selectDepartureStationId,
  selectArrivalStationId,
} from '@/store/userSlice';
import { toggleSheet, selectIsSheetMinimized } from '@/store/uiSlice';
import {
  selectBookingStep,
  advanceBookingStep,
  fetchRoute,
} from '@/store/bookingSlice';

import { fetchStations3D, selectStations3D } from '@/store/stations3DSlice';

// UI Components
import Sheet from '@/components/ui/sheet';
import StationSelector from './StationSelector';
import { LoadingSpinner } from './LoadingSpinner';
import CarSheet from '@/components/booking/CarSheet';
import StationDetail from './StationDetail';
import { StationListItem } from './StationListItem';

// Map configuration
import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
} from '@/constants/map';

interface GMapProps {
  googleApiKey: string;
}

type OpenSheetType = 'none' | 'car' | 'list' | 'detail';

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs for Google Map and Three.js
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  // Local UI state
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  const [openSheet, setOpenSheet] = useState<OpenSheetType>('car');
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>('none');

  // Redux
  const dispatch = useAppDispatch();

  // Station data
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);

  // Cars data
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  // 3D station data
  const stations3D = useAppSelector(selectStations3D);

  // User & UI
  const userLocation = useAppSelector(selectUserLocation);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);
  const bookingStep = useAppSelector(selectBookingStep);

  // IDs for departure/arrival
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Load the Maps JS API
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    version: 'beta',
    libraries: LIBRARIES,
  });

  // On initial load, set map options/icons
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Fetch stations, cars, and 3D data
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchStations3D()).unwrap(),
          dispatch(fetchCars()).unwrap(),
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
        toast.error('Failed to load map data');
      }
    })();
  }, [dispatch]);

  // Once data is loaded, remove overlay spinner
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // If any error from station/cars or loadError, show error UI
  const hasError = stationsError || carsError || loadError;

  // --- Directions: If both departure & arrival selected, fetch route
  useEffect(() => {
    if (departureStationId && arrivalStationId) {
      const departureStation = stations.find((s) => s.id === departureStationId);
      const arrivalStation = stations.find((s) => s.id === arrivalStationId);
      if (departureStation && arrivalStation) {
        dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
      }
    }
  }, [departureStationId, arrivalStationId, stations, dispatch]);

  // Utility to sort stations by distance to a point
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
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
    },
    []
  );

  // Handle address search from StationSelector
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);

      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]
  );

  // Open/close sheet helpers
  const openNewSheet = (newSheet: OpenSheetType) => {
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  const closeCurrentSheet = () => {
    const old = openSheet;
    setOpenSheet(previousSheet);
    setPreviousSheet('none');
    if (old === 'detail') {
      // We used to clear local activeStation here; no longer needed
      overlayRef.current?.requestRedraw();
    }
  };

  // "Locate me" logic
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        dispatch(setUserLocation(loc));
        if (mapRef.current) {
          mapRef.current.panTo(loc);
          mapRef.current.setZoom(15);
        }
        const sorted = sortStationsByDistanceToPoint(loc, stations);
        setSearchLocation(loc);
        setSortedStations(sorted);
        openNewSheet('list');
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  // "Car" sheet toggle
  const handleCarToggle = () => {
    if (openSheet === 'car') {
      closeCurrentSheet();
    } else {
      openNewSheet('car');
    }
  };

  // ----------------------------
  // Marker / Station selection
  // ----------------------------

  // Handler for station clicks (marker or 3D)
  const handleStationClick = useCallback(
    (station: StationFeature) => {
      // Based on the current step, set departure or arrival
      if (bookingStep < 3) {
        dispatch({ type: 'user/selectDepartureStation', payload: station.id });
      } else {
        dispatch({ type: 'user/selectArrivalStation', payload: station.id });
      }

      // Open detail sheet
      openNewSheet('detail');
      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, bookingStep, isSheetMinimized]
  );

  // For station list item click
  const handleStationSelectedFromList = (station: StationFeature) => {
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    openNewSheet('detail');
  };

  // 3D overlay click logic (raycaster)
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onOverlayClick(event: MouseEvent) {
      const canvas =
        (overlayRef.current && (overlayRef.current as any).canvas) ||
        document.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const camera = (overlayRef.current as any)?.camera;
      if (!camera) return;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(stationCubesRef.current, true);
      if (intersects.length > 0) {
        const station = intersects[0].object.userData.station;
        if (station) {
          handleStationClick(station);
        }
      }
    }

    const canvas =
      (overlayRef.current && (overlayRef.current as any).canvas) ||
      document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', onOverlayClick, false);
      return () => {
        canvas.removeEventListener('click', onOverlayClick);
      };
    }
  }, [handleStationClick]);

  // ----------------------------
  // Confirm / Clear from detail
  // ----------------------------
  const handleConfirmDeparture = () => {
    // When user confirms departure station, go from step 2 -> step 3
    dispatch(advanceBookingStep(3));
    // Close the detail sheet
    setOpenSheet('none');
    setPreviousSheet('none');
  };

  const handleClearStationDetail = () => {
    // Just close the detail sheet in the UI
    closeCurrentSheet();
  };

  // ----------------------------
  // Map / 3D Setup
  // ----------------------------
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Fit to all station bounds initially
      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }

      // Basic Three.js scene
      const scene = new THREE.Scene();
      scene.background = null;
      sceneRef.current = scene;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
      directionalLight.position.set(0, 10, 50);
      scene.add(directionalLight);

      // Anchor point
      const hongKongCenter = { lat: 22.298, lng: 114.177, altitude: 100 };

      const overlay = new ThreeJSOverlayView({
        map,
        scene,
        anchor: hongKongCenter,
        // @ts-expect-error
        THREE,
      });
      overlayRef.current = overlay;

      // Example dummy cube
      const dummyCubeGeo = new THREE.BoxGeometry(50, 50, 50);
      const dummyCubeMat = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
      const dummyCube = new THREE.Mesh(dummyCubeGeo, dummyCubeMat);
      const dummyCubePos = overlay.latLngAltitudeToVector3({
        lat: hongKongCenter.lat,
        lng: hongKongCenter.lng,
        altitude: hongKongCenter.altitude + 50,
      });
      dummyCube.position.copy(dummyCubePos);
      dummyCube.scale.set(3, 3, 3);
      scene.add(dummyCube);

      // Station cubes
      stations.forEach((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const stationCubePos = overlay.latLngAltitudeToVector3({
          lat,
          lng,
          altitude: hongKongCenter.altitude + 50,
        });
        const stationCubeGeo = new THREE.BoxGeometry(50, 50, 50);
        const stationCubeMat = new THREE.MeshPhongMaterial({
          color: 0xcccccc,
          opacity: 0.8,
          transparent: true,
        });
        const stationCube = new THREE.Mesh(stationCubeGeo, stationCubeMat);
        stationCube.position.copy(stationCubePos);
        stationCube.scale.set(2.1, 2.1, 2.1);
        stationCube.userData = { station };
        scene.add(stationCube);
        stationCubesRef.current.push(stationCube);
      });
    },
    [stations]
  );

  // Clean up 3D resources on unmount
  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        (overlayRef.current as any).setMap(null);
        overlayRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => mat.dispose());
            } else if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
    };
  }, []);

  // ----------------------------
  // Marker Icons
  // ----------------------------
  const getStationIcon = (station: StationFeature) => {
    if (!markerIcons) return undefined;
    // Show departure icon if it matches departureStationId
    if (station.id === departureStationId) return markerIcons.departureStation;
    // Show arrival icon if it matches arrivalStationId
    if (station.id === arrivalStationId) return markerIcons.arrivalStation;
    // Default
    return markerIcons.station;
  };

  // ----------------------------
  // Which station to show in StationDetail?
  // If user is in steps 1 or 2 => departure flows
  // If user is in steps 3+ => arrival flows
  // We'll pick whichever is selected from Redux.
  // ----------------------------
  const selectedStationId = bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = selectedStationId
    ? stations.find((s) => s.id === selectedStationId)
    : null;

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Error or Loading states */}
      {hasError ? (
        <div className="flex items-center justify-center w-full h-full bg-background text-destructive p-4">
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
      ) : overlayVisible ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Main Google Map */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={handleMapLoad}
            >
              {userLocation && markerIcons && (
                <Marker
                  position={userLocation}
                  icon={markerIcons.user}
                  clickable={false}
                />
              )}
              {(searchLocation ? sortedStations : stations).map((station) => {
                const [lng, lat] = station.geometry.coordinates;
                return (
                  <Marker
                    key={station.id}
                    position={{ lat, lng }}
                    icon={getStationIcon(station)}
                    onClick={() => handleStationClick(station)}
                  />
                );
              })}
              {cars.map((car) => (
                <Marker
                  key={car.id}
                  position={{ lat: car.lat, lng: car.lng }}
                  icon={markerIcons?.car}
                  title={car.name}
                />
              ))}
            </GoogleMap>
          </div>

          {/* Station selector overlay */}
          <StationSelector onAddressSearch={handleAddressSearch} />

          {/* Top-left buttons */}
          <div className="absolute top-[120px] left-4 z-30 flex flex-col space-y-2">
            <button
              onClick={handleLocateMe}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow"
            >
              <Locate className="w-5 h-5" />
            </button>
            <button
              onClick={handleCarToggle}
              className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow"
            >
              <Car className="w-5 h-5" />
            </button>
          </div>

          {/* Car sheet */}
          {openSheet === 'car' && (
            <CarSheet isOpen onToggle={handleCarToggle} />
          )}

          {/* Station list sheet */}
          {openSheet === 'list' && (
            <Sheet
              isOpen
              onToggle={closeCurrentSheet}
              title="Nearby Stations"
              count={sortedStations.length}
            >
              <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
                {sortedStations.map((station, idx) => (
                  <StationListItem
                    key={station.id}
                    index={idx}
                    style={{}}
                    data={{
                      items: sortedStations,
                      onStationSelected: () => handleStationSelectedFromList(station),
                    }}
                  />
                ))}
              </div>
            </Sheet>
          )}

          {/* Station detail sheet */}
          {openSheet === 'detail' && stationToShow && (
            <Sheet
              isOpen
              onToggle={closeCurrentSheet}
              title="Station Details"
              count={(searchLocation ? sortedStations : stations).length}
            >
              <StationDetail
                stations={searchLocation ? sortedStations : stations}
                activeStation={stationToShow}
                onConfirmDeparture={handleConfirmDeparture}
                onClear={handleClearStationDetail}
              />
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}
