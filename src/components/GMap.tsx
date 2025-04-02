"use client";

import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  Suspense,
} from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import * as THREE from "three"; // Potential 3D usage
import ChevronDown from "@/components/ui/icons/ChevronDown";
import ChevronUp from "@/components/ui/icons/ChevronUp";

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
  selectIsQrScanStation,
  selectQrVirtualStationId,
  clearQrStationData,
  selectDepartureStation as selectDepartureStationAction,
  selectArrivalStation,
  clearArrivalStation,
  clearDepartureStation,
  clearRoute,
  resetBookingFlow,
} from "@/store/bookingSlice";

import {
  fetchDispatchDirections,
  clearDispatchRoute,
} from "@/store/dispatchSlice";

import { fetchStations3D } from "@/store/stations3DSlice";

import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
import StationList from "./StationList";
import QrScannerOverlay from "@/components/ui/QrScannerOverlay";
import SignInModal from "@/components/ui/SignInModal";
import PickupGuide from "@/components/ui/PickupGuide";

import { LIBRARIES, MAP_CONTAINER_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, MARKER_POST_MAX_ZOOM, createMapOptions } from "@/constants/map";
import { useThreeOverlay } from "@/hooks/useThreeOverlay";
import { useMarkerOverlay } from "@/hooks/useMarkerOverlay";
import {useCameraAnimationStable} from "@/hooks/useCameraAnimation"
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import CarPlate from "@/components/ui/CarPlate";
import PickupTime from "@/components/ui/PickupTime";
import FareDisplay from "@/components/ui/FareDisplay";

// Lazy-load GaussianSplatModal
const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

// The three modes for controlling the sheet body content
type SheetMode = "guide" | "list" | "detail";

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();

  // -------------------------
  // Redux States
  // -------------------------
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

  const isQrScanStation = useAppSelector(selectIsQrScanStation);
  const virtualStationId = useAppSelector(selectQrVirtualStationId);

  // -------------------------
  // Local UI & Map States
  // -------------------------
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false)

  // Single state for the sheet mode
  const [sheetMode, setSheetMode] = useState<SheetMode>("guide");
  const [sheetMinimized, setSheetMinimized] = useState(false);

  // For step transitions or animations (if you need them)
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

  // Google Maps readiness
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  // QR Scanner
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Additional optional modals
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // Timers
  const routeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedCarIdRef = useRef<number | null>(null);

  // Minimizing is blocked in steps 1 & 3 (or wherever else you want)
  const disableMinimize = false; // Always allow minimize

  // -------------------------
  // Load Google Maps script
  // -------------------------
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "alpha",
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

  useEffect(() => {
    if (googleMapsReady) {
      setMapOptions(createMapOptions());
    }
  }, [googleMapsReady]);

  // -------------------------
  // Fetch initial data
  // -------------------------
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchCars()).unwrap(),
          dispatch(fetchStations3D()).unwrap(), // building data
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load map data");
      }
    })();
  }, [dispatch]);

  // Hide spinner when loaded
  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);

  // -------------------------
  // Auto-switch sheetMode by bookingStep
  // -------------------------
  useEffect(() => {
    // For steps 1 or 3, show "guide" if we haven't forced other modes
    if (bookingStep === 1 || bookingStep === 3) {
      setSheetMode("guide");
      setSheetMinimized(false);
      return;
    }

    // For steps 2 or 4, typically want "detail" once a station is chosen
    if (bookingStep === 2 || bookingStep === 4) {
      // If we do not yet have a station chosen, remain in guide or handle as needed
      if (departureStationId || arrivalStationId) {
        setSheetMode("detail");
      } else {
        setSheetMode("guide");
      }
      setSheetMinimized(false);
    }
  }, [bookingStep, departureStationId, arrivalStationId]);

  // -------------------------
  // Debounced route fetching
  // -------------------------
  useEffect(() => {
    if (!googleMapsReady) return;
    if (routeFetchTimeoutRef.current) {
      clearTimeout(routeFetchTimeoutRef.current);
    }
    if (departureStationId && arrivalStationId) {
      routeFetchTimeoutRef.current = setTimeout(() => {
        const depSt = stations.find((s) => s.id === departureStationId);
        const arrSt = stations.find((s) => s.id === arrivalStationId);
        if (depSt && arrSt) {
          dispatch(fetchRoute({ departure: depSt, arrival: arrSt }));
        }
      }, 800);
    }
    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [departureStationId, arrivalStationId, stations, dispatch, googleMapsReady]);

  // Dispatch route for pickup
  useEffect(() => {
    if (!googleMapsReady) return;
    if (!departureStationId) {
      dispatch(clearDispatchRoute());
      return;
    }
    const depSt = stations.find((s) => s.id === departureStationId);
    if (depSt) {
      dispatch(fetchDispatchDirections(depSt));
    }
  }, [departureStationId, stations, dispatch, googleMapsReady]);

  // -------------------------
  // Sorting Stations
  // -------------------------
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!googleMapsReady || !window.google?.maps?.geometry?.spherical) {
        return stationsToSort;
      }
      try {
        const newStations = [...stationsToSort];
        newStations.sort((a, b) => {
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
        return newStations;
      } catch (error) {
        console.error("Error sorting stations by distance:", error);
        return stationsToSort;
      }
    },
    [googleMapsReady]
  );

  // -------------------------
  // One function for station selection
  // -------------------------
  const pickStationAsDeparture = useCallback(
    (stationId: number, viaScan = false) => {
      // If we had a prior QR-based station, remove it if it’s different
      if (isQrScanStation && virtualStationId && stationId !== virtualStationId) {
        dispatch(clearDepartureStation());
        dispatch(removeStation(virtualStationId));
        dispatch(clearQrStationData());
        processedCarIdRef.current = null;
      }

      // Step logic
      if (bookingStep === 1) {
        dispatch(selectDepartureStationAction(stationId));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (bookingStep === 2) {
        dispatch(selectDepartureStationAction(stationId));
        toast.success("Departure station re-selected!");
      } else if (bookingStep === 3) {
        dispatch(selectArrivalStation(stationId));
        dispatch(advanceBookingStep(4));
        toast.success("Arrival station selected!");
      } else if (bookingStep === 4) {
        dispatch(selectArrivalStation(stationId));
        toast.success("Arrival station re-selected!");
      } else {
        toast(`Station tapped, but no action at step ${bookingStep}`);
      }

      // Show station detail
      setSheetMode("detail");
      setSheetMinimized(false);
    },
    [
      bookingStep,
      isQrScanStation,
      virtualStationId,
      dispatch,
      removeStation,
      clearQrStationData,
      clearDepartureStation,
      selectDepartureStationAction,
      selectArrivalStation,
    ]
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      pickStationAsDeparture(station.id, false);
    },
    [pickStationAsDeparture]
  );

  // -------------------------
  // ThreeJs Overlay Hook
  // -------------------------
  const threeOverlayOptions = useMemo(
    () => ({
      onStationSelected: (stationId: number) => {
        pickStationAsDeparture(stationId, false);
      },
    }),
    [pickStationAsDeparture]
  );

  const { overlayRef } = useThreeOverlay(actualMap, stations, threeOverlayOptions);

// -------------------------
// Advanced Marker Overlay Hook
// -------------------------

// 1) Call the hook at the top level of your component
const { updateMarkerTilt, updateMarkerZoom } = useMarkerOverlay(actualMap, {
  onTiltChange: (tilt) => {
    // optional callback if needed
  },
  onZoomChange: (zoom) => {
    // optional callback if needed
  },
});

// -------------------------
// Camera Animation Hook
// -------------------------
const cameraControls = useCameraAnimationStable({
  map: actualMap,
  stations,
  overlayRef, // from useThreeOverlay
});

// ...
// Hook into tilt and zoom changes for marker animations
useEffect(() => {
  if (!actualMap) return;

  // We let Google handle the camera. But if we want
  // to dynamically update any markers' "post" size on tilt:
  const handleTiltChanged = () => {
    const newTilt = actualMap.getTilt?.() ?? 0;
    updateMarkerTilt(newTilt);
    // If you also want to re-render a 3D overlay:
    overlayRef.current?.requestRedraw();
  };

  // Similarly, for heading changes:
  const handleHeadingChanged = () => {
    overlayRef.current?.requestRedraw();
  };

  // Add zoom change handler
  const handleZoomChanged = () => {
    const newZoom = actualMap.getZoom?.() ?? DEFAULT_ZOOM;
    updateMarkerZoom(newZoom);
    // We may also want to redraw the overlay on zoom
    overlayRef.current?.requestRedraw();
  };

  // Attach events
  const tiltListener = google.maps.event.addListener(
    actualMap,
    "tilt_changed",
    handleTiltChanged
  );
  const headingListener = google.maps.event.addListener(
    actualMap,
    "heading_changed",
    handleHeadingChanged
  );
  const zoomListener = google.maps.event.addListener(
    actualMap,
    "zoom_changed",
    handleZoomChanged
  );

  // Initial reads
  handleTiltChanged();
  handleZoomChanged();

  return () => {
    google.maps.event.removeListener(tiltListener);
    google.maps.event.removeListener(headingListener);
    google.maps.event.removeListener(zoomListener);
  };
}, [actualMap, updateMarkerTilt, updateMarkerZoom, overlayRef]);


  // -------------------------
  // QR logic
  // -------------------------
  const resetBookingFlowForQrScan = useCallback(() => {
    dispatch(resetBookingFlow());
    dispatch(clearDispatchRoute());
    dispatch(clearRoute());

    if (virtualStationId !== null) {
      dispatch(removeStation(virtualStationId));
      dispatch(clearQrStationData());
    }
    dispatch(setScannedCar(null));
    processedCarIdRef.current = null;
  }, [dispatch, virtualStationId]);

  const handleOpenQrScanner = useCallback(() => {
    resetBookingFlowForQrScan();
    // Hide the sheet or switch mode if needed:
    // (You could switch to "guide" or something; for example, let's just keep it at "guide")
    setSheetMode("guide");
    setIsQrScannerOpen(true);
  }, [resetBookingFlowForQrScan]);

  const handleQrScanSuccess = useCallback(
    (car: Car) => {
      if (!car) return;
      console.log("handleQrScanSuccess with car ID:", car.id);

      dispatch(clearDepartureStation());
      dispatch(clearArrivalStation());
      dispatch(clearDispatchRoute());
      dispatch(clearRoute());

      const vStationId = Date.now();
      const virtualStation = createVirtualStationFromCar(car, vStationId);

      dispatch(addVirtualStation(virtualStation));
      dispatch(selectDepartureStationAction(vStationId));
      dispatch(advanceBookingStep(2));

      processedCarIdRef.current = car.id;
      setSheetMode("detail");
      setSheetMinimized(false);
      toast.success(`Car ${car.id} selected as departure`);
    },
    [dispatch]
  );

  // -------------------------
  // Confirm logic for detail
  // -------------------------
  const handleStationConfirm = useCallback(() => {
    // For example: if step 2 is confirmed, move on to step 3
    if (bookingStep === 2) {
      dispatch(advanceBookingStep(3));
      toast.success("Departure confirmed! Now choose your arrival station.");
    }
  }, [bookingStep, dispatch]);

  // Which station are we showing in detail?
  let hasStationSelected: number | null = null;
  if (bookingStep < 3) {
    hasStationSelected = departureStationId || null;
  } else {
    hasStationSelected = arrivalStationId || null;
  }

  let stationToShow: StationFeature | null = null;
  if (hasStationSelected) {
    // If it’s a QR-based virtual station
    if (isQrScanStation && virtualStationId === hasStationSelected) {
      stationToShow = stations.find((s) => s.id === virtualStationId) || null;
    } else {
      const stationsForDetail = sortedStations.length > 0 ? sortedStations : stations;
      stationToShow = stationsForDetail.find((s) => s.id === hasStationSelected) || null;
    }
  }

  const hasError = stationsError || carsError || loadError;

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
          {process.env.NODE_ENV === "development" && (
            <div
              className="absolute top-0 right-0 z-50 bg-black/70 text-white text-xs p-2 max-w-xs overflow-auto"
              style={{ fontSize: "10px" }}
            >
              Step: {bookingStep} ({isQrScanStation ? "QR" : "Normal"})<br />
              {virtualStationId && `vStation: ${virtualStationId}`}<br />
              {departureStationId && `depId: ${departureStationId}`}<br />
              {arrivalStationId && `arrId: ${arrivalStationId}`}<br />
              sheetMode: {sheetMode} {sheetMinimized ? "(minimized)" : ""}<br />
              {isStepTransitioning && "Transitioning..."}
            </div>
          )}

          {/* Main map container */}
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={(map: google.maps.Map) => setActualMap(map)}
            >
              {/* 3D overlay from useThreeOverlay */}
            </GoogleMap>
          </div>

          {/* Station selector (top bar) */}
          <StationSelector
            onAddressSearch={(loc) => {
              setSearchLocation(loc);
              if (googleMapsReady) {
                const sorted = sortStationsByDistanceToPoint(loc, stations);
                setSortedStations(sorted);
              } else {
                setSortedStations(stations);
              }
              // If in step 1, 3, or 4, switch to "list" to show station results
              if (bookingStep === 1 || bookingStep === 3 || bookingStep === 4) {
                setSheetMode("list");
                setSheetMinimized(false);
              }
            }}
            onClearDeparture={() => {
              dispatch(clearDepartureStation());
              dispatch(advanceBookingStep(1));
              setSheetMinimized(false);
              dispatch(clearDispatchRoute());
              if (isQrScanStation && virtualStationId !== null) {
                dispatch(removeStation(virtualStationId));
                dispatch(clearQrStationData());
                dispatch(setScannedCar(null));
                processedCarIdRef.current = null;
              }
              toast.success("Departure station cleared. Back to picking departure.");
            }}
            onClearArrival={() => {
              dispatch(clearArrivalStation());
              dispatch(advanceBookingStep(3));
              setSheetMinimized(false);
              dispatch(clearRoute());
              toast.success("Arrival station cleared. Back to picking arrival.");
            }}
            onScan={handleOpenQrScanner}
            isQrScanStation={isQrScanStation}
            virtualStationId={virtualStationId}
            scannedCar={scannedCar}
          />

          
{/* Unified Sheet - always "open," content depends on sheetMode */}
<Sheet
  isOpen={true}
  isMinimized={sheetMinimized}
  onMinimize={() => setSheetMinimized(true)}
  onExpand={() => setSheetMinimized(false)}
  onDismiss={() => setSheetMinimized(true)}
  disableMinimize={disableMinimize}
  headerContent={
    <div className="flex items-center w-full justify-between">
      {/* A simple dynamic title for clarity */}
      <h2 className="text-sm text-gray-400 font-medium">
        {sheetMode === "guide" && (bookingStep === 1 || bookingStep === 3)
          ? "Start"
          : sheetMode === "list"
          ? "Nearby"
          : sheetMode === "detail"
          ? "Pickup"
          : "Sheet"}
      </h2>

      {/* Minimizer icons */}
      {sheetMinimized ? (
        <button
          type="button"
          className="p-1 text-gray-400 hover:text-gray-200"
          onClick={() => {
            if (!disableMinimize) setSheetMinimized(false)
          }}
        >
          <ChevronUp width={20} height={20} />
        </button>
      ) : (
        <button
          type="button"
          className="p-1 text-gray-400 hover:text-gray-200"
          onClick={() => {
            if (!disableMinimize) setSheetMinimized(true)
          }}
        >
          <ChevronDown width={20} height={20} />
        </button>
      )}
    </div>
  }
>
  {/* Sheet body content depends on sheetMode */}
  {sheetMode === "guide" && (
    <>
      {/* Example: if step 1 => departing, if step 3 => returning */}
      {bookingStep === 1 && <PickupGuide isDepartureFlow />}
      {bookingStep === 3 && (
        <PickupGuide
          isDepartureFlow={false}
          primaryText="Choose dropoff station"
          secondaryText="Return to any station"
          primaryDescription="Select destination on map"
          secondaryDescription="All stations accept returns"
        />
      )}

      {/* For demonstration, here's a few extra step-specific items you might show: */}
      {bookingStep === 2 && (
        <PickupTime
          startTime={new Date(Date.now() + 5 * 60000)}
          endTime={new Date(Date.now() + 20 * 60000)}
        />
      )}
      {bookingStep === 4 && <FareDisplay baseFare={50} currency="HKD" perMinuteRate={1} />}
    </>
  )}

  {sheetMode === "list" && (
    <div className="space-y-2 px-4 py-2">
      <StationList
        stations={sortedStations}
        userLocation={userLocation}
        onStationClick={handleStationSelectedFromList}
        className="space-y-2"
      />
    </div>
  )}

  {sheetMode === "detail" && stationToShow && (
    <StationDetail
      activeStation={stationToShow}
      showCarGrid={bookingStep === 2}
      onConfirm={handleStationConfirm}
      isVirtualCarLocation={isQrScanStation}
      scannedCar={scannedCar}
      confirmLabel="Confirm"


      isSignedIn={isSignedIn}
      onOpenSignInModal={() => setSignInModalOpen(true)}
    />
  )}

  {/* If stationToShow is null but mode is detail, you could show a fallback */}
  {sheetMode === "detail" && !stationToShow && (
    <div className="p-4 text-sm text-gray-400">
      No station selected yet.
    </div>
  )}
</Sheet>

{/* QR Scanner Overlay */}
<QrScannerOverlay
  isOpen={isQrScannerOpen}
  onClose={() => setIsQrScannerOpen(false)}
  onScanSuccess={(car) => handleQrScanSuccess(car)}
  currentVirtualStationId={virtualStationId}
/>

{/* Gaussian Splat Modal */}
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

{/* Sign-In Modal */}
<SignInModal
  isOpen={signInModalOpen}
  onClose={() => setSignInModalOpen(false)}
/>
        </>
      )}
    </div>
  );
}