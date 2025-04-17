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
import { shallowEqual } from "react-redux";
import { useGoogleMaps } from "@/providers/GoogleMapsProvider";
import { throttle } from "lodash";
import ChevronDown from "@/components/ui/icons/ChevronDown";
import ChevronUp from "@/components/ui/icons/ChevronUp";

import {
  selectSheetMode,
  selectSheetMinimized,
  selectQrScannerOpen,
  selectSignInModalOpen,
  setSheetMode,
  setSheetMinimized,
  setQrScannerOpen,
  setSignInModalOpen
} from "@/store/uiSlice";

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
import PickupGuide from "@/components/ui/PickupGuide"
import DateTimeSelector from "@/components/DateTimeSelector";
import PickupTime from "@/components/ui/PickupTime";

import { LIBRARIES, MAP_CONTAINER_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, createMapOptions } from "@/constants/map";
import { useThreeOverlay } from "@/hooks/useThreeOverlay";
import { useMarkerOverlay } from "@/hooks/useMarkerOverlay";
import { useSimpleCameraAnimations } from "@/hooks/useCameraAnimation";
import { useCircleOverlay } from "@/hooks/useCircleOverlay";
import { useWalkingRouteOverlay } from "@/hooks/useWalkingRouteOverlay";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import CarPlate from "@/components/ui/CarPlate";
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

  // Get UI state from Redux
  const sheetMode = useAppSelector(selectSheetMode);
  const sheetMinimized = useAppSelector(selectSheetMinimized);
  const isQrScannerOpen = useAppSelector(selectQrScannerOpen);
  const signInModalOpen = useAppSelector(selectSignInModalOpen);

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

  // Note: Station sorting is now handled by Redux

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
      dispatch(setSheetMode("list"));
      dispatch(setSheetMinimized(false));
    }
  }, [stations, userLocation, reduxSearchLocation, bookingStep, dispatch]);

  // -------------------------
  // Auto-switch sheetMode by bookingStep
  // -------------------------
  useEffect(() => {
    // For steps 1 or 3, show "guide" if we haven't forced other modes
    if (bookingStep === 1 || bookingStep === 3) {
      dispatch(setSheetMode("guide"));
      dispatch(setSheetMinimized(false));
      return;
    }

    // For steps 2 or 4, typically want "detail" once a station is chosen
    if (bookingStep === 2 || bookingStep === 4) {
      // If we do not yet have a station chosen, remain in guide or handle as needed
      if (departureStationId || arrivalStationId) {
        dispatch(setSheetMode("detail"));
      } else {
        dispatch(setSheetMode("guide"));
      }
      dispatch(setSheetMinimized(false));
    }
  }, [bookingStep, departureStationId, arrivalStationId, dispatch]);

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
      // Load stationSelectionManager if not already loaded
      if (!stationSelectionManagerRef.current) {
        import("@/lib/stationSelectionManager").then(module => {
          stationSelectionManagerRef.current = module.default;
          stationSelectionManagerRef.current.selectStation(stationId, viaScan);
        });
        return;
      }
      
      // Use the manager for station selection
      stationSelectionManagerRef.current.selectStation(stationId, viaScan);
    },
    [/* no dependencies needed since we're only using the manager */]
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
  
  // Store the callback in a stable ref to prevent recreation
  const stationSelectedCallbackRef = useRef<(stationId: number) => void>((stationId) => {});
  
  // Update the ref when pickStationAsDeparture changes, without recreating threeOverlayOptions
  useEffect(() => {
    stationSelectedCallbackRef.current = (stationId: number) => {
      pickStationAsDeparture(stationId, false);
    };
  }, [pickStationAsDeparture]);
  
  // Create stable options object that won't change reference on re-renders
  const threeOverlayOptions = useMemo(
    () => ({
      onStationSelected: (stationId: number) => {
        stationSelectedCallbackRef.current(stationId);
      },
    }),
    // Empty dependency array ensures this object never changes reference
    []
  );

  // Use a stable ref for stations to prevent unnecessary re-renders
  const stableStationsRef = useRef(stations);
  
  // Only update the ref when stations actually change in a meaningful way
  useEffect(() => {
    if (stableStationsRef.current.length !== stations.length) {
      console.log('[GMap] Updating stableStationsRef due to length change');
      stableStationsRef.current = stations;
    }
  }, [stations]);

  // Only initialize the Three overlay when the map is ready and stations are loaded
  const { overlayRef } = useThreeOverlay(
    googleMapsReady ? actualMap : null, 
    stableStationsRef.current, 
    threeOverlayOptions
  );

// -------------------------
// Advanced Marker Overlay Hook
// -------------------------

// Store the marker overlay callback in a stable ref to prevent recreation
const markerPickupCallbackRef = useRef<(stationId: number) => void>((stationId) => {});

// Update the ref when pickStationAsDeparture changes
useEffect(() => {
  markerPickupCallbackRef.current = (stationId: number) => {
    pickStationAsDeparture(stationId, false);
  };
}, [pickStationAsDeparture]);

// Create stable marker options object with a callback that uses the ref
const markerOverlayOptions = useMemo(
  () => ({
    onPickupClick: (stationId: number) => {
      markerPickupCallbackRef.current(stationId);
    }
  }),
  // Empty dependency array ensures this options object never changes reference
  []
);

// Call the marker overlay hook with the stable options
useMarkerOverlay(actualMap, markerOverlayOptions);

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

// Note: Map event listeners for heading/idle are now handled directly inside useThreeOverlay


  // -------------------------
  // QR logic 
  // -------------------------
  
  const resetBookingFlowForQrScan = useCallback(() => {
    // Load stationSelectionManager if not already loaded
    if (!stationSelectionManagerRef.current) {
      import("@/lib/stationSelectionManager").then(module => {
        stationSelectionManagerRef.current = module.default;
        stationSelectionManagerRef.current.resetBookingFlowForQrScan();
      });
      return;
    }
    
    // Use the manager to reset booking flow for QR scan
    stationSelectionManagerRef.current.resetBookingFlowForQrScan();
  }, [/* no dependencies needed since we're only using the manager */]);

  const handleOpenQrScanner = useCallback(() => {
    resetBookingFlowForQrScan();
    // Update UI state in Redux
    dispatch(setSheetMode("guide"));
    dispatch(setQrScannerOpen(true));
  }, [resetBookingFlowForQrScan, dispatch, setSheetMode, setQrScannerOpen]);

  const handleQrScanSuccess = useCallback(
    (car: Car) => {
      if (!car) return;
      
      // Load stationSelectionManager if not already loaded
      if (!stationSelectionManagerRef.current) {
        import("@/lib/stationSelectionManager").then(module => {
          stationSelectionManagerRef.current = module.default;
          stationSelectionManagerRef.current.handleQrScanSuccess(car);
        });
        return;
      }
      
      // Use the manager for QR scan handling
      stationSelectionManagerRef.current.handleQrScanSuccess(car);
    },
    [/* no dependencies needed since we're only using the manager */]
  );

  // -------------------------
  // Confirm logic for detail (using stationSelectionManager)
  // -------------------------
  const handleStationConfirm = useCallback(() => {
    // Load stationSelectionManager if not already loaded
    if (!stationSelectionManagerRef.current) {
      import("@/lib/stationSelectionManager").then(module => {
        stationSelectionManagerRef.current = module.default;
        stationSelectionManagerRef.current.confirmStationSelection();
      });
      return;
    }
    
    // Use the manager to confirm station selection
    stationSelectionManagerRef.current.confirmStationSelection();
  }, [/* no dependencies needed since we're only using the manager */]);

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
              sheetMode: {sheetMode} {sheetMinimized ? "(minimized)" : ""}
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
              setLocalSearchLocation(loc);
              dispatch(setSearchLocation(loc as google.maps.LatLngLiteral)); // Save to redux
              // The stations will be automatically sorted by the useEffect that watches Redux state
              
              // If in step 1, 3, or 4, switch to "list" to show station results
              if (bookingStep === 1 || bookingStep === 3 || bookingStep === 4) {
                dispatch(setSheetMode("list"));
                dispatch(setSheetMinimized(false));
              }
            }}
            animateToLocation={cameraControls?.animateToLocation}
            onClearDeparture={() => {
              // Load stationSelectionManager if not already loaded
              if (!stationSelectionManagerRef.current) {
                import("@/lib/stationSelectionManager").then(module => {
                  stationSelectionManagerRef.current = module.default;
                  stationSelectionManagerRef.current.clearDepartureStation();
                });
                return;
              }
              
              stationSelectionManagerRef.current.clearDepartureStation();
            }}
            onClearArrival={() => {
              // Load stationSelectionManager if not already loaded
              if (!stationSelectionManagerRef.current) {
                import("@/lib/stationSelectionManager").then(module => {
                  stationSelectionManagerRef.current = module.default;
                  stationSelectionManagerRef.current.clearArrivalStation();
                });
                return;
              }
              
              stationSelectionManagerRef.current.clearArrivalStation();
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
  onMinimize={() => dispatch(setSheetMinimized(true))}
  onExpand={() => dispatch(setSheetMinimized(false))}
  onDismiss={() => dispatch(setSheetMinimized(true))}
  disableMinimize={disableMinimize}
>

  {/* Sheet body content depends on sheetMode */}
  {sheetMode === "guide" && (
    <>
      {/* Example: if step 1 => departing, if step 3 => returning */}
      {bookingStep === 1 && <PickupGuide bookingStep={1} isDepartureFlow />}
      {bookingStep === 3 && (
        <>
          <div className="space-y-4 p-2">
            <PickupTime useReduxTime={true} />
            <div className="text-center text-sm text-gray-400 mt-2">
              Ready to select your arrival station
            </div>
          </div>
        </>
      )}

      {/* Now show DateTimeSelector in step 2 */}
      {bookingStep === 2 && (
        <DateTimeSelector onDateTimeConfirmed={() => {
          setSheetMode("detail")
        }}/>
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
      onOpenSignInModal={() => dispatch(setSignInModalOpen(true))}
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
  onClose={() => dispatch(setQrScannerOpen(false))}
  onScanSuccess={(car) => handleQrScanSuccess(car)}
  currentVirtualStationId={virtualStationId}
/>

{/* Sign-In Modal */}
<SignInModal
  isOpen={signInModalOpen}
  onClose={() => dispatch(setSignInModalOpen(false))}
/>
        </>
      )}
    </div>
  );
}