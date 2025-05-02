"use client";

import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  Suspense,
} from "react";
import { GoogleMap, LoadScriptNext } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import { shallowEqual } from "react-redux";
import { logger } from "@/lib/logger";
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

import type { Car } from "../types/cars";
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
  selectRoute,
} from "@/store/bookingSlice";

import {
  fetchDispatchDirections,
  clearDispatchRoute,
  selectDispatchRoute,
} from "@/store/dispatchSlice";

import { fetchStations3D } from "@/store/stations3DSlice";

import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector/";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
import StationList from "./StationList";
import QrScannerOverlay from "@/components/ui/QrScannerOverlay";
import SignInModal from "@/components/ui/SignInModal";
import PickupGuide from "@/components/ui/PickupGuide"
import DateTimeSelector from "@/components/DateTimeSelector";
import LocateMeButton from "@/components/ui/LocateMeButton"
import ReturnToSameStation from "@/components/ui/ReturnToSameStation"
import ScheduleLaterButton from "@/components/ui/ScheduleLaterButton";
import InfoBar from "@/components/InfoBar";
// Debug component removed

import { LIBRARIES, MAP_CONTAINER_STYLE, DEFAULT_CENTER, DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, createMapOptions } from "@/constants/map";
import { useThreeOverlay } from "@/hooks/useThreeOverlay";
import { useMarkerOverlay } from "@/hooks/useMarkerOverlay";
import { useCameraControlInit } from "@/hooks/useCameraControlInit";
import { useCircleOverlay } from "@/hooks/useCircleOverlay";
import { useWalkingRouteOverlay } from "@/hooks/useWalkingRouteOverlay";
import cameraAnimationManager from "@/lib/cameraAnimationManager";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import CarPlate from "@/components/ui/CarPlate";
import FareDisplay from "@/components/ui/FareDisplay";


// SheetMode type is now imported from types/map

export default function GMap() {
  const dispatch = useAppDispatch();

  // Use the centralized Google Maps provider
  const { isLoaded, loadError, googleMapsReady, loadingProgress, retryLoading, map: contextMap, setMap: setCtxMap } = useGoogleMaps();

  // -------------------------
  // Local UI States
  // -------------------------
  const [overlayVisible, setOverlayVisible] = useState(true);
  // No local map state - we'll use context directly
  // No local search location state - we'll use Redux directly

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
    virtualStationId,
    dispatchRoute,
    route
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
    virtualStationId: selectQrVirtualStationId(state),
    dispatchRoute: selectDispatchRoute(state),
    route: selectRoute(state)
  }), shallowEqual);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isDateTimePickerVisible, setIsDateTimePickerVisible] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

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
  
  // -------------------------
  // Track sheet dimensions with ResizeObserver
  // -------------------------
  useEffect(() => {
    if (!sheetRef.current) return;
    
    // Create ResizeObserver to track sheet height changes
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Update sheet height state
        const newHeight = entry.contentRect.height;
        setSheetHeight(newHeight);
        logger.debug(`[GMap] Sheet height changed: ${newHeight}px`);
      }
    });
    
    // Start observing the sheet element
    resizeObserver.observe(sheetRef.current);
    
    // Clean up observer on unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
  
  // No need to sync search location - using Redux directly

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
  // Camera Animation Hooks
  // -------------------------
  // Use the init hook instead of direct useCameraAnimation to ensure
  // the CameraAnimationManager is properly initialized with our controls
  const cameraControls = useCameraControlInit();
  
  // -------------------------
  // Update camera manager with sheet dimensions
  // -------------------------
  useEffect(() => {
    if (!contextMap || !sheetHeight) return;
    
    // Get map element dimensions
    const mapHeight = contextMap.getDiv().clientHeight;
    
    // Update camera animation manager with viewport metrics
    cameraAnimationManager.updateViewportMetrics(sheetHeight, mapHeight, contextMap);
    
    logger.debug(`[GMap] Updated camera manager with metrics: sheet=${sheetHeight}px, map=${mapHeight}px`);
  }, [contextMap, sheetHeight]);
  
  // -------------------------
  // Handle sheet state changes - reposition camera
  // -------------------------
  useEffect(() => {
    // When sheet minimized state changes and we have an active point of interest,
    // reposition the camera to account for the new sheet height
    if (contextMap && cameraControls) {
      // Allow a short delay for sheet animation to complete
      const repositionTimeout = setTimeout(() => {
        // Determine which station to focus on based on current booking step
        if (bookingStep < 3 && departureStationId) {
          // In steps 1-2, focus on departure station
          cameraAnimationManager.animateToSelectedStation(
            departureStationId,
            { duration: 500 } // Shorter duration for this adjustment
          );
        } else if (bookingStep >= 3 && arrivalStationId) {
          // In steps 3-4, focus on arrival station
          cameraAnimationManager.animateToSelectedStation(
            arrivalStationId,
            { duration: 500 } // Shorter duration for this adjustment
          );
        } else if (bookingStep >= 3 && departureStationId && !arrivalStationId) {
          // If in step 3+ with only departure station, focus on it
          cameraAnimationManager.animateToSelectedStation(
            departureStationId,
            { duration: 500 } // Shorter duration for this adjustment
          );
        }
      }, 300); // Wait for sheet animation to complete
      
      return () => clearTimeout(repositionTimeout);
    }
  }, [sheetMinimized, departureStationId, arrivalStationId, bookingStep, contextMap, cameraControls]);
  
  // We no longer need the animateToLocation function as components use CameraAnimationManager directly
  
  // Three overlay handles its own camera change listeners internally
  
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
  // REMOVED: Camera animations are now centralized in useCameraAnimation.ts
  // This removes duplicate animation triggers that were causing conflicts
  // -------------------------

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
          stationSelectionManagerRef.current.selectStation(stationId, viaScan, cameraControls);
        });
        return;
      }
      
      // Use the manager for station selection, passing camera controls
      stationSelectionManagerRef.current.selectStation(stationId, viaScan, cameraControls);
    },
    [cameraControls] // Add cameraControls as a dependency
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      // Just select the station through the manager 
      // The camera animations will be handled by useCameraAnimation hook
      pickStationAsDeparture(station.id, false);
    },
    [pickStationAsDeparture]
  );
  
  // -------------------------
  // ThreeJs Overlay Hook
  // -------------------------
  
  // Create a stable selection handler that handles selection
  // Camera animations are now centralized in useCameraAnimation hook
  const handleStationSelection = useCallback((stationId: number) => {
    // Just use the manager to handle state updates
    // Animations will be triggered by the useCameraAnimation hook
    pickStationAsDeparture(stationId, false);
  }, [pickStationAsDeparture]);
  
  // Create stable options objects for all components that need the selection callback
  const overlayOptions = useMemo(
    () => ({
      // ThreeJs Overlay options
      threeOptions: {
        onStationSelected: handleStationSelection,
      },
      // Marker Overlay options
      markerOptions: {
        onPickupClick: handleStationSelection
      }
    }),
    // We include handleStationSelection in deps to ensure it's always the latest version
    [handleStationSelection]
  );

  // Memoize stations to prevent unnecessary re-renders of the ThreeOverlay
  const stableStations = useMemo(() => stations, [stations.length]);

  
  // Removed duplicate map event listeners (now handled in the camera change effect)

// -------------------------
// Map Overlay Hooks
// -------------------------

// THREE.js Overlay
const { overlayRef } = useThreeOverlay(
  googleMapsReady ? contextMap : null, 
  stableStations, 
  overlayOptions.threeOptions
);

// No need to connect overlay to camera animations - handled internally

// Advanced Marker Overlay
useMarkerOverlay(contextMap, overlayOptions.markerOptions);

// -------------------------
// Location Circles Overlay Hook
// -------------------------

// Use the hook to create circles for user and search locations
const { dispose: disposeCircleOverlay } = useCircleOverlay(contextMap, {
  userCircleColor: "#FFFFFF", // White circle for user location
  userCircleRadius: 80,
  userCircleOpacity: 0.2,
  searchCircleColor: "#FFFFFF", // Also white for search location
  searchCircleRadius: 120,
  searchCircleOpacity: 0.2,
});

// Clean up circles when component unmounts
useEffect(() => {
  return () => {
    disposeCircleOverlay();
  };
}, [disposeCircleOverlay]);

// -------------------------
// Walking Route Overlay Hook
// -------------------------
const { dispose: disposeWalkingRoute } = useWalkingRouteOverlay(contextMap, {
  strokeColor: "#4CAF50", // Green color for walking route
  strokeOpacity: 0.8,
  strokeWeight: 4,
  zIndex: 5, // Above circles but below markers
});

// Clean up walking route when component unmounts
useEffect(() => {
  return () => {
    disposeWalkingRoute();
  };
}, [disposeWalkingRoute]);


// Note: Automatic camera animations based on location state changes have been removed.
// Camera animations are now triggered only by explicit user actions through CameraAnimationManager.
// This prevents conflicts between different animation triggers and maintains consistent behavior.

// Note: Map event listeners for heading/idle are now handled directly inside useThreeOverlay


  // -------------------------
  // QR logic 
  // -------------------------
  
  const resetBookingFlowForQrScan = useCallback(() => {
    // Load stationSelectionManager if not already loaded
    if (!stationSelectionManagerRef.current) {
      import("@/lib/stationSelectionManager").then(module => {
        stationSelectionManagerRef.current = module.default;
        stationSelectionManagerRef.current.resetBookingFlowForQrScan(cameraControls);
      });
      return;
    }
    
    // Use the manager to reset booking flow for QR scan
    stationSelectionManagerRef.current.resetBookingFlowForQrScan(cameraControls);
  }, [cameraControls]);

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
          stationSelectionManagerRef.current.handleQrScanSuccess(car, cameraControls);
        });
        return;
      }
      
      // Use the manager for QR scan handling, passing camera controls
      stationSelectionManagerRef.current.handleQrScanSuccess(car, cameraControls);
    },
    [cameraControls] // Add cameraControls as a dependency
  );

  // -------------------------
  // Confirm logic for detail (using stationSelectionManager)
  // -------------------------
  const handleStationConfirm = useCallback(() => {
    // Load stationSelectionManager if not already loaded
    if (!stationSelectionManagerRef.current) {
      import("@/lib/stationSelectionManager").then(module => {
        stationSelectionManagerRef.current = module.default;
        stationSelectionManagerRef.current.confirmStationSelection(cameraControls);
      });
      return;
    }
    
    // Use the manager to confirm station selection
    // Pass camera controls to allow animations
    stationSelectionManagerRef.current.confirmStationSelection(cameraControls);
  }, [cameraControls]);

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
              onClick={retryLoading}
              className="text-sm underline hover:text-destructive/80"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!hasError && overlayVisible && <LoadingSpinner progress={loadingProgress} />}

      {!hasError && !overlayVisible && (
        <React.Fragment>
          {process.env.NODE_ENV === "development" && (
            <React.Fragment>
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
              
              {/* Test controls for date/time selection removed */}
            </React.Fragment>
          )}

          {/* Main map container */}
          <div className="absolute inset-0">
            {/* Use GoogleMap without LoadScript since we're using GoogleMapsProvider */}
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={(map: google.maps.Map) => {
                setCtxMap?.(map);
              }}
            >
              {/* 3D overlay from useThreeOverlay */}
            </GoogleMap>
            
            {/* InfoBar - rendered on the top-left of the map in steps 2 and 4 (hidden in step 3 as ScheduleLaterButton is in sheet) */}
            {(bookingStep === 2 || bookingStep === 4) && (
              <div className={`absolute left-4 z-[10000] max-w-xs infobar-container ${
                bookingStep === 4 
                  ? departureStationId && arrivalStationId && departureStationId === arrivalStationId
                    ? 'top-[154px]' // Extra space for the notification about same stations
                    : 'top-[114px]' 
                  : 'top-[54px]'
              }`}>
                <InfoBar 
                  distanceInKm={route?.distance ? (route.distance / 1000).toFixed(1) : null}
                  pickupMins={dispatchRoute?.duration ? Math.ceil(dispatchRoute.duration / 60 + 15) : null}
                  currentStep={bookingStep}
                  onDateTimePickerVisibilityChange={setIsDateTimePickerVisible}
                />
              </div>
            )}
          </div>

          {/* Station selector (top bar) - hidden in step 1 and 3 since we show it in the sheet */}
          {bookingStep !== 1 && bookingStep !== 3 && (
            <StationSelector
              currentStep={bookingStep}
              onAddressSearch={(loc) => {
                // Update search location directly in Redux
                dispatch(setSearchLocation(loc as google.maps.LatLngLiteral));
                
                // If in step 1, 3, or 4, switch to "list" to show station results
                if (bookingStep === 1 || bookingStep === 3 || bookingStep === 4) {
                  dispatch(setSheetMode("list"));
                  dispatch(setSheetMinimized(false));
                }
              }}
                            onClearDeparture={() => {
                // Load stationSelectionManager if not already loaded
                if (!stationSelectionManagerRef.current) {
                  import("@/lib/stationSelectionManager").then(module => {
                    stationSelectionManagerRef.current = module.default;
                    stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
                  });
                  return;
                }
                
                stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
              }}
              onClearArrival={() => {
                // Load stationSelectionManager if not already loaded
                if (!stationSelectionManagerRef.current) {
                  import("@/lib/stationSelectionManager").then(module => {
                    stationSelectionManagerRef.current = module.default;
                    stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
                  });
                  return;
                }
                
                stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
              }}
              onScan={handleOpenQrScanner}
              isQrScanStation={isQrScanStation}
              virtualStationId={virtualStationId}
              scannedCar={scannedCar}
            />
          )}

          {/* Unified Sheet - always "open," content depends on sheetMode */}
          <Sheet
            ref={sheetRef}
            isOpen={true}
            isMinimized={sheetMinimized}
            onMinimize={() => dispatch(setSheetMinimized(true))}
            onExpand={() => dispatch(setSheetMinimized(false))}
            onDismiss={() => dispatch(setSheetMinimized(true))}
            disableMinimize={disableMinimize}
            // Allow the sheet to be sized based on content for all steps
            className={`bg-black/90 backdrop-blur-md ${bookingStep === 3 
              ? "max-h-[60vh]" // Keep reasonable max height but remove min height for step 3
              : "max-h-[85vh]"}`} // Default height for other steps
          >
            {/* Sheet body content depends on sheetMode */}
            {sheetMode === "guide" && (
              <React.Fragment>
                {/* In step 1, render StationSelector instead of PickupGuide */}
                {bookingStep === 1 && (
                  <div className="h-auto flex flex-col" style={{ minHeight: "unset" }}>
                    {/* Title and subtitle */}
                    <div className="text-left px-4 py-2">
                      <h2 className="text-lg font-medium">Ready to drive?</h2>
                      <p className="text-sm text-gray-400">Select a pickup station to begin</p>
                    </div>
                    
                    {/* StationSelector in its own container */}
                    <div className="w-full px-4 relative z-20 mb-2">
                      <StationSelector
                        inSheet
                        currentStep={bookingStep}
                        onAddressSearch={(loc) => {
                          dispatch(setSearchLocation(loc as google.maps.LatLngLiteral));
                          dispatch(setSheetMode("list"));
                          dispatch(setSheetMinimized(false));
                        }}
                        onClearDeparture={() => {
                          if (!stationSelectionManagerRef.current) {
                            import("@/lib/stationSelectionManager").then(module => {
                              stationSelectionManagerRef.current = module.default;
                              stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
                            });
                            return;
                          }
                          stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
                        }}
                        onClearArrival={() => {
                          if (!stationSelectionManagerRef.current) {
                            import("@/lib/stationSelectionManager").then(module => {
                              stationSelectionManagerRef.current = module.default;
                              stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
                            });
                            return;
                          }
                          stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
                        }}
                        onScan={handleOpenQrScanner}
                        isQrScanStation={isQrScanStation}
                        virtualStationId={virtualStationId}
                        scannedCar={scannedCar}
                      />
                    </div>
                    
                    {/* Action buttons fixed at the bottom with equal width */}
                    <div className="px-4 sticky bottom-0 left-0 right-0 z-50 bg-black/95" style={{ height: "48px" }}>
                      <div className="flex justify-between gap-2 py-2">
                        <div className="w-[48%]">
                          <LocateMeButton 
                            position="sheet"
                            onSuccess={(location) => {
                              console.log("[GMap] LocateMeButton used (step " + bookingStep + ")");
                              
                              // Update Redux state
                              dispatch(setSearchLocation(location));
                              dispatch(setSheetMode("list"));
                              dispatch(setSheetMinimized(false));
                              
                              // Use camera animation manager directly
                              cameraAnimationManager.onLocateMePressed(location, cameraControls);
                            }}
                          />
                        </div>
                        
                        <div className="w-[48%]">
                          <ScheduleLaterButton />
                        </div>
                      </div>
                    </div>
                    {/* No spacer needed with fixed buttons */}
                  </div>
                )}
                
                {bookingStep === 3 && (
                  <div className="flex flex-col" style={{ minHeight: "unset" }}>
                    {/* Title and subtitle */}
                    <div className="text-left px-4 py-2">
                      <h2 className="text-lg font-medium">Choose arrival station</h2>
                      <p className="text-sm text-gray-400">Select where you want to go</p>
                    </div>
                    
                    {/* StationSelector in its own container */}
                    <div className="w-full px-4 relative z-20 mb-8">
                      <StationSelector
                        inSheet
                        currentStep={bookingStep}
                        onAddressSearch={(loc) => {
                          dispatch(setSearchLocation(loc as google.maps.LatLngLiteral));
                          dispatch(setSheetMode("list"));
                          dispatch(setSheetMinimized(false));
                        }}
                        onClearDeparture={() => {
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
                    </div>
                    
                    {/* Buttons at the bottom of the sheet */}
                    <div className="px-4 sticky bottom-0 left-0 right-0 z-50 bg-black/95" style={{ height: "48px" }}>
                      <div className="flex justify-between gap-2 py-2">
                        <div className="w-[48%]">
                          <ScheduleLaterButton 
                            onClick={() => {
                              console.log("[GMap] ScheduleLaterButton used (step " + bookingStep + ")");
                            }}
                          />
                        </div>
                        
                        <div className="w-[48%]">
                          <ReturnToSameStation 
                            position="sheet"
                            disabled={!departureStationId}
                            onClick={() => {
                              console.log("[GMap] Return to same station clicked");
                              
                              // Load stationSelectionManager if not already loaded
                              if (!stationSelectionManagerRef.current) {
                                import("@/lib/stationSelectionManager").then(module => {
                                  stationSelectionManagerRef.current = module.default;
                                  // Use the new method to select return to same station
                                  const success = stationSelectionManagerRef.current.selectReturnToSameStation(cameraControls);
                                  if (!success) {
                                    toast.error("Unable to select return to same station");
                                  } else {
                                    toast.success("Return to same station selected");
                                  }
                                });
                                return;
                              }
                              
                              // Use the new method to select return to same station
                              const success = stationSelectionManagerRef.current.selectReturnToSameStation(cameraControls);
                              if (!success) {
                                toast.error("Unable to select return to same station");
                              } else {
                                toast.success("Return to same station selected");
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* No spacer needed with fixed buttons */}
                  </div>
                )}

                {/* Step 2 - We now handle this through StationDetail */}
                {bookingStep === 2 && (
                  <React.Fragment>
                    <div className="text-center py-4">
                      <p className="text-lg font-medium">You've selected a pickup station</p>
                      <p className="text-sm text-gray-400 mt-1">Use the "PICKUP CAR HERE" button to continue</p>
                    </div>
                  </React.Fragment>
                )}
                
                {bookingStep === 4 && (
                  <React.Fragment>
                    {/* Always show FareDisplay in step 4, regardless of other conditions */}
                    <div className="mb-4">
                      <FareDisplay baseFare={50} currency="HKD" perMinuteRate={1} />
                    </div>
                    <hr className="border-gray-200 my-3" />
                    <div className="px-4">
                      <StationSelector
                      inSheet
                      currentStep={bookingStep}
                      onAddressSearch={(loc) => {
                        dispatch(setSearchLocation(loc as google.maps.LatLngLiteral));
                        dispatch(setSheetMode("list"));
                        dispatch(setSheetMinimized(false));
                      }}
                      onClearDeparture={() => {
                        if (!stationSelectionManagerRef.current) {
                          import("@/lib/stationSelectionManager").then(module => {
                            stationSelectionManagerRef.current = module.default;
                            stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
                          });
                          return;
                        }
                        stationSelectionManagerRef.current.clearDepartureStation(cameraControls);
                      }}
                      onClearArrival={() => {
                        if (!stationSelectionManagerRef.current) {
                          import("@/lib/stationSelectionManager").then(module => {
                            stationSelectionManagerRef.current = module.default;
                            stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
                          });
                          return;
                        }
                        stationSelectionManagerRef.current.clearArrivalStation(cameraControls);
                      }}
                      onScan={handleOpenQrScanner}
                      isQrScanStation={isQrScanStation}
                      virtualStationId={virtualStationId}
                      scannedCar={scannedCar}
                    />
                    </div>
                  </React.Fragment>
                )}
              </React.Fragment>
            )}

            {sheetMode === "list" && (
              <div className="space-y-2">
                {/* Title and subtitle */}
                <div className="text-left px-4 py-2">
                  <h2 className="text-lg font-medium">Nearby Stations</h2>
                  <p className="text-sm text-gray-400">Select a station for pickup</p>
                </div>
                
                {/* Always show FareDisplay in step 4, regardless of sheet mode */}
                {bookingStep === 4 && (
                  <div className="px-4 mb-4">
                    <FareDisplay baseFare={50} currency="HKD" perMinuteRate={1} />
                  </div>
                )}
                
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

          {/* DateTimePicker is now handled directly in InfoBar using portals */}

          {/* Sign-In Modal */}
          <SignInModal
            isOpen={signInModalOpen}
            onClose={() => dispatch(setSignInModalOpen(false))}
          />
        </React.Fragment>
      )}
    </div>
  );
}