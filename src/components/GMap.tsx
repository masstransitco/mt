"use client";

import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  Suspense,
} from "react";
import { GoogleMap } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import * as THREE from "three"; // Potential 3D usage
import { shallowEqual } from "react-redux";
import { useGoogleMaps } from "@/providers/GoogleMapsProvider";
import { throttle } from "lodash";
import ChevronDown from "@/components/ui/icons/ChevronDown";
import ChevronUp from "@/components/ui/icons/ChevronUp";
import { CameraStateObserver } from "@/components/CameraStateObserver";

import type { Car } from "@/types/cars";
import type { SheetMode } from "@/types/map";
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

import { 
  selectUserLocation, 
  setUserLocation, 
  setSearchLocation,
  selectSearchLocation,
  selectWalkingRoute
} from "@/store/userSlice";

import {
  selectBookingStep,
  advanceBookingStep,
  fetchRoute,
  selectDepartureStationId,
  selectArrivalStationId,
  selectIsQrScanStation,
  selectQrVirtualStationId,
  clearQrStationData,
  selectDepartureStation,
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
import { useSimpleCameraAnimations } from "@/hooks/useCameraAnimation";
import { useCircleOverlay } from "@/hooks/useCircleOverlay";
import { useWalkingRouteOverlay } from "@/hooks/useWalkingRouteOverlay";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import CarPlate from "@/components/ui/CarPlate";
import PickupTime from "@/components/ui/PickupTime";
import FareDisplay from "@/components/ui/FareDisplay";


// SheetMode type is now imported from types/map

export default function GMap() {
  const dispatch = useAppDispatch();

  // Use the centralized Google Maps provider
  const { isLoaded, loadError, googleMapsReady, loadingProgress, retryLoading } = useGoogleMaps();

  // -------------------------
  // Local UI & Map States
  // -------------------------
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  // Local state for search location, synchronized with Redux
  const [searchLocation, setLocalSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);

  // -------------------------
  // Redux States - Optimized with single selector call
  // -------------------------
  const {
    stations,
    stationsLoading,
    stationsError,
    cars, 
    carsLoading,
    carsError,
    userLocation,
    reduxSearchLocation,
    bookingStep,
    departureStationId,
    arrivalStationId,
    scannedCar,
    walkingRoute,
    isQrScanStation,
    virtualStationId
  } = useAppSelector(state => ({
    stations: selectStationsWithDistance(state),
    stationsLoading: selectStationsLoading(state),
    stationsError: selectStationsError(state),
    cars: selectAllCars(state),
    carsLoading: selectCarsLoading(state),
    carsError: selectCarsError(state),
    userLocation: selectUserLocation(state),
    reduxSearchLocation: selectSearchLocation(state),
    bookingStep: selectBookingStep(state),
    departureStationId: selectDepartureStationId(state),
    arrivalStationId: selectArrivalStationId(state),
    scannedCar: selectScannedCar(state),
    walkingRoute: selectWalkingRoute(state),
    isQrScanStation: selectIsQrScanStation(state),
    virtualStationId: selectQrVirtualStationId(state)
  }), shallowEqual);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false)

  // Single state for the sheet mode
  const [sheetMode, setSheetMode] = useState<SheetMode>("guide");
  const [sheetMinimized, setSheetMinimized] = useState(false);

  // For step transitions or animations (if you need them)
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

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
  // Initialize map options when Google Maps is ready
  // -------------------------
  useEffect(() => {
    if (googleMapsReady) {
      setMapOptions(createMapOptions());
    }
  }, [googleMapsReady]);

  // -------------------------
  // Sorting Stations and Location Helpers
  // -------------------------
  const sortStationsByDistanceToPoint = useCallback(
    throttle((point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
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
    }, 300), // Throttle to run at most once every 300ms
    [googleMapsReady]
  )

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

  // Hide spinner when all resources are loaded
  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);
  
  // Sync local search location with Redux state
  useEffect(() => {
    // Initialize local state from Redux if needed
    if (reduxSearchLocation && !searchLocation) {
      // Ensure type safety with explicit casting
      setLocalSearchLocation(reduxSearchLocation as google.maps.LatLngLiteral);
    }
  }, [reduxSearchLocation, searchLocation]);

  // Use the Redux stations which are already sorted by appropriate location
  // This useEffect will keep local sortedStations in sync with Redux state
  useEffect(() => {
    // stations from Redux are already sorted by the appropriate location 
    // (either search location or user location)
    setSortedStations(stations);
    
    // When location changes, automatically show the station list
    if ((userLocation || reduxSearchLocation) && 
        (bookingStep === 1 || bookingStep === 3 || bookingStep === 4)) {
      setSheetMode("list");
      setSheetMinimized(false);
    }
  }, [stations, userLocation, reduxSearchLocation, bookingStep]);

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

  
  
  // Function to get a formatted location name for display
  const getLocationDisplayName = useCallback((location: google.maps.LatLngLiteral | null): string => {
    // Instead of using a fallback logic, explicitly determine the location source
    // This treats both location types as equal alternatives
    
    // If a specific location is provided, use it directly
    if (location) {
      return 'Search Location';
    }
    
    // Otherwise, determine if we're using search location or user location
    if (reduxSearchLocation) {
      return 'Search Location';
    }
    
    if (userLocation) {
      return 'Current Location';
    }
    
    // Default when no location is available
    return 'Nearby';
  }, [reduxSearchLocation, userLocation]);

  // -------------------------
  // Station Selection Manager
  // -------------------------
  // Load the station selection manager asynchronously if not already loaded
  const stationSelectionManagerRef = useRef<any>(null);
  useEffect(() => {
    import("@/lib/stationSelectionManager").then(module => {
      stationSelectionManagerRef.current = module.default;
    });
  }, []);

  // -------------------------
  // One function for station selection (using stationSelectionManager)
  // -------------------------
  const pickStationAsDeparture = useCallback(
    (stationId: number, viaScan = false) => {
      // Use the stationSelectionManager if available
      if (stationSelectionManagerRef.current) {
        const newSheetMode = stationSelectionManagerRef.current.selectStation(stationId, viaScan);
        setSheetMode(newSheetMode);
        setSheetMinimized(false);
        return;
      }
      
      // Fallback to original behavior if manager not available
      if (isQrScanStation && virtualStationId && stationId !== virtualStationId) {
        dispatch(clearDepartureStation());
        dispatch(removeStation(virtualStationId));
        dispatch(clearQrStationData());
        processedCarIdRef.current = null;
      }

      // Step logic
      if (bookingStep === 1) {
        dispatch(selectDepartureStation(stationId));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (bookingStep === 2) {
        dispatch(selectDepartureStation(stationId));
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
      selectDepartureStation,
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

  // Only initialize the Three overlay when the map is ready and stations are loaded
  const { overlayRef } = useThreeOverlay(
    googleMapsReady ? actualMap : null, 
    stations, 
    threeOverlayOptions
  );

// -------------------------
// Advanced Marker Overlay Hook
// -------------------------

// Call the hook at the top level of your component and capture the returned methods
const { updateMarkerTilt, updateMarkerZoom } = useMarkerOverlay(actualMap, {
  onPickupClick: (stationId) => {
    pickStationAsDeparture(stationId, false);
  }
});

// -------------------------
// Location Circles Overlay Hook
// -------------------------

// Use the hook to create circles for user and search locations
const { userCircleRef, searchCircleRef } = useCircleOverlay(actualMap, {
  userCircleColor: "#10A37F", // Green color for user location
  userCircleRadius: 80,
  userCircleOpacity: 0.15,
  searchCircleColor: "#276EF1", // Blue color for search location
  searchCircleRadius: 120,
  searchCircleOpacity: 0.12,
});

// -------------------------
// Walking Route Overlay Hook
// -------------------------
const { walkingRouteRef } = useWalkingRouteOverlay(actualMap, {
  strokeColor: "#4CAF50", // Green color for walking route
  strokeOpacity: 0.8,
  strokeWeight: 4,
  zIndex: 5, // Above circles but below markers
});

// -------------------------
// Camera Animation Hook
// -------------------------
const cameraControls = useSimpleCameraAnimations({
  map: actualMap,
  stations,
});

// Hook into heading changes for 3D overlay only
useEffect(() => {
  if (!actualMap) return;

  // Only keep the heading change handler for 3D overlay
  const handleHeadingChanged = () => {
    overlayRef.current?.requestRedraw();
  };

  // Listen for camera/map changes to update 3D overlay
  const handleMapIdle = () => {
    overlayRef.current?.requestRedraw();
  };

  // Attach events
  const headingListener = google.maps.event.addListener(
    actualMap,
    "heading_changed",
    handleHeadingChanged
  );
  
  const idleListener = google.maps.event.addListener(
    actualMap,
    "idle",
    handleMapIdle
  );

  return () => {
    google.maps.event.removeListener(headingListener);
    google.maps.event.removeListener(idleListener);
  };
}, [actualMap, overlayRef]);


  // -------------------------
  // QR logic 
  // -------------------------
  
  const resetBookingFlowForQrScan = useCallback(() => {
    // Use the manager if available
    if (stationSelectionManagerRef.current) {
      stationSelectionManagerRef.current.resetBookingFlowForQrScan();
      return;
    }
    
    // Fallback to original behavior
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
      
      // Use the manager if available
      if (stationSelectionManagerRef.current) {
        const newSheetMode = stationSelectionManagerRef.current.handleQrScanSuccess(car);
        setSheetMode(newSheetMode);
        setSheetMinimized(false);
        return;
      }
      
      // Fallback to original behavior
      console.log("handleQrScanSuccess with car ID:", car.id);

      dispatch(clearDepartureStation());
      dispatch(clearArrivalStation());
      dispatch(clearDispatchRoute());
      dispatch(clearRoute());

      const vStationId = Date.now();
      const virtualStation = createVirtualStationFromCar(car, vStationId);

      dispatch(addVirtualStation(virtualStation));
      dispatch(selectDepartureStation(vStationId));
      dispatch(advanceBookingStep(2));

      processedCarIdRef.current = car.id;
      setSheetMode("detail");
      setSheetMinimized(false);
      toast.success(`Car ${car.id} selected as departure`);
    },
    [dispatch]
  );

  // -------------------------
  // Confirm logic for detail (using stationSelectionManager)
  // -------------------------
  const handleStationConfirm = useCallback(() => {
    // Use the manager if available
    if (stationSelectionManagerRef.current) {
      const newSheetMode = stationSelectionManagerRef.current.confirmStationSelection();
      setSheetMode(newSheetMode);
      setSheetMinimized(false);
      return;
    }
    
    // Fallback to original behavior
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
    // If it's a QR-based virtual station
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
              onClick={retryLoading} // Use retryLoading instead of page refresh
              className="text-sm underline hover:text-destructive/80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!hasError && overlayVisible && <LoadingSpinner progress={loadingProgress} />}

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
            {/* Add Camera State Observer */}
            {actualMap && <CameraStateObserver map={actualMap} throttleMs={100} />}
          </div>

          {/* Station selector (top bar) */}
          <StationSelector
            onAddressSearch={(loc) => {
              setLocalSearchLocation(loc);
              dispatch(setSearchLocation(loc as google.maps.LatLngLiteral)); // Save to redux
              // The stations will be automatically sorted by the useEffect that watches Redux state
              
              // If in step 1, 3, or 4, switch to "list" to show station results
              if (bookingStep === 1 || bookingStep === 3 || bookingStep === 4) {
                setSheetMode("list");
                setSheetMinimized(false);
              }
            }}
            animateToLocation={cameraControls?.animateToLocation}
            onClearDeparture={() => {
              // Use the manager if available
              if (stationSelectionManagerRef.current) {
                const newSheetMode = stationSelectionManagerRef.current.clearDepartureStation();
                setSheetMode(newSheetMode);
                setSheetMinimized(false);
                return;
              }
              
              // Fallback to original behavior
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
              // Use the manager if available
              if (stationSelectionManagerRef.current) {
                const newSheetMode = stationSelectionManagerRef.current.clearArrivalStation();
                setSheetMode(newSheetMode);
                setSheetMinimized(false);
                return;
              }
              
              // Fallback to original behavior
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
>

  {/* Sheet body content depends on sheetMode */}
  {sheetMode === "guide" && (
    <>
      {/* Example: if step 1 => departing, if step 3 => returning */}
      {bookingStep === 1 && <PickupGuide bookingStep={1} isDepartureFlow />}
      {bookingStep === 3 && (
        <PickupGuide
          bookingStep={3}
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
    <div className="space-y-2">
      <StationList
        stations={sortedStations}
        userLocation={userLocation}
        searchLocation={reduxSearchLocation}
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
    <div className="text-sm text-gray-400">
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