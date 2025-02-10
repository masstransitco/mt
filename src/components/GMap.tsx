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
import {
  toggleSheet,
  selectIsSheetMinimized,
} from '@/store/uiSlice';
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';

// Fetch 3D data
import { fetchStations3D, selectStations3D } from '@/store/stations3DSlice';

import Sheet from '@/components/ui/sheet';
import StationSelector from './StationSelector';
import { LoadingSpinner } from './LoadingSpinner';
import CarSheet from '@/components/booking/CarSheet';
import StationDetail from './StationDetail';
import { StationListItem } from './StationListItem';

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
  const mapRef = useRef<google.maps.Map | null>(null);
  // We'll hold our Three.js scene in this ref.
  const sceneRef = useRef<THREE.Scene | null>(null);
  // Ref for our ThreeJSOverlayView instance
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);

  // Local UI state
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Active station (and its associated 3D feature)
  const [activeStation, setActiveStation] = useState<StationFeature | null>(null);
  const [activeStation3D, setActiveStation3D] = useState<any | null>(null);

  // Sheet state
  const [openSheet, setOpenSheet] = useState<OpenSheetType>('car');
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>('none');

  // Redux state selectors
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

  // Load the Google Maps API (using beta version to support ThreeJSOverlayView)
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    version: 'beta',
    libraries: LIBRARIES,
  });

  // Once loaded, set map options and marker icons
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  /**
   * Sort stations by distance from a point.
   */
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

  /**
   * Handle address search.
   */
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

  /**
   * On mount, fetch stations, 3D stations, and cars.
   */
  useEffect(() => {
    const init = async () => {
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
    };
    init();
  }, [dispatch]);

  /**
   * Handle map load: create ThreeJSOverlayView and set up the Three.js scene.
   */
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Fit bounds using station point data.
      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }

      // Create a Three.js scene.
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create a ThreeJSOverlayView instance.
      const overlay = new ThreeJSOverlayView({
        map,
        scene,
        // Use the userLocation as anchor if available, otherwise DEFAULT_CENTER.
        anchor: userLocation ? new google.maps.LatLng(userLocation.lat, userLocation.lng) : DEFAULT_CENTER,
        three: {
          camera: {
            fov: 45,
            near: 1,
            far: 2000,
          },
        },
      });
      overlay.setMap(map);
      overlayRef.current = overlay;

      // Define an update function that will be called each frame.
      scene.userData.update = () => {
        // Clear the scene for this frame.
        scene.clear();

        // Add a dummy cube for debugging (green box).
        const dummyCubeGeo = new THREE.BoxGeometry(20, 20, 20);
        const dummyCubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const dummyCube = new THREE.Mesh(dummyCubeGeo, dummyCubeMat);
        // Place the dummy cube at the default center with altitude 200.
        const dummyPosition = overlay.fromLatLngAltitude(new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng), 200);
        dummyCube.position.copy(dummyPosition);
        scene.add(dummyCube);
        console.log('Dummy cube added at:', dummyCube.position);

        // If a station is selected, extrude its 3D polygon.
        if (activeStation3D) {
          const polygonCoords = activeStation3D.geometry.coordinates[0]; // [[lng, lat], ...]
          const shape = new THREE.Shape();
          polygonCoords.forEach(([lng, lat]: [number, number], idx: number) => {
            // Convert lat/lng + altitude (200) to scene coordinates.
            const point = overlay.fromLatLngAltitude(new google.maps.LatLng(lat, lng), 200);
            if (idx === 0) {
              shape.moveTo(point.x, point.y);
            } else {
              shape.lineTo(point.x, point.y);
            }
          });
          const extrudeSettings: THREE.ExtrudeGeometryOptions = {
            depth: 500,
            bevelEnabled: false,
          };
          const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const mat = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            opacity: 0.6,
            transparent: true,
          });
          const mesh = new THREE.Mesh(geom, mat);
          scene.add(mesh);
          console.log('Extruded polygon added');
          // Optionally, add a light for the extrusion if not already present.
          const light = new THREE.DirectionalLight(0xffffff, 1);
          light.position.set(0, 1000, 1000);
          scene.add(light);
        }
      };

      // Request the overlay to redraw whenever the scene is updated.
      overlay.requestRedraw();
    },
    [stations, userLocation, activeStation3D]
  );

  /**
   * Hide overlay spinner after data loads.
   */
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  const hasError = stationsError || carsError || loadError;

  /**
   * Toggle sheet from Redux.
   */
  const handleSheetToggle = useCallback(() => {
    dispatch(toggleSheet());
  }, [dispatch]);

  /**
   * Helper: open a new sheet.
   */
  const openNewSheet = (newSheet: OpenSheetType) => {
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  /**
   * Helper: close the current sheet.
   */
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

  /**
   * "Locate Me"
   */
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

  /**
   * Toggle CarSheet.
   */
  const handleCarToggle = () => {
    if (openSheet === 'car') {
      closeCurrentSheet();
    } else {
      setActiveStation(null);
      setActiveStation3D(null);
      openNewSheet('car');
    }
  };

  /**
   * Decide icon for station marker.
   */
  const getStationIcon = (station: StationFeature) => {
    if (!markerIcons) return undefined;
    if (station.id === departureStationId) return markerIcons.departureStation;
    if (station.id === arrivalStationId) return markerIcons.arrivalStation;
    if (station.id === activeStation?.id) return markerIcons.activeStation;
    return markerIcons.station;
  };

  /**
   * On station marker click => set active => find matching 3D => open detail.
   */
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

  /**
   * From station list => set active => find matching 3D => open detail.
   */
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

  /**
   * Confirm departure => set step=3 => hide all.
   */
  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(3));
    setPreviousSheet('none');
    setOpenSheet('none');
    setActiveStation(null);
    setActiveStation3D(null);
    overlayRef.current?.requestRedraw();
  };

  /**
   * Clear station => revert.
   */
  const handleClearStationDetail = () => {
    closeCurrentSheet();
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {hasError ? (
        <div className="flex items-center justify-center w-full h-full bg-background text-destructive p-4">
          <div className="text-center space-y-2">
            <p className="font-medium">Error loading map data</p>
            <button onClick={() => window.location.reload()} className="text-sm underline hover:text-destructive/80">
              Try reloading
            </button>
          </div>
        </div>
      ) : overlayVisible ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Google Map */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={handleMapLoad}
            >
              {userLocation && markerIcons && (
                <Marker position={userLocation} icon={markerIcons.user} clickable={false} />
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
                <Marker key={car.id} position={{ lat: car.lat, lng: car.lng }} icon={markerIcons?.car} title={car.name} />
              ))}
            </GoogleMap>
          </div>

          {/* StationSelector flush with top header */}
          <StationSelector onAddressSearch={handleAddressSearch} />

          {/* "Locate Me" + "Car" buttons */}
          <div className="absolute top-[120px] left-4 z-30 flex flex-col space-y-2">
            <button onClick={handleLocateMe} className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow">
              <Locate className="w-5 h-5" />
            </button>
            <button onClick={handleCarToggle} className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow">
              <Car className="w-5 h-5" />
            </button>
          </div>

          {/* CarSheet */}
          {openSheet === 'car' && <CarSheet isOpen onToggle={handleCarToggle} />}

          {/* Nearby Stations List */}
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

          {/* Station Detail */}
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
