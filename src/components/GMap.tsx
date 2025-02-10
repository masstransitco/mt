
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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameIdRef = useRef<number>();

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
      sceneRef.current = scene;

      // Create the ThreeJSOverlayView with proper options.
      const overlay = new ThreeJSOverlayView({
        map,
        anchor: userLocation
          ? new google.maps.LatLng(userLocation.lat, userLocation.lng)
          : DEFAULT_CENTER,
        three: {
          camera: { fov: 45, near: 1, far: 2000 },
          scene: { background: null },
          renderer: { alpha: true, antialias: true, logarithmicDepthBuffer: true },
          contextAttributes: {
            antialias: true,
            preserveDrawingBuffer: false,
            alpha: true,
            stencil: true,
            depth: true,
            powerPreference: 'high-performance',
            premultipliedAlpha: false,
            xrCompatible: false,
          },
        },
      } as any);
      overlay.setMap(map);
      overlayRef.current = overlay;

      // onContextRestored: create our own camera and renderer.
      overlay.onContextRestored = ({ gl }) => {
        console.log('Overlay onContextRestored fired', {
          gl: gl ? 'WebGL context ready' : 'No WebGL context',
          canvas: gl?.canvas ? 'Canvas ready' : 'No canvas',
        });
        if (!gl) return;
        cameraRef.current = new THREE.PerspectiveCamera(
          45,
          gl.canvas.width / gl.canvas.height,
          1,
          3000
        );
        cameraRef.current.matrixAutoUpdate = false;
        const renderer = new THREE.WebGLRenderer({
          canvas: gl.canvas as HTMLCanvasElement,
          context: gl,
          ...gl.getContextAttributes(),
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.autoClear = false;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;
        console.log('Renderer and camera created:', {
          camera: cameraRef.current,
          renderer: rendererRef.current,
        });
      };

      // onDraw: update and render the scene.
      overlay.onDraw = ({ gl, transformer }) => {
        console.log('Overlay onDraw fired', {
          sceneChildren: sceneRef.current?.children.length || 0,
          cameraReady: !!cameraRef.current,
          rendererReady: !!rendererRef.current,
        });
        const camera = cameraRef.current;
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        if (!camera || !renderer || !scene) {
          console.warn('Missing required Three.js components');
          return;
        }

        // Clear the scene.
        while (scene.children.length > 0) {
          scene.remove(scene.children[0]);
        }

        // Re-add ambient and directional lights.
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(0, 1, 1);
        scene.add(directionalLight);

        // 1) Add a dummy cube.
        const cubeGeo = new THREE.BoxGeometry(50, 50, 50);
        const cubeMat = new THREE.MeshPhongMaterial({
          color: 0x00ff00,
          opacity: 0.8,
          transparent: true,
        });
        const cube = new THREE.Mesh(cubeGeo, cubeMat);
        const matrix = transformer.fromLatLngAltitude({
          lat: DEFAULT_CENTER.lat,
          lng: DEFAULT_CENTER.lng,
          altitude: 100,
        });
        cube.matrix.fromArray(matrix);
        cube.matrix.decompose(cube.position, cube.quaternion, cube.scale);
        scene.add(cube);
        console.log('Dummy cube added at:', cube.position.toArray());

        // 2) If an active station 3D feature is selected, add its extruded polygon.
        if (activeStation3D) {
          const coords = activeStation3D.geometry.coordinates[0];
          console.log('Active station 3D coords:', coords);
          const extrudedMesh = buildExtrudedPolygon(overlay, coords);
          if (extrudedMesh) {
            scene.add(extrudedMesh);
            console.log('Extruded polygon added');
          }
        }

        // Update the camera matrix using the map's current center.
        const center = map.getCenter();
        const latLngAlt = {
          lat: center ? center.lat() : 0,
          lng: center ? center.lng() : 0,
          altitude: 200,
        };
        const matArr = transformer.fromLatLngAltitude(latLngAlt);
        camera.matrix.fromArray(matArr);
        camera.updateMatrixWorld(true);

        renderer.render(scene, camera);
        renderer.resetState();
        console.log('Scene rendered');
      };

      // onAdd: start the animation loop.
      overlay.onAdd = () => {
        console.log('Overlay onAdd called, starting animation loop');
        const animate = () => {
          console.log('Animation frame requested');
          overlay.requestRedraw();
          animationFrameIdRef.current = requestAnimationFrame(animate);
        };
        animate();
      };
    },
    [stations, userLocation, activeStation3D]
  );

  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Cleanup effect for Three.js resources and animation loop.
  useEffect(() => {
    return () => {
      console.log('Cleaning up ThreeJS resources');
      if (animationFrameIdRef.current) {
        console.log('Cancelling animation frame', animationFrameIdRef.current);
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = undefined;
      }
      if (overlayRef.current) {
        (overlayRef.current as any).setMap(null);
        overlayRef.current = null;
      }
      if (rendererRef.current) {
        console.log('Disposing renderer');
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }
      if (sceneRef.current) {
        console.log('Clearing scene');
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
      cameraRef.current = null;
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
