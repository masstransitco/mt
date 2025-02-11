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
  clearDepartureStation,
  clearArrivalStation,
} from '@/store/userSlice';
import { toggleSheet, selectIsSheetMinimized } from '@/store/uiSlice';
import {
  selectBookingStep,
  advanceBookingStep,
  fetchRoute,
} from '@/store/bookingSlice';
import {
  fetchStations3D,
  selectStations3D,
} from '@/store/stations3DSlice';

// UI
import Sheet from '@/components/ui/sheet';
import StationSelector from './StationSelector';
import { LoadingSpinner } from './LoadingSpinner';
import CarSheet from '@/components/booking/CarSheet';
import StationDetail from './StationDetail';
import { StationListItem } from './StationListItem';

// Map config
import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
  DISPATCH_HUB,    // <-- Added import
  INTER_CC,        // <-- Added import
} from '@/constants/map';

interface GMapProps {
  googleApiKey: string;
}

type OpenSheetType = 'none' | 'car' | 'list' | 'detail';

export default function GMap({ googleApiKey }: GMapProps) {
  // Refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<ThreeJSOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const stationCubesRef = useRef<THREE.Mesh[]>([]);

  // Local UI states
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Which sheet is open?
  const [openSheet, setOpenSheet] = useState<OpenSheetType>('car');
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>('none');
  const [detailKey, setDetailKey] = useState(0);
  const [forceSheetOpen, setForceSheetOpen] = useState(false);

  // Redux
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const stations3D = useAppSelector(selectStations3D);

  const userLocation = useAppSelector(selectUserLocation);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);
  const bookingStep = useAppSelector(selectBookingStep);

  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleApiKey,
    version: 'beta',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Fetch stations, cars, 3D
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

  // Hide overlay once stations/cars are loaded
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Error check
  const hasError = stationsError || carsError || loadError;
  if (hasError) {
    return (
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
    );
  }

  // Auto-fetch route if departure & arrival
  useEffect(() => {
    if (departureStationId && arrivalStationId) {
      const departureStation = stations.find((s) => s.id === departureStationId);
      const arrivalStation = stations.find((s) => s.id === arrivalStationId);
      if (departureStation && arrivalStation) {
        dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
      }
    }
  }, [departureStationId, arrivalStationId, stations, dispatch]);

  // Sort stations
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

  // StationSelector => onAddressSearch
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

  // Clear station from StationSelector
  const handleClearDepartureInSelector = () => {
    dispatch(clearDepartureStation());
    dispatch(advanceBookingStep(1));
    toast.success('Departure station cleared');

    if (openSheet === 'detail') {
      setOpenSheet('none');
      setPreviousSheet('none');
    }
  };

  const handleClearArrivalInSelector = () => {
    dispatch(clearArrivalStation());
    dispatch(advanceBookingStep(3));
    toast.success('Arrival station cleared');

    if (openSheet === 'detail') {
      setOpenSheet('none');
      setPreviousSheet('none');
    }
  };

  // openNewSheet
  const openNewSheet = (newSheet: OpenSheetType) => {
    if (newSheet !== 'detail') {
      setForceSheetOpen(false);
    }
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  // closeCurrentSheet
  const closeCurrentSheet = () => {
    const old = openSheet;
    if (old === 'detail') {
      // If user closes detail in step 2 => forcibly unselect
      if (bookingStep === 2) {
        dispatch(clearDepartureStation());
        dispatch(advanceBookingStep(1));
        toast.success('Departure station unselected (sheet closed)');
      }
      setOpenSheet('none');
      setPreviousSheet('none');
      setForceSheetOpen(false);
      overlayRef.current?.requestRedraw();
    } else {
      setOpenSheet(previousSheet);
      setPreviousSheet('none');
    }
  };

  // "Locate me"
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

  // Station selection (marker or list)
  const handleStationClick = useCallback(
    (station: StationFeature) => {
      if (bookingStep < 3) {
        dispatch({ type: 'user/selectDepartureStation', payload: station.id });
      } else {
        dispatch({ type: 'user/selectArrivalStation', payload: station.id });
      }
      setDetailKey((prev) => prev + 1);

      // Force sheet to open
      setForceSheetOpen(true);
      setOpenSheet('detail');
      setPreviousSheet('none');

      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, bookingStep, isSheetMinimized]
  );

  const handleStationSelectedFromList = (station: StationFeature) => {
    if (bookingStep < 3) {
      dispatch({ type: 'user/selectDepartureStation', payload: station.id });
    } else {
      dispatch({ type: 'user/selectArrivalStation', payload: station.id });
    }
    setDetailKey((prev) => prev + 1);

    setForceSheetOpen(true);
    setOpenSheet('detail');
    setPreviousSheet('none');
  };

  // 3D overlay click logic
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

  // Confirm departure => step 2 -> step 3
  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(3));
    setOpenSheet('none');
    setPreviousSheet('none');
    setForceSheetOpen(false);
  };

  useEffect(() => {
    return () => {
      setForceSheetOpen(false);
    };
  }, []);

  // Setup map & 3D
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }

      const scene = new THREE.Scene();
      scene.background = null;
      sceneRef.current = scene;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
      directionalLight.position.set(0, 10, 50);
      scene.add(directionalLight);

      // Use DISPATCH_HUB instead of hongKongCenter
      const overlay = new ThreeJSOverlayView({
        map,
        scene,
        anchor: DISPATCH_HUB,
        // @ts-expect-error
        THREE,
      });
      overlayRef.current = overlay;

      // Renamed dummyCube -> dispatchCube
      const dispatchCubeGeo = new THREE.BoxGeometry(50, 50, 50);
      const dispatchCubeMat = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        opacity: 0.8,
        transparent: true,
      });
      const dispatchCube = new THREE.Mesh(dispatchCubeGeo, dispatchCubeMat);

      // Position the dispatchCube relative to DISPATCH_HUB
      const dispatchCubePos = overlay.latLngAltitudeToVector3({
        lat: DISPATCH_HUB.lat,
        lng: DISPATCH_HUB.lng,
        altitude: DISPATCH_HUB.altitude + 50,
      });
      dispatchCube.position.copy(dispatchCubePos);
      dispatchCube.scale.set(3, 3, 3);
      scene.add(dispatchCube);

      // Station cubes
      stations.forEach((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const stationCubePos = overlay.latLngAltitudeToVector3({
          lat,
          lng,
          altitude: DISPATCH_HUB.altitude + 50,
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

  // Clean up 3D on unmount
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

  // Marker icons
  const getStationIcon = (station: StationFeature) => {
    if (!markerIcons) return undefined;
    if (station.id === departureStationId) return markerIcons.departureStation;
    if (station.id === arrivalStationId) return markerIcons.arrivalStation;
    return markerIcons.station;
  };

  const selectedStationId =
    bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = selectedStationId
    ? stations.find((s) => s.id === selectedStationId)
    : null;

  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Main Google Map */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={mapOptions || {}}
          onLoad={handleMapLoad}
        >
          {/* User Location Marker */}
          {userLocation && markerIcons && (
            <Marker
              position={userLocation}
              icon={markerIcons.user}
              clickable={false}
            />
          )}

          {/* 
            We also render a special marker at the INTER_CC location
            using the new 'icc' icon from createMarkerIcons. 
          */}
          {markerIcons && (
            <Marker
              position={INTER_CC}
              icon={markerIcons.icc}
              title="ICC Marker"
            />
          )}

          {/* Station Markers */}
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

          {/* Car Markers */}
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

      {/* Station Selector Overlay */}
      <StationSelector
        onAddressSearch={handleAddressSearch}
        onClearDeparture={handleClearDepartureInSelector}
        onClearArrival={handleClearArrivalInSelector}
      />

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

      {/* Car Sheet */}
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
      {(openSheet === 'detail' || forceSheetOpen) && stationToShow && (
        <Sheet
          key={detailKey}
          isOpen
          onToggle={closeCurrentSheet}
          title="Station Details"
          count={(searchLocation ? sortedStations : stations).length}
        >
          <StationDetail
            key={detailKey}
            stations={searchLocation ? sortedStations : stations}
            activeStation={stationToShow}
            onConfirmDeparture={handleConfirmDeparture}
          />
        </Sheet>
      )}
    </div>
  );
}
