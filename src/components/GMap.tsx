"use client";

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  Suspense,
} from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import * as THREE from "three";
import dynamic from "next/dynamic";

// Redux & store hooks
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  fetchStations,
  selectStationsWithDistance,
  selectStationsLoading,
  selectStationsError,
  StationFeature,
} from "@/store/stationsSlice";
import {
  fetchCars,
  selectAllCars,
  selectCarsLoading,
  selectCarsError,
  selectScannedCar,
  setScannedCar,
} from "@/store/carSlice";
import { selectUserLocation, setUserLocation } from "@/store/userSlice";
import {
  selectBookingStep,
  advanceBookingStep,
  fetchRoute,
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation,
  selectArrivalStation,
  clearDepartureStation,
  clearArrivalStation,
  clearRoute,
  selectRouteDecoded,
} from "@/store/bookingSlice";
import {
  fetchDispatchDirections,
  clearDispatchRoute,
  selectDispatchRoute,
  selectDispatchRouteDecoded,
} from "@/store/dispatchSlice";

// UI Components
import Sheet, { SheetHandle } from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
import StationList from "./StationList";
import { StationListItem } from "./StationListItem";
import QrScannerOverlay from "@/components/ui/QrScannerOverlay";
import SignInModal from "@/components/ui/SignInModal";

// Custom components for sheet headers
import PickupTime from "@/components/ui/PickupTime";
import FareDisplay from "@/components/ui/FareDisplay";

// Map / 3D constants & hooks
import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
} from "@/constants/map";
import { useThreeOverlay } from "@/hooks/useThreeOverlay";
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps";
import { createVirtualStationFromCar } from "@/lib/stationUtils";

// Lazy‐load GaussianSplatModal
const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

type OpenSheetType = "none" | "list" | "detail";

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();

  // Local map & UI states
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Sheet states
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("none");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [isSheetMinimized, setIsSheetMinimized] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  
  // Sheet refs for programmatic control
  const detailSheetRef = useRef<SheetHandle>(null);
  const listSheetRef = useRef<SheetHandle>(null);

  // Track if we are mid-transition, to block UI updates
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

  // Google Maps script readiness
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  // QR code states
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [virtualStationId, setVirtualStationId] = useState<number | null>(null);
  const [isQrScanStation, setIsQrScanStation] = useState(false);

  // Optional modals
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // Redux states
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const userLocation = useAppSelector(selectUserLocation);
  const bookingStep = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const scannedCar = useAppSelector(selectScannedCar);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Decoded route from booking
  const decodedPath = useAppSelector(selectRouteDecoded);
  // Decoded dispatch route
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

  // For debouncing route fetch
  const routeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

  // Once loaded, ensure Maps is truly ready
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(async () => {
        try {
          await ensureGoogleMapsLoaded();
          setGoogleMapsReady(true);
        } catch (err) {
          console.error("Failed to ensure Google Maps is loaded:", err);
          toast.error("Map services unavailable. Please refresh the page.");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // 3D overlay
  const {
    overlayRef,
    stationIndexMapsRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
  } = useThreeOverlay(
    actualMap,
    stations,
    departureStationId,
    arrivalStationId,
    cars
  );

  // Keep booking step in a ref to read inside callbacks
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => {
    bookingStepRef.current = bookingStep;
  }, [bookingStep]);

  // When payment is successful and user moves to step 5, close any open sheet
  useEffect(() => {
    if (bookingStep === 5) {
      setOpenSheet("none");
      setPreviousSheet("none");
      setForceSheetOpen(false);
      setIsSheetMinimized(false);
    }
  }, [bookingStep]);

  // Sorting logic
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!googleMapsReady || !window.google?.maps?.geometry?.spherical) {
        return stationsToSort;
      }
      try {
        const newStations = [...stationsToSort];
        return newStations.sort((a, b) => {
          const [lngA, latA] = a.geometry.coordinates;
          const [lngB, latB] = b.geometry.coordinates;
          const distA =
            window.google.maps.geometry.spherical.computeDistanceBetween(
              new window.google.maps.LatLng(latA, lngA),
              new window.google.maps.LatLng(point.lat, point.lng)
            );
          const distB =
            window.google.maps.geometry.spherical.computeDistanceBetween(
              new window.google.maps.LatLng(latB, lngB),
              new window.google.maps.LatLng(point.lat, point.lng)
            );
          return distA - distB;
        });
      } catch (error) {
        console.error("Error sorting stations by distance:", error);
        return stationsToSort;
      }
    },
    [googleMapsReady]
  );

  // --------------------------------------------------------------------------------
  // Sheet Management
  // --------------------------------------------------------------------------------

  /**
   * closeSheet => a function returning a Promise, 
   * so we can "await" the sheet's closure in handleStationConfirm.
   */
  const closeSheet = useCallback(async () => {
    console.log("[Sheet] Fully closing sheet (with mock animation)");
    return new Promise<void>((resolve) => {
      // Hide the sheet states
      setOpenSheet("none");
      setPreviousSheet("none");
      setForceSheetOpen(false);
      setIsSheetMinimized(false);

      // Trigger a redraw if overlay needs it
      overlayRef.current?.requestRedraw();

      // Fake animation completion after 300ms
      setTimeout(() => {
        resolve();
      }, 300);
    });
  }, [overlayRef]);

  const minimizeSheet = useCallback(() => {
    console.log("[Sheet] Minimizing sheet");
    setIsSheetMinimized(true);
  }, []);

  const expandSheet = useCallback(() => {
    console.log("[Sheet] Expanding sheet");
    setIsSheetMinimized(false);
  }, []);

  const openNewSheet = useCallback(
    (newSheet: OpenSheetType) => {
      if (newSheet !== "detail") {
        setForceSheetOpen(false);
      }
      if (openSheet !== newSheet) {
        setPreviousSheet(openSheet);
        setOpenSheet(newSheet);
      }
      setIsSheetMinimized(false);
    },
    [openSheet]
  );

  // Process a virtual station and update stations array
  const processVirtualStation = useCallback((virtualStation: StationFeature, vStationId: number) => {
    // Insert or replace in station array
    const existingIndex = stations.findIndex((s) => s.id === vStationId);
    const updatedStations = [...stations];
    if (existingIndex >= 0) {
      updatedStations[existingIndex] = virtualStation;
    } else {
      updatedStations.push(virtualStation);
    }

    // Sort if we have userLocation
    if (userLocation) {
      const sorted = sortStationsByDistanceToPoint(userLocation, updatedStations);
      setSortedStations(sorted);
    } else {
      setSortedStations(updatedStations);
    }
  }, [stations, userLocation, sortStationsByDistanceToPoint]);

  // Open the detail sheet and pan map to location
  const openDetailSheet = useCallback(() => {
    setDetailKey(Date.now());
    setForceSheetOpen(true);
    setOpenSheet("detail");
    setIsSheetMinimized(false);

    if (actualMap && scannedCar) {
      actualMap.panTo({ lat: scannedCar.lat, lng: scannedCar.lng });
      actualMap.setZoom(16);
    }
  }, [actualMap, scannedCar]);

  // QR scan success => create a virtual station
  const handleQrScanSuccess = useCallback(() => {
    if (scannedCar) {
      console.log("QR Scan Success, scannedCar ID:", scannedCar.id);

      // Create virtual station ID and set state
      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);
      
      // Create and insert the virtual station
      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
      processVirtualStation(virtualStation, vStationId);
      
      // Open the detail sheet
      openDetailSheet();
      console.log("Sheet opening with virtual station:", vStationId);
    }
  }, [scannedCar, processVirtualStation, openDetailSheet]);
  
  // Use a ref to track if we've processed this specific car already
  const processedCarIdRef = useRef<number | null>(null);

  // If user scanned a car in step=2 => open detail automatically
  useEffect(() => {
    
    if (scannedCar && bookingStep === 2 && processedCarIdRef.current !== scannedCar.id) {
      console.log("Scanned car in step 2, setting up virtual station...");
      
      // Mark this car as processed to prevent repeated processing
      processedCarIdRef.current = scannedCar.id;
      
      // Create virtual station ID and set state
      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);
      
      // Create and insert the virtual station
      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
      processVirtualStation(virtualStation, vStationId);
      
      // Open the detail sheet after a brief delay
      const timer = setTimeout(() => {
        if (bookingStepRef.current === 2) {
          openDetailSheet();
          console.log("Detail sheet opened after short delay for scanned car.");
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [scannedCar?.id, bookingStep, processVirtualStation, openDetailSheet]);

  // Station selection logic
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      const stepNow = bookingStepRef.current;

      if (isQrScanStation && station.id !== virtualStationId && stepNow <= 2) {
        // Switch from QR-based station => normal station
        console.log("User switching from QR-based station => normal station");
        dispatch(clearDepartureStation());
        dispatch(setScannedCar(null));
        setIsQrScanStation(false);
        setVirtualStationId(null);
        dispatch(advanceBookingStep(1));
      }

      // Normal station selection
      if (stepNow === 1) {
        dispatch(selectDepartureStation(station.id));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (stepNow === 2) {
        dispatch(selectDepartureStation(station.id));
        toast.success("Departure station re-selected!");
      } else if (stepNow === 3) {
        dispatch(selectArrivalStation(station.id));
        dispatch(advanceBookingStep(4));
        toast.success("Arrival station selected!");
      } else if (stepNow === 4) {
        dispatch(selectArrivalStation(station.id));
        toast.success("Arrival station re-selected!");
      } else {
        toast(`Station tapped, but no action at step ${stepNow}`);
      }

      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setIsSheetMinimized(false);
      setPreviousSheet("none");
    },
    [dispatch, isQrScanStation, virtualStationId]
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      handleStationSelection(station);
    },
    [handleStationSelection]
  );

  // Raycast for station cubes => call handleStationSelection
  useEffect(() => {
    if (!actualMap || !overlayRef.current) return;

    const clickListener = actualMap.addListener("click", (ev: google.maps.MapMouseEvent) => {
      const overlayAny = overlayRef.current as any;
      if (!overlayAny?.raycast || !overlayAny?.camera) return;

      const domEvent = ev.domEvent;
      if (!domEvent || !(domEvent instanceof MouseEvent)) return;

      const mapDiv = actualMap.getDiv();
      const { left, top, width, height } = mapDiv.getBoundingClientRect();
      const mouseX = domEvent.clientX - left;
      const mouseY = domEvent.clientY - top;
      const mouseVec = new THREE.Vector2(
        (2 * mouseX) / width - 1,
        1 - (2 * mouseY) / height
      );

      const objectsToTest: THREE.Object3D[] = [];
      if (greyInstancedMeshRef.current) objectsToTest.push(greyInstancedMeshRef.current);
      if (blueInstancedMeshRef.current) objectsToTest.push(blueInstancedMeshRef.current);
      if (redInstancedMeshRef.current) objectsToTest.push(redInstancedMeshRef.current);

      const intersections = overlayAny.raycast(mouseVec, objectsToTest, {
        recursive: false,
      });

      if (intersections.length > 0) {
        const intersect = intersections[0];
        const meshHit = intersect.object as THREE.InstancedMesh;
        const instanceId = intersect.instanceId;
        if (instanceId != null) {
          let stationId: number | undefined;
          if (meshHit === greyInstancedMeshRef.current) {
            stationId = stationIndexMapsRef.current.grey[instanceId];
          } else if (meshHit === blueInstancedMeshRef.current) {
            stationId = stationIndexMapsRef.current.blue[instanceId];
          } else if (meshHit === redInstancedMeshRef.current) {
            stationId = stationIndexMapsRef.current.red[instanceId];
          }
          if (stationId !== undefined) {
            const stationClicked = stations.find((s) => s.id === stationId);
            if (stationClicked) {
              handleStationSelection(stationClicked);
              ev.stop();
            }
          }
        }
      }
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [
    actualMap,
    overlayRef,
    greyInstancedMeshRef,
    blueInstancedMeshRef,
    redInstancedMeshRef,
    stationIndexMapsRef,
    stations,
    handleStationSelection
  ]);

  // Load icons / map options
  useEffect(() => {
    if (isLoaded && googleMapsReady && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded, googleMapsReady]);

  // Fetch station/car data
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchCars()).unwrap(),
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load map data");
      }
    })();
  }, [dispatch]);

  // Once fully loaded, hide spinner
  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);

  /**
   * Debounced route fetch.
   * Only fires if departure and arrival are both selected.
   */
  useEffect(() => {
    if (!googleMapsReady) return;

    // Cancel any in-flight route fetch attempts
    if (routeFetchTimeoutRef.current) {
      clearTimeout(routeFetchTimeoutRef.current);
    }

    if (departureStationId && arrivalStationId) {
      routeFetchTimeoutRef.current = setTimeout(() => {
        const departureStation = stations.find((s) => s.id === departureStationId);
        const arrivalStation = stations.find((s) => s.id === arrivalStationId);

        if (departureStation && arrivalStation) {
          console.log("[TRANSITION-DEBUG] Fetching route between stations:", departureStationId, arrivalStationId);
          dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
        }
      }, 800);
    }

    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [departureStationId, arrivalStationId, stations, dispatch, googleMapsReady]);

  // Dispatch route logic
  useEffect(() => {
    if (!googleMapsReady) return;

    if (!departureStationId) {
      dispatch(clearDispatchRoute());
      return;
    }
    const depStation = stations.find((s) => s.id === departureStationId);
    if (depStation) {
      dispatch(fetchDispatchDirections(depStation));
    }
  }, [departureStationId, stations, dispatch, googleMapsReady]);

  // Handle address search
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!actualMap) return;
      actualMap.panTo(location);
      actualMap.setZoom(15);

      if (googleMapsReady) {
        const sorted = sortStationsByDistanceToPoint(location, stations);
        setSearchLocation(location);
        setSortedStations(sorted);
      } else {
        setSearchLocation(location);
        setSortedStations(stations);
      }

      if (openSheet !== "list") {
        setPreviousSheet(openSheet);
        setOpenSheet("list");
        setIsSheetMinimized(false);
      }
    },
    [
      actualMap,
      stations,
      openSheet,
      googleMapsReady,
      sortStationsByDistanceToPoint
    ]
  );

  /**
   * Updated handleStationConfirm for step=2:
   *  1) Wait for sheet to close (await closeSheet()).
   *  2) Then dispatch step=3.
   */
  const handleStationConfirm = useCallback(async () => {
    if (bookingStep === 2) {
      setIsStepTransitioning(true);
      console.log("[TRANSITION-DEBUG] Starting transition to step 3");

      await closeSheet();
      console.log("[TRANSITION-DEBUG] Sheet closed");

      requestAnimationFrame(() => {
        dispatch(advanceBookingStep(3));
        toast.success("Departure confirmed! Now choose your arrival station.");
        console.log("[TRANSITION-DEBUG] Step advanced to 3");

        setTimeout(() => {
          setIsStepTransitioning(false);
          console.log("[TRANSITION-DEBUG] Transition ended");
        }, 400);
      });
    }
  }, [bookingStep, dispatch, closeSheet]);

  // Clear station logic
  const handleClearDepartureInSelector = useCallback(() => {
    dispatch(clearDepartureStation());
    dispatch(advanceBookingStep(1));
    dispatch(clearDispatchRoute());

    // If we were in a QR station, reset
    if (isQrScanStation) {
      setIsQrScanStation(false);
      setVirtualStationId(null);
      dispatch(setScannedCar(null));
    }

    // Fully close sheet when clearing departure
    closeSheet();
    toast.success("Departure station cleared. (Back to selecting departure.)");
  }, [dispatch, isQrScanStation, closeSheet]);

  const handleClearArrivalInSelector = useCallback(() => {
    dispatch(clearArrivalStation());
    dispatch(advanceBookingStep(3));
    dispatch(clearRoute());

    // Fully close sheet when clearing arrival
    closeSheet();
    toast.success("Arrival station cleared. (Back to selecting arrival.)");
  }, [dispatch, closeSheet]);

  // Close detail sheet
  const handleStationDetailClose = useCallback(() => {
    // If it was a QR station, reset user to step=1 if we haven't locked in
    if (isQrScanStation) {
      console.log("Dismissing a QR-scanned station => clearing station + step=1");
      dispatch(clearDepartureStation());
      dispatch(setScannedCar(null));
      setIsQrScanStation(false);
      setVirtualStationId(null);

      closeSheet(); // Fully close for QR
      toast("Scan the car's QR code again if you want to select this vehicle", {
        duration: 4000,
        position: "bottom-center",
        icon: "ℹ️",
        style: { background: "#3b82f6", color: "#ffffff" },
      });
    } else {
      // For normal stations, also fully close
      console.log("Dismissing a normal station => FULL close (not minimize)");
      closeSheet();
    }
  }, [isQrScanStation, dispatch, closeSheet]);

  // QR scanner open
  const handleOpenQrScanner = useCallback(() => {
    closeSheet();
    setIsQrScannerOpen(true);
  }, [closeSheet]);

  // Geolocation
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }

    const loadingToast = toast.loading("Finding your location...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        dispatch(setUserLocation(loc));
        if (actualMap) {
          actualMap.panTo(loc);
          actualMap.setZoom(15);
        }

        toast.dismiss(loadingToast);

        if (googleMapsReady) {
          const sorted = sortStationsByDistanceToPoint(loc, stations);
          setSearchLocation(loc);
          setSortedStations(sorted);
        } else {
          setSearchLocation(loc);
          setSortedStations(stations);
        }

        openNewSheet("list");
        toast.success("Location found!");
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.dismiss(loadingToast);
        toast.error("Unable to retrieve location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [
    dispatch,
    actualMap,
    googleMapsReady,
    stations,
    sortStationsByDistanceToPoint,
    openNewSheet
  ]);

  // Sign In
  const handleOpenSignIn = useCallback(() => {
    setSignInModalOpen(true);
  }, []);

  // Any error?
  const hasError = stationsError || carsError || loadError;

  // Which station are we focusing on for detail sheet?
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;

  // Compute stationToShow
  let stationToShow: StationFeature | null = null;
  if (hasStationSelected && isQrScanStation && virtualStationId === hasStationSelected) {
    if (scannedCar && virtualStationId !== null) {
      stationToShow = createVirtualStationFromCar(scannedCar, virtualStationId);
    }
  } else {
    const stationsToSearch = sortedStations.length > 0 ? sortedStations : stations;
    stationToShow = stationsToSearch.find((s) => s.id === hasStationSelected) ?? null;
  }

  // For step 2, we need the pickup time range
  const dispatchRouteObj = useAppSelector(selectDispatchRoute);
  const getPickupTimeRange = useCallback(() => {
    const now = new Date();
    let startTime: Date, endTime: Date;
    if (dispatchRouteObj?.duration) {
      startTime = new Date(now.getTime() + dispatchRouteObj.duration * 1000);
      endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
    } else {
      startTime = new Date(now.getTime() + 5 * 60 * 1000);
      endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
    }
    return { startTime, endTime };
  }, [dispatchRouteObj]);

  // Custom Sheet Header Content for each step
  const renderSheetContent = useCallback(() => {
    if (bookingStep === 2) {
      const { startTime, endTime } = getPickupTimeRange();
      return <PickupTime startTime={startTime} endTime={endTime} />;
    } else if (bookingStep === 4) {
      return <FareDisplay baseFare={50.0} currency="HKD" perMinuteRate={1} />;
    }
    // Default: no custom header
    return null;
  }, [bookingStep, getPickupTimeRange]);

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {hasError && (
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
      )}

      {!hasError && overlayVisible && <LoadingSpinner />}

      {!hasError && !overlayVisible && (
        <>
          {/* Map container */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={(map: google.maps.Map) => {
                setActualMap(map);
              }}
            >
              {/* 3D overlay handled by useThreeOverlay */}
            </GoogleMap>
          </div>

          {/* Station Selector */}
          <StationSelector
            onAddressSearch={handleAddressSearch}
            onClearDeparture={handleClearDepartureInSelector}
            onClearArrival={handleClearArrivalInSelector}
            onLocateMe={handleLocateMe}
            onScan={handleOpenQrScanner}
            isQrScanStation={isQrScanStation}
            virtualStationId={virtualStationId}
            scannedCar={scannedCar}
          />

          {/* Station List Sheet */}
          <Sheet
            isOpen={openSheet === "list" && !isStepTransitioning}
            isMinimized={isSheetMinimized}
            onMinimize={minimizeSheet}
            onExpand={expandSheet}
            onDismiss={() => {
              closeSheet();
            }}
            title="Nearby Stations"
            count={sortedStations.length}
            ref={listSheetRef}
          >
            <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
              <StationList
                stations={sortedStations}
                height={350}
                showLegend={true}
                userLocation={userLocation}
                isVisible={!isSheetMinimized}
                onStationClick={handleStationSelectedFromList}
              />
            </div>
          </Sheet>

          {/* Station Detail Sheet with custom header content */}
          <Sheet
            key={detailKey}
            isOpen={(openSheet === "detail" || forceSheetOpen) && !!stationToShow && !isStepTransitioning}
            isMinimized={isSheetMinimized}
            onMinimize={minimizeSheet}
            onExpand={expandSheet}
            onDismiss={handleStationDetailClose}
            headerContent={renderSheetContent()}
            ref={detailSheetRef}
          >
            {stationToShow && (
              <StationDetail
                key={detailKey}
                stations={searchLocation ? sortedStations : stations}
                activeStation={stationToShow}
                onOpenSignIn={() => setSignInModalOpen(true)}
                onConfirmDeparture={handleStationConfirm}
                onDismiss={handleStationDetailClose}
                isQrScanStation={isQrScanStation}
                onClose={handleStationDetailClose}
                isMinimized={isSheetMinimized}
              />
            )}
          </Sheet>

          {/* QR Scanner Overlay */}
          <QrScannerOverlay
            isOpen={isQrScannerOpen}
            onClose={() => {
              setIsQrScannerOpen(false);
              // Restore the previous sheet if any
              if (previousSheet !== "none") {
                setOpenSheet(previousSheet);
                setIsSheetMinimized(false);
              }
            }}
            onScanSuccess={handleQrScanSuccess}
          />

          {/* Optional GaussianSplatModal */}
          <Suspense fallback={<div>Loading modal...</div>}>
            {isSplatModalOpen && (
              <GaussianSplatModal
                isOpen={isSplatModalOpen}
                onClose={() => setIsSplatModalOpen(false)}
              />
            )}
          </Suspense>
        </>
      )}

      {/* SignInModal */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </div>
  );
}
