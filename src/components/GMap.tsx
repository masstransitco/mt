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
  resetBookingFlow,
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
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
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
  const processedCarIdRef = useRef<number | null>(null);

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
  // Local station sorting
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
  const openDetailSheet = useCallback(() => {
    setDetailKey(Date.now());
    setForceSheetOpen(true);
    setOpenSheet("detail");
    setIsDetailSheetMinimized(false);

    // Optionally center on the scanned car
    if (actualMap && scannedCar) {
      actualMap.panTo({ lat: scannedCar.lat, lng: scannedCar.lng });
      actualMap.setZoom(16);
    }
  }, [actualMap, scannedCar]);

  /**
   * Called once a QR code is successfully scanned.
   * We forcibly reset everything and place user in step=2 with the new station as departure.
   */
  const handleQrScanSuccess = useCallback(() => {
    if (!scannedCar) {
      console.log("No scanned car found");
      return;
    }

    console.log("QR scan success, processing car:", scannedCar.id);

    // Clear old departure/arrival stations & routes
    dispatch(clearDepartureStation());
    dispatch(clearArrivalStation());
    dispatch(clearDispatchRoute());
    dispatch(clearRoute());

    // Create a "virtual station" for the scanned car
    const vStationId = 1000000 + scannedCar.id;
    const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);

    // Add the virtual station to Redux
    console.log("Adding virtual station:", vStationId);
    dispatch(addVirtualStation(virtualStation));

    // Select new station as the departure
    dispatch(selectDepartureStation(vStationId));
    
    // Update local state
    setVirtualStationId(vStationId);
    setIsQrScanStation(true);
    processedCarIdRef.current = scannedCar.id;

    // Force booking step=2 after state updates
    setTimeout(() => {
      dispatch(advanceBookingStep(2));
      // Immediately open detail for the new station
      openDetailSheet();
    }, 50);

  }, [scannedCar, dispatch, openDetailSheet]);

  // --------------------------
  // Station selection logic
  // --------------------------
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      // If user picks a different station while we had a QR station,
      // remove that old station from the store, but do NOT revert to step=1.
      if (
        isQrScanStation &&
        station.id !== virtualStationId &&
        virtualStationId
      ) {
        console.log("Different station selected, removing QR station:", virtualStationId);
        // Remove old "QR" station from the store
        dispatch(clearDepartureStation());
        processedCarIdRef.current = null;
      }

      // Normal step-based logic
      if (bookingStep === 1) {
        dispatch(selectDepartureStation(station.id));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (bookingStep === 2) {
        dispatch(selectDepartureStation(station.id));
        toast.success("Departure station re-selected!");
      } else if (bookingStep === 3) {
        dispatch(selectArrivalStation(station.id));
        dispatch(advanceBookingStep(4));
        toast.success("Arrival station selected!");
      } else if (bookingStep === 4) {
        dispatch(selectArrivalStation(station.id));
        toast.success("Arrival station re-selected!");
      } else {
        toast(`Station tapped, but no action at step ${bookingStep}`);
      }

      // Show the detail sheet
      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setIsDetailSheetMinimized(false);
      setPreviousSheet("none");
    },
    [
      dispatch,
      isQrScanStation,
      virtualStationId,
      bookingStep,
    ]
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => handleStationSelection(station),
    [handleStationSelection]
  );

  // 3D overlay → station selection
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

    // If we had a QR-based station
    if (isQrScanStation && virtualStationId !== null) {
      dispatch(removeStation(virtualStationId));
      setIsQrScanStation(false);
      setVirtualStationId(null);
      dispatch(setScannedCar(null));
      processedCarIdRef.current = null;
    }

    closeSheet();
    toast.success("Departure station cleared. (Back to selecting departure.)");
  }, [dispatch, isQrScanStation, virtualStationId, closeSheet]);

  const handleClearArrivalInSelector = useCallback(() => {
    dispatch(clearArrivalStation());
    dispatch(advanceBookingStep(3));
    dispatch(clearRoute());

    // Do not remove the scanned station here, since it's always the departure station

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
      processedCarIdRef.current = null;
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

  // Fixed with useCallback and proper dependencies
  const resetBookingFlowForQrScan = useCallback(() => {
    console.log("Resetting booking flow for QR scan");
    // Use dispatch(resetBookingFlow()) from the imported action
    dispatch(resetBookingFlow());
    
    // Clear all routes explicitly
    dispatch(clearDispatchRoute());
    dispatch(clearRoute());
    
    // Remove any existing virtual stations
    if (virtualStationId !== null) {
      console.log("Removing existing virtual station:", virtualStationId);
      dispatch(removeStation(virtualStationId));
    }
    
    // Reset local state
    setVirtualStationId(null);
    setIsQrScanStation(false);
    processedCarIdRef.current = null;
    
  }, [dispatch, virtualStationId]);

  // Fixed with proper dependency on resetBookingFlowForQrScan
  const handleOpenQrScanner = useCallback(() => {
    resetBookingFlowForQrScan();
    closeSheet();
    setIsQrScannerOpen(true);
  }, [closeSheet, resetBookingFlowForQrScan]);

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

  // Debug effect to log important state changes
  useEffect(() => {
    console.log("State changed - bookingStep:", bookingStep, "departureId:", departureStationId, "isQrScanStation:", isQrScanStation, "virtualStationId:", virtualStationId);
  }, [bookingStep, departureStationId, isQrScanStation, virtualStationId]);

  // --------------------------
  // Which station to show in detail?
  // --------------------------
  const hasError = stationsError || carsError || loadError;
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;

  // Log stations for debugging
  useEffect(() => {
    if (stations.length > 0 && virtualStationId) {
      const virtualStation = stations.find(s => s.id === virtualStationId);
      console.log("Virtual station exists:", !!virtualStation);
    }
  }, [stations, virtualStationId]);

  // Determine which station to show in detail
  let stationToShow: StationFeature | null = null;
  
  // Improved logic to find the correct station to show
  if (hasStationSelected) {
    if (isQrScanStation && virtualStationId === hasStationSelected) {
      // First check for virtual station directly  
      stationToShow = stations.find((s) => s.id === virtualStationId) || null;
      if (!stationToShow) {
        console.warn("Virtual station not found in stations list:", virtualStationId);
      }
    } else {
      // Normal station lookup
      const stationsForDetail = sortedStations.length > 0 ? sortedStations : stations;
      stationToShow = stationsForDetail.find((s) => s.id === hasStationSelected) ?? null;
      if (!stationToShow) {
        console.warn("Selected station not found:", hasStationSelected);
      }
    }
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

  // Extra debugging log before rendering
  useEffect(() => {
    const debugSheet = JSON.stringify({
      openSheet,
      forceSheetOpen,
      hasStationSelected,
      stationToShow: stationToShow?.id,
      isStepTransitioning,
      bookingStep,
      departureStationId,
      arrivalStationId,
      isQrScanStation,
      virtualStationId
    });
    console.log("Sheet debug:", debugSheet);
  }, [openSheet, forceSheetOpen, hasStationSelected, stationToShow, isStepTransitioning, 
      bookingStep, departureStationId, arrivalStationId, isQrScanStation, virtualStationId]);
  
  // Log when detail sheet conditions change
  useEffect(() => {
    const shouldShowDetail = (openSheet === "detail" || forceSheetOpen) && !!stationToShow && !isStepTransitioning;
    console.log("Detail sheet visibility:", shouldShowDetail, "Key:", detailKey);
  }, [openSheet, forceSheetOpen, stationToShow, isStepTransitioning, detailKey]);

  // --------------------------
  // Final setup of detail sheet
  // --------------------------
  
  // Force refresh detail sheet when QR scan station changes
  useEffect(() => {
    if (isQrScanStation && virtualStationId && departureStationId === virtualStationId) {
      // Ensure detail sheet opens with new key to force full remount
      setDetailKey(Date.now());
      setForceSheetOpen(true);
      setIsDetailSheetMinimized(false);
    }
  }, [isQrScanStation, virtualStationId, departureStationId]);
  
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
          {/* Display state for debugging (remove in production) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="absolute top-0 right-0 z-50 bg-black/70 text-white text-xs p-2 max-w-xs overflow-auto" style={{ fontSize: '10px' }}>
              Step: {bookingStep} ({isQrScanStation ? 'QR' : 'Normal'})<br />
              {virtualStationId && `vStation: ${virtualStationId}`}<br />
              {departureStationId && `depId: ${departureStationId}`}<br />
              {arrivalStationId && `arrId: ${arrivalStationId}`}<br />
              Sheet: {openSheet} {forceSheetOpen ? '(forced)' : ''}<br />
              {isStepTransitioning && 'Transitioning...'}
            </div>
          )}
          
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

          {/* Station Detail Sheet - with key for forcing remount */}
          <Sheet
            key={`detail-sheet-${detailKey}`}
            isOpen={(openSheet === "detail" || forceSheetOpen) && !!stationToShow && !isStepTransitioning}
            isMinimized={isDetailSheetMinimized}
            onMinimize={() => setIsDetailSheetMinimized(true)}
            onExpand={() => setIsDetailSheetMinimized(false)}
            onDismiss={handleStationDetailClose}
            headerContent={renderSheetContent()}
            ref={detailSheetRef}
          >
            {stationToShow && (
              <StationDetail
                key={`station-detail-${detailKey}`}
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

          {/* QR Scanner Overlay with proper props */}
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
            currentVirtualStationId={virtualStationId}
          />

          {/* Gaussian Splat Modal (lazy-loaded) */}
          <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
            <div className="bg-gray-800 p-4 rounded-lg">Loading modal...</div>
          </div>}>
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
