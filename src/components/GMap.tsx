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
import dynamic from "next/dynamic";

// Three.js not directly used here, but left in case needed for local logic
import * as THREE from "three";

// Redux & store hooks
import type { Car } from "@/types/cars";
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
  selectIsQrScanStation,
  selectQrVirtualStationId,
  clearQrStationData,
  selectDepartureStation as selectDepartureStationAction,
} from "@/store/bookingSlice";

import {
  fetchDispatchDirections,
  clearDispatchRoute,
  selectDispatchRoute,
  selectDispatchRouteDecoded,
} from "@/store/dispatchSlice";

// 3D buildings from Redux
import { fetchStations3D } from "@/store/stations3DSlice";

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
import PickupGuide from "@/components/ui/PickupGuide";
import StationsDisplay from "@/components/ui/StationsDisplay";
import CarPlate from "@/components/ui/CarPlate";

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
  const [isThreeOverlaySelection, setIsThreeOverlaySelection] = useState(false);


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

  // QR scanner overlay open/closed
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

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

  // Possibly QR-based "virtual station" references
  const isQrScanStation = useAppSelector(selectIsQrScanStation);
  const virtualStationId = useAppSelector(selectQrVirtualStationId);

  // Decoded routes
  const decodedPath = useAppSelector(selectRouteDecoded);
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

  // For debouncing route fetch
  const routeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedCarIdRef = useRef<number | null>(null);

  // Flag to track whether the detail sheet should be automatically opened
  const shouldOpenDetailSheetRef = useRef(false);

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

  // Once script is loaded, confirm Maps is fully ready
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

   // --------------------------
  // Station selection logic
  // --------------------------
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      // If user picks a different station while a QR station is active
      if (isQrScanStation && virtualStationId && station.id !== virtualStationId) {
        console.log("Different station selected, removing QR station:", virtualStationId);
        dispatch(clearDepartureStation());
        dispatch(removeStation(virtualStationId));
        dispatch(clearQrStationData());
        processedCarIdRef.current = null;
      }

      if (bookingStep === 1) {
        dispatch(selectDepartureStationAction(station.id));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (bookingStep === 2) {
        dispatch(selectDepartureStationAction(station.id));
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

      // Trigger detail sheet
      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setIsDetailSheetMinimized(false);
      setPreviousSheet("none");
    },
    [dispatch, isQrScanStation, virtualStationId, bookingStep]
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => handleStationSelection(station),
    [handleStationSelection]
  );

  // Handle selection from Three.js overlay
const handleThreeOverlayStationSelected = useCallback((stationId: number) => {
  console.log("[GMap] ThreeOverlay selected station:", stationId);
  
  // Find the station to confirm it exists
  const selectedStation = stations.find(s => s.id === stationId);
  
  if (selectedStation) {
    console.log("[GMap] Found matching station for 3D selection:", selectedStation);
    
    // Set 3D-specific state
    setIsThreeOverlaySelection(true);
    
    // Reuse the common station selection logic
    handleStationSelection(selectedStation);
    
    // Additional 3D-specific behavior - center map on selected station
    if (actualMap) {
      const [lng, lat] = selectedStation.geometry.coordinates;
      actualMap.panTo({ lat, lng });
      actualMap.setZoom(16);
    }
    
    // Set flag to ensure detail sheet opens (if needed)
    shouldOpenDetailSheetRef.current = true;
  } else {
    console.error("[GMap] Station not found for id:", stationId);
    toast.error("Unable to select station. Please try again.");
  }
}, [stations, actualMap, handleStationSelection]);

// The overlay that handles 3D polygons & station cylinders (with raycasting)
const { overlayRef } = useThreeOverlay(actualMap, stations, {
  onStationSelected: handleThreeOverlayStationSelected
});

// Log station data for debugging
useEffect(() => {
  if (stations.length > 0) {
    console.log("[GMap] Station data loaded. First few stations:");
    stations.slice(0, 5).forEach(station => {
      console.log(`Station ${station.id}: ObjectId=${station.properties.ObjectId}, Coords=[${station.geometry.coordinates}]`);
    });
  }
}, [stations]);

// Effect to handle building selections from ThreeOverlay
// Note: Most of this is now handled directly in the callback for better synchronization
useEffect(() => {
  if (shouldOpenDetailSheetRef.current && 
     ((bookingStep === 2 && departureStationId) || 
      (bookingStep === 4 && arrivalStationId))) {
    console.log("[GMap] Opening detail sheet after ThreeOverlay selection");
    
    // Reset the flag - we handle the actual opening in the callback now
    shouldOpenDetailSheetRef.current = false;
  }
}, [departureStationId, arrivalStationId, bookingStep, isThreeOverlaySelection]);

  // --------------------------
  // Data loading
  // --------------------------
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchCars()).unwrap(),
          dispatch(fetchStations3D()).unwrap(), // We'll fetch building data as well
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load map data");
      }
    })();
  }, [dispatch]);

  // Once data is loaded, hide the overlay spinner
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

      // Force redraw if needed
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

  const handleQrScanSuccess = useCallback(
    (car: Car) => {
      if (!car) {
        console.log("No scanned car from overlay");
        return;
      }

      console.log("handleQrScanSuccess with car ID:", car.id);

      // Clear old departure/arrival stations & routes
      dispatch(clearDepartureStation());
      dispatch(clearArrivalStation());
      dispatch(clearDispatchRoute());
      dispatch(clearRoute());

      // Create a "virtual station" for the scanned car
      const vStationId = Date.now();
      const virtualStation = createVirtualStationFromCar(car, vStationId);

      dispatch(addVirtualStation(virtualStation));
      dispatch(selectDepartureStationAction(vStationId));
      dispatch(advanceBookingStep(2));

      processedCarIdRef.current = car.id;

      openDetailSheet();
      toast.success(`Car ${car.id} selected as departure`);
    },
    [dispatch, openDetailSheet]
  );
  
 

  // --------------------------
  // Map config once loaded
  // --------------------------
  useEffect(() => {
    if (isLoaded && googleMapsReady && window.google) {
      setMapOptions((prev) => ({
        ...prev,
        ...createMapOptions(),
        tilt: 67.5,
        heading: 45,
      }));
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
      dispatch(clearQrStationData());
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

    closeSheet();
    toast.success("Arrival station cleared. (Back to selecting arrival.)");
  }, [dispatch, closeSheet]);

  // --------------------------
  // StationDetail close/minimize
  // --------------------------
  const handleStationDetailClose = useCallback(() => {
    // ONLY minimize the sheet, don't clear any route data
    setIsDetailSheetMinimized(true);
    
    // Force the Three.js overlay to redraw to ensure route remains visible
    if (overlayRef.current) {
      overlayRef.current.requestRedraw();
    }
  }, []);


  // --------------------------
  // QR Scanner
  // --------------------------
  const resetBookingFlowForQrScan = useCallback(() => {
    console.log("Resetting booking flow for QR scan");
    dispatch(resetBookingFlow());
    dispatch(clearDispatchRoute());
    dispatch(clearRoute());

    if (virtualStationId !== null) {
      console.log("Removing existing virtual station:", virtualStationId);
      dispatch(removeStation(virtualStationId));
      dispatch(clearQrStationData());
    }
    dispatch(setScannedCar(null));
    processedCarIdRef.current = null;
  }, [dispatch, virtualStationId]);

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
    console.log(
      "State changed - bookingStep:",
      bookingStep,
      "departureId:",
      departureStationId,
      "isQrScanStation:",
      isQrScanStation,
      "virtualStationId:",
      virtualStationId,
      "isThreeOverlaySelection:",
      isThreeOverlaySelection
    );
  }, [bookingStep, departureStationId, isQrScanStation, virtualStationId, isThreeOverlaySelection]);

  // --------------------------
  // Determine which station to show in detail
  // --------------------------
  const hasError = stationsError || carsError || loadError;
  const hasStationSelected =
    bookingStep < 3
      ? typeof departureStationId === "number"
        ? departureStationId
        : null
      : typeof arrivalStationId === "number"
      ? arrivalStationId
      : null;

  useEffect(() => {
    if (stations.length > 0 && virtualStationId) {
      const virtualStation = stations.find((s) => s.id === virtualStationId);
      console.log("Virtual station exists:", !!virtualStation);
    }
  }, [stations, virtualStationId]);

  let stationToShow: StationFeature | null = null;
  if (hasStationSelected) {
    if (isQrScanStation && virtualStationId === hasStationSelected) {
      stationToShow = stations.find((s) => s.id === virtualStationId) || null;
      if (!stationToShow) {
        console.warn("Virtual station not found in stations list:", virtualStationId);
      }
    } else {
      // Normal station
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
    // Special case for QR-scanned car
    if (isQrScanStation && scannedCar && bookingStep === 2) {
      return (
        <CarPlate
          plateNumber={scannedCar.name}
          vehicleModel={scannedCar.model || "Electric Vehicle"}
        />
      );
    }

    if (bookingStep === 1) {
      return <PickupGuide isDepartureFlow={true} />;
    } else if (bookingStep === 2) {
      const { startTime, endTime } = getPickupTimeRange();
      return <PickupTime startTime={startTime} endTime={endTime} />;
    } else if (bookingStep === 3) {
      return (
        <PickupGuide
          isDepartureFlow={false}
          primaryText="Choose dropoff station"
          secondaryText="Return to any station"
          primaryDescription="Select destination on map"
          secondaryDescription="All stations accept returns"
        />
      );
    } else if (bookingStep === 4) {
      return <FareDisplay baseFare={50.0} currency="HKD" perMinuteRate={1} />;
    }
    return null;
  }, [bookingStep, getPickupTimeRange, isQrScanStation, scannedCar]);

  // Debug logs
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
      virtualStationId,
      isThreeOverlaySelection,
    });
    console.log("Sheet debug:", debugSheet);
  }, [
    openSheet,
    forceSheetOpen,
    stationToShow,
    isStepTransitioning,
    bookingStep,
    departureStationId,
    arrivalStationId,
    isQrScanStation,
    virtualStationId,
    isThreeOverlaySelection,
    hasStationSelected,
  ]);

  useEffect(() => {
    const shouldShowDetail =
      (openSheet === "detail" || forceSheetOpen) &&
      !!stationToShow &&
      !isStepTransitioning;
    console.log("Detail sheet visibility:", shouldShowDetail, "Key:", detailKey);
  }, [openSheet, forceSheetOpen, stationToShow, isStepTransitioning, detailKey]);

  // Force the detail sheet to open if the departure station is a new QR-based station
  useEffect(() => {
    if (isQrScanStation && virtualStationId && departureStationId === virtualStationId) {
      setDetailKey(Date.now());
      setForceSheetOpen(true);
      setIsDetailSheetMinimized(false);
    }
  }, [isQrScanStation, virtualStationId, departureStationId]);

  // --------------------------
  // Render
  // --------------------------
  return (
    <div className="relative w-full h-[calc(100dvh)]">
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
          {/* Debug overlay (remove in production) */}
          {process.env.NODE_ENV === "development" && (
            <div
              className="absolute top-0 right-0 z-50 bg-black/70 text-white text-xs p-2 max-w-xs overflow-auto"
              style={{ fontSize: "10px" }}
            >
              Step: {bookingStep} ({isQrScanStation ? "QR" : "Normal"})
              <br />
              {virtualStationId && `vStation: ${virtualStationId}`}
              <br />
              {departureStationId && `depId: ${departureStationId}`}
              <br />
              {arrivalStationId && `arrId: ${arrivalStationId}`}
              <br />
              Sheet: {openSheet} {forceSheetOpen ? "(forced)" : ""}
              <br />
              {isThreeOverlaySelection && "3D overlay selection active"}
              <br />
              {isStepTransitioning && "Transitioning..."}
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
         
          <div className="stations-selector"></div>
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
          {openSheet === "list" && !isStepTransitioning && (
            <Sheet
              isOpen={true}
              isMinimized={isListSheetMinimized}
              onMinimize={() => setIsListSheetMinimized(true)}
              onExpand={() => setIsListSheetMinimized(false)}
              onDismiss={() => setIsListSheetMinimized(true)}
              headerContent={
                <StationsDisplay
                  stationsCount={sortedStations.length}
                  totalStations={stations.length}
                />
              }
              highPriority={true}
              ref={listSheetRef}
            >
              <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
                <StationList
                  stations={sortedStations}
                  height={350}
                  showLegend={true}
                  hideStationCount={true}
                  userLocation={userLocation}
                  isVisible={!isListSheetMinimized}
                  onStationClick={handleStationSelectedFromList}
                />
              </div>
            </Sheet>
          )}

          {/* Station Detail Sheet */}
          <Sheet
            isOpen={(openSheet === "detail" || forceSheetOpen) && !isStepTransitioning}
            isMinimized={isDetailSheetMinimized}
            onMinimize={() => setIsDetailSheetMinimized(true)}
            onExpand={() => setIsDetailSheetMinimized(false)}
            onDismiss={handleStationDetailClose}
            headerContent={renderSheetContent()}
            ref={detailSheetRef}
          >
            <StationDetail
              stations={searchLocation ? sortedStations : stations}
              activeStation={stationToShow}
              onOpenSignIn={handleOpenSignIn}
              onConfirmDeparture={handleStationConfirm}
              onDismiss={() => setIsDetailSheetMinimized(true)}
              isQrScanStation={isQrScanStation}
              onClose={handleStationDetailClose}
              isMinimized={isDetailSheetMinimized}
            />
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
            onScanSuccess={(car) => handleQrScanSuccess(car)}
            currentVirtualStationId={virtualStationId}
          />

          {/* Gaussian Splat Modal (lazy-loaded) */}
          <Suspense
            fallback={
              <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                <div className="bg-gray-800 p-4 rounded-lg">Loading modal...</div>
              </div>
            }
          >
            {isSplatModalOpen && (
              <GaussianSplatModal
                isOpen={isSplatModalOpen}
                onClose={() => setIsSplatModalOpen(false)}
              />
            )}
          </Suspense>
        </>
      )}

      {/* Sign-In Modal */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </div>
  );
}
