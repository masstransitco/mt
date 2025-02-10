'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-hot-toast';
import { Car, Locate } from 'lucide-react';
import * as THREE from 'three';
import { ThreeJSOverlayView } from '@googlemaps/three';
// (Optional) If you wish to load GLTF models as in the official sample:
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';

// 3D data
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

/**
 * Helper: Build an extruded polygon from a set of [lng, lat] coordinates.
 */
function buildExtrudedPolygon(
  overlay: ThreeJSOverlayView,
  coords: number[][]
): THREE.Mesh | null {
  if (!coords.length) return null;
  const shape = new THREE.Shape();
  coords.forEach(([lng, lat], idx) => {
    const v3 = overlay.latLngAltitudeToVector3({
      lat,
      lng,
      altitude: 200, // Adjust altitude as needed
    });
    if (idx === 0) shape.moveTo(v3.x, v3.y);
    else shape.lineTo(v3.x, v3.y);
  });
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 500, // Adjust extrusion depth as needed
    bevelEnabled: false,
  };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    opacity: 0.6,
    transparent: true,
  });
  return new THREE.Mesh(geom, mat);
}

interface GMapProps {
  googleApiKey: string;
}

type OpenSheetType = 'none' | 'car' | 'list' | 'detail';

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs for Google Map and Three.js objects.
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Local state.
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Active station and matching 3D feature.
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);
  const [activeStation3D, setActiveStation3D] = useState<any | null>(null);

  // Sheet state.
  const [openSheet, setOpenSheet] = useState<OpenSheetType>('car');
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>('none');

  // Redux selectors.
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const userLocation = useAppSelector(selectUserLocation);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);
  const bookingStep = useAppSelector(selectBookingStep);
  const stations3D = useAppSelector(selectStations3D);

  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  console.log('Checking for ThreeJSOverlayView at import time =>', typeof ThreeJSOverlayView);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    version: 'beta', // critical for ThreeJSOverlayView
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (isLoaded && window.google) {
      console.log('Maps API loaded; setting map options and marker icons');
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    } else {
      console.log('isLoaded=', isLoaded, ' - window.google exists?', !!window.google);
    }
  }, [isLoaded]);

  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!google?.maps?.geometry?.spherical) {
        console.log('Geometry.spherical not available');
        return stationsToSort;
      }
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

  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!mapRef.current) return;
      mapRef.current.panTo(location);
      mapRef.current.setZoom(15);
      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);
      if (isSheetMinimized) dispatch(toggleSheet());
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint]
  );

  useEffect(() => {
    (async () => {
      try {
        console.log('Fetching stations, 3D data, and cars...');
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

  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      console.log('handleMapLoad called');
      mapRef.current = map;

      // Fit bounds based on station locations.
      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }

      // Create a new Three.js scene.
      const scene = new THREE.Scene();
      scene.background = null;
      sceneRef.current = scene;

      // Add lights following the official sample.
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
      directionalLight.position.set(0, 10, 50);
      scene.add(directionalLight);

      // Add a dummy cube to the scene.
      const cubeGeo = new THREE.BoxGeometry(50, 50, 50);
      const cubeMat = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
      const dummyCube = new THREE.Mesh(cubeGeo, cubeMat);
      // Place the cube at (0,0,0) relative to the overlay’s anchor.
      dummyCube.position.set(0, 0, 0);
      scene.add(dummyCube);
      console.log('Dummy cube added to scene');

      // If an active station 3D feature exists, add its extruded polygon.
      // (Since the helper requires an overlay reference, we add it right after creating the overlay.)
      // We'll update the scene later if activeStation3D changes.
      
      // Determine the anchor point.
      const anchor = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng, altitude: 100 }
        : { ...DEFAULT_CENTER, altitude: 100 };

      // Create the ThreeJSOverlayView following the official pattern.
      const overlay = new ThreeJSOverlayView({
        map,
        scene,
        anchor,
         // @ts-ignore: 'THREE' is expected at runtime but not defined in the type
        THREE,
      });
      overlayRef.current = overlay;
      console.log('ThreeJSOverlayView created');

      // (Optional) Trigger a redraw whenever needed.
      // For example, if activeStation3D becomes available later, you could update the scene and then call:
      // overlay.requestRedraw();
    },
    [stations, userLocation, activeStation3D]
  );

  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Cleanup effect.
  useEffect(() => {
    return () => {
      console.log('Cleaning up ThreeJS resources');
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

  const hasError = stationsError || carsError || loadError;

  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

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
      setActiveStation(null);
      setActiveStation3D(null);
      overlayRef.current?.requestRedraw();
    }
  };

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
        setActiveStation(null);
        setActiveStation3D(null);
        openNewSheet('list');
        toast.success('Location found!');
      },
      (err) => {
        console.error('Geolocation error:', err);
        toast.error('Unable to retrieve location.');
      }
    );
  };

  const handleCarToggle = () => {
    if (openSheet === 'car') {
      closeCurrentSheet();
    } else {
      setActiveStation(null);
      setActiveStation3D(null);
      openNewSheet('car');
    }
  };

  const getStationIcon = (station: StationFeature) => {
    if (!markerIcons) return undefined;
    if (station.id === departureStationId) return markerIcons.departureStation;
    if (station.id === arrivalStationId) return markerIcons.arrivalStation;
    if (station.id === activeStation?.id) return markerIcons.activeStation;
    return markerIcons.station;
  };

  const handleStationClick = (station: StationFeature) => {
    setActiveStation(station);
    const objectId = station.properties.ObjectId;
    const match = stations3D.find((f: any) => f.properties.ObjectId === objectId) || null;
    setActiveStation3D(match);
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    openNewSheet('detail');
    if (isSheetMinimized) {
      dispatch(toggleSheet());
    }
  };

  const handleStationSelectedFromList = (station: StationFeature) => {
    setActiveStation(station);
    const objectId = station.properties.ObjectId;
    const match = stations3D.find((f: any) => f.properties.ObjectId === objectId) || null;
    setActiveStation3D(match);
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    openNewSheet('detail');
  };

  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(3));
    setPreviousSheet('none');
    setOpenSheet('none');
    setActiveStation(null);
    setActiveStation3D(null);
    overlayRef.current?.requestRedraw();
  };

  const handleClearStationDetail = () => {
    closeCurrentSheet();
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
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

          <StationSelector onAddressSearch={handleAddressSearch} />

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

          {openSheet === 'car' && <CarSheet isOpen onToggle={handleCarToggle} />}

          {openSheet === 'list' && (
            <Sheet isOpen onToggle={closeCurrentSheet} title="Nearby Stations" count={sortedStations.length}>
              <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
                {sortedStations.map((station, idx) => (
                  <StationListItem
                    key={station.id}
                    index={idx}
                    style={{}}
                    data={{ items: sortedStations, onStationSelected: () => handleStationSelectedFromList(station) }}
                  />
                ))}
              </div>
            </Sheet>
          )}

          {openSheet === 'detail' && activeStation && (
            <Sheet isOpen onToggle={closeCurrentSheet} title="Station Details" count={(searchLocation ? sortedStations : stations).length}>
              <StationDetail
                stations={searchLocation ? sortedStations : stations}
                activeStation={activeStation}
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
