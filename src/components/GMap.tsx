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
  addVirtualStation,
  removeStation,
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

  // --------------------------
  // Local map & UI states
  // --------------------------
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]); // purely for local sorting / UI
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Sheet states
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("none");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [isDetailSheetMinimized, setIsDetailSheetMinimized] = useState(false);
  const [isListSheetMinimized, setIsListSheetMinimized] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  const detailSheetRef = useRef<SheetHandle>(null);
  const listSheetRef = useRef<SheetHandle>(null);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

  // Google Maps script readiness
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  // QR code & virtual station states
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [virtualStationId, setVirtualStationId] = useState<number | null>(null);
  const [isQrScanStation, setIsQrScanStation] = useState(false);

  // Optional modals
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // --------------------------
  // Redux states
  // --------------------------
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

  // Decoded routes
  const decodedPath = useAppSelector(selectRouteDecoded);
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

  // For debouncing route fetch
  const routeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep booking step in a ref so effect callbacks can read it
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => {
    bookingStepRef.current = bookingStep;
  }, [bookingStep]);

  // If user completes step 5, close sheets
  useEffect(() => {
    if (bookingStep === 5) {
      setOpenSheet("none");
      setPreviousSheet("none");
      setForceSheetOpen(false);
      setIsDetailSheetMinimized(false);
      setIsListSheetMinimized(false);
    }
  }, [bookingStep]);

  // Load Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

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
  } = useThreeOverlay(actualMap, stations, departureStationId, arrivalStationId, cars);

  // --------------------------
  // Local sorted stations
  // --------------------------
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
          const distA = window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(latA, lngA),
            new window.google.maps.LatLng(point.lat, point.lng)
          );
          const distB = window.google.maps.geometry.spherical.computeDistanceBetween(
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

  // --------------------------
  // Data loading
  // --------------------------
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

  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);

  // --------------------------
  // Route fetching (debounced)
  // --------------------------
  useEffect(() => {
    if (!googleMapsReady) return;
    if (routeFetchTimeoutRef.current) {
      clearTimeout(routeFetchTimeoutRef.current);
    }
    if (departureStationId && arrivalStationId) {
      routeFetchTimeoutRef.current = setTimeout(() => {
        const departureStation = stations.find((s) => s.id === departureStationId);
        const arrivalStation = stations.find((s) => s.id === arrivalStationId);
        if (departureStation && arrivalStation) {
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

  // --------------------------
  // Dispatch route for pickup
  // --------------------------
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

  // --------------------------
  // Sheet / UI Management
  // --------------------------
  const closeSheet = useCallback(async () => {
    return new Promise<void>((resolve) => {
      setOpenSheet("none");
      setPreviousSheet("none");
      setForceSheetOpen(false);
      setIsDetailSheetMinimized(false);
      setIsListSheetMinimized(false);
      overlayRef.current?.requestRedraw();
      setTimeout(() => resolve(), 300);
    });
  }, [overlayRef]);

  const minimizeSheet = useCallback(() => {
    if (openSheet === "detail") {
      setIsDetailSheetMinimized(true);
    } else if (openSheet === "list") {
      setIsListSheetMinimized(true);
    }
  }, [openSheet]);

  const expandSheet = useCallback(() => {
    if (openSheet === "detail") {
      setIsDetailSheetMinimized(false);
    } else if (openSheet === "list") {
      setIsListSheetMinimized(false);
    }
  }, [openSheet]);

  const openNewSheet = useCallback(
    (newSheet: OpenSheetType) => {
      if (newSheet !== "detail") {
        setForceSheetOpen(false);
      }
      if (openSheet !== newSheet) {
        setPreviousSheet(openSheet);
        setOpenSheet(newSheet);
      }
      if (newSheet === "detail") {
        setIsDetailSheetMinimized(false);
      } else if (newSheet === "list") {
        setIsListSheetMinimized(false);
      }
    },
    [openSheet]
  );

  // --------------------------
  // QR / Virtual Station logic
  // --------------------------
  const processedCarIdRef = useRef<number | null>(null);

  const openDetailSheet = useCallback(() => {
    setDetailKey(Date.now());
    setForceSheetOpen(true);
    setOpenSheet("detail");
    setIsDetailSheetMinimized(false);
    if (actualMap && scannedCar) {
      // Optionally center map on the scanned car location
      actualMap.panTo({ lat: scannedCar.lat, lng: scannedCar.lng });
      actualMap.setZoom(16);
    }
  }, [actualMap, scannedCar]);

  const handleQrScanSuccess = useCallback(() => {
    if (scannedCar) {
      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);
      // Build & add the station to Redux
      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
      dispatch(addVirtualStation(virtualStation));
      // Then open its detail sheet
      openDetailSheet();
    }
  }, [scannedCar, dispatch, openDetailSheet]);

  // If user is in step 2 and we have a newly scanned car
  useEffect(() => {
    if (scannedCar && bookingStep === 2 && processedCarIdRef.current !== scannedCar.id) {
      processedCarIdRef.current = scannedCar.id;
      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);

      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
      dispatch(addVirtualStation(virtualStation));

      const timer = setTimeout(() => {
        if (bookingStepRef.current === 2) {
          openDetailSheet();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scannedCar, bookingStep, dispatch, openDetailSheet]);

  // --------------------------
  // Station selection logic
  // --------------------------
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      const stepNow = bookingStepRef.current;
      const isSwitchingFromQr = isQrScanStation && station.id !== virtualStationId && stepNow <= 2;

      // If user picks a different station while we had a QR station
      if (isSwitchingFromQr && virtualStationId) {
        dispatch(removeStation(virtualStationId));
        dispatch(clearDepartureStation());
        dispatch(setScannedCar(null));
        setIsQrScanStation(false);
        setVirtualStationId(null);
        processedCarIdRef.current = null; // reset so re-scanning works
        dispatch(advanceBookingStep(1));
      }

      // Normal step-based logic
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

      // Show the detail sheet
      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setIsDetailSheetMinimized(false);
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

  // 3D overlay click → station selection
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

      const intersections = overlayAny.raycast(mouseVec, objectsToTest, { recursive: false });
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

  // --------------------------
  // Map config once loaded
  // --------------------------
  useEffect(() => {
    if (isLoaded && googleMapsReady && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded, googleMapsReady]);

  // --------------------------
  // Handle location / search
  // --------------------------
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
        setIsListSheetMinimized(false);
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

  // --------------------------
// Clearing logic in StationSelector
// --------------------------
const handleClearDepartureInSelector = useCallback(() => {
  dispatch(clearDepartureStation());
  dispatch(advanceBookingStep(1));
  dispatch(clearDispatchRoute());

  // If we had a QR-based station for departure
  if (isQrScanStation && virtualStationId !== null) {
    dispatch(removeStation(virtualStationId));
    setIsQrScanStation(false);
    setVirtualStationId(null);
    dispatch(setScannedCar(null));
    processedCarIdRef.current = null; // allow re-scan
  }

  closeSheet();
  toast.success("Departure station cleared. (Back to selecting departure.)");
}, [dispatch, isQrScanStation, virtualStationId, closeSheet]);

const handleClearArrivalInSelector = useCallback(() => {
  dispatch(clearArrivalStation());
  dispatch(advanceBookingStep(3));
  dispatch(clearRoute());

  // DO NOT remove the scanned station here, since QR-based stations are always for departure

  closeSheet();
  toast.success("Arrival station cleared. (Back to selecting arrival.)");
}, [dispatch, closeSheet]);

  // --------------------------
  // StationDetail close/minimize
  // --------------------------
  const handleStationDetailClose = useCallback(() => {
    // Minimizes the detail sheet
    setIsDetailSheetMinimized(true);

    // If user scanned a car & is discarding it now
    if (isQrScanStation && virtualStationId !== null) {
      dispatch(removeStation(virtualStationId));
      dispatch(clearDepartureStation());
      dispatch(setScannedCar(null));
      setIsQrScanStation(false);
      setVirtualStationId(null);
      processedCarIdRef.current = null; // allow re-scan
      toast("Scan the car's QR code again if you want to select this vehicle", {
        duration: 4000,
        position: "bottom-center",
        icon: "ℹ️",
        style: { background: "#3b82f6", color: "#ffffff" },
      });
    }
  }, [isQrScanStation, virtualStationId, dispatch]);

  // --------------------------
  // QR Scanner
  // --------------------------
  const handleOpenQrScanner = useCallback(() => {
    closeSheet();
    setIsQrScannerOpen(true);
  }, [closeSheet]);

  // --------------------------
  // Sign-in modal
  // --------------------------
  const handleOpenSignIn = useCallback(() => {
    setSignInModalOpen(true);
  }, []);

  // --------------------------
  // Booking flow transitions
  // --------------------------
  const handleStationConfirm = useCallback(async () => {
    if (bookingStep === 2) {
      setIsStepTransitioning(true);
      await closeSheet();
      requestAnimationFrame(() => {
        dispatch(advanceBookingStep(3));
        toast.success("Departure confirmed! Now choose your arrival station.");
        setTimeout(() => setIsStepTransitioning(false), 400);
      });
    }
  }, [bookingStep, dispatch, closeSheet]);

  // --------------------------
  // Which station to show in detail
  // --------------------------
  const hasError = stationsError || carsError || loadError;
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;

  let stationToShow: StationFeature | null = null;
  if (hasStationSelected && isQrScanStation && virtualStationId === hasStationSelected) {
    stationToShow = stations.find((s) => s.id === virtualStationId) || null;
  } else {
    const stationsForDetail = sortedStations.length > 0 ? sortedStations : stations;
    stationToShow = stationsForDetail.find((s) => s.id === hasStationSelected) ?? null;
  }

  // --------------------------
  // Dispatch route info
  // --------------------------
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

  const renderSheetContent = useCallback(() => {
    if (bookingStep === 2) {
      const { startTime, endTime } = getPickupTimeRange();
      return <PickupTime startTime={startTime} endTime={endTime} />;
    } else if (bookingStep === 4) {
      return <FareDisplay baseFare={50.0} currency="HKD" perMinuteRate={1} />;
    }
    return null;
  }, [bookingStep, getPickupTimeRange]);

  // --------------------------
  // Render
  // --------------------------
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
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={(map: google.maps.Map) => setActualMap(map)}
            >
              {/* 3D overlay is handled by useThreeOverlay */}
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
            isMinimized={isListSheetMinimized}
            onMinimize={() => setIsListSheetMinimized(true)}
            onExpand={() => setIsListSheetMinimized(false)}
            onDismiss={() => setIsListSheetMinimized(true)}
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
                isVisible={!isListSheetMinimized}
                onStationClick={handleStationSelectedFromList}
              />
            </div>
          </Sheet>

          {/* Station Detail Sheet */}
          <Sheet
            key={detailKey}
            isOpen={
              (openSheet === "detail" || forceSheetOpen) &&
              !!stationToShow &&
              !isStepTransitioning
            }
            isMinimized={isDetailSheetMinimized}
            onMinimize={() => setIsDetailSheetMinimized(true)}
            onExpand={() => setIsDetailSheetMinimized(false)}
            onDismiss={handleStationDetailClose}
            headerContent={renderSheetContent()}
            ref={detailSheetRef}
          >
            {stationToShow && (
              <StationDetail
                key={detailKey}
                stations={searchLocation ? sortedStations : stations}
                activeStation={stationToShow}
                onOpenSignIn={handleOpenSignIn}
                onConfirmDeparture={handleStationConfirm}
                onDismiss={() => setIsDetailSheetMinimized(true)}
                isQrScanStation={isQrScanStation}
                onClose={handleStationDetailClose}
                isMinimized={isDetailSheetMinimized}
              />
            )}
          </Sheet>

          {/* QR Scanner Overlay */}
          <QrScannerOverlay
            isOpen={isQrScannerOpen}
            onClose={() => {
              setIsQrScannerOpen(false);
              if (previousSheet !== "none") {
                setOpenSheet(previousSheet);
                setIsDetailSheetMinimized(false);
              }
            }}
            onScanSuccess={handleQrScanSuccess}
          />

          {/* Gaussian Splat Modal (lazy-loaded) */}
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

      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </div>
  );
}
