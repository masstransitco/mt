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
import * as THREE from "three"; // For potential 3D logic (not directly used here)
import { Minimize2, Maximize2 } from "lucide-react";

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
  selectArrivalStation,
  selectDepartureStation,
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

// 3D buildings
import { fetchStations3D } from "@/store/stations3DSlice";

// UI Components
import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
import StationList from "./StationList";
import QrScannerOverlay from "@/components/ui/QrScannerOverlay";
import SignInModal from "@/components/ui/SignInModal";

// Custom sheet-header items
import PickupTime from "@/components/ui/PickupTime";
import FareDisplay from "@/components/ui/FareDisplay";
import PickupGuide from "@/components/ui/PickupGuide";
import StationsDisplay from "@/components/ui/StationsDisplay";
import CarPlate from "@/components/ui/CarPlate";

// **Map constants** and the custom 3D overlay hook
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

// A single mode for the sheet: "none" | "list" | "detail"
type SheetMode = "none" | "list" | "detail";

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
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Possibly QR-based "virtual station" references
  const isQrScanStation = useAppSelector(selectIsQrScanStation);
  const virtualStationId = useAppSelector(selectQrVirtualStationId);

  // Route data
  const decodedPath = useAppSelector(selectRouteDecoded);
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

  // Timers
  const routeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedCarIdRef = useRef<number | null>(null);

  // -------------------------
  // Local UI & Map States
  // -------------------------
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Consolidated sheet states
  const [sheetMode, setSheetMode] = useState<SheetMode>("none");
  const [sheetMinimized, setSheetMinimized] = useState(false);
  const disableMinimize = bookingStep === 1 || bookingStep === 3;

  // For step transitions or animations if needed
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);

  // Google Maps readiness
  const [googleMapsReady, setGoogleMapsReady] = useState(false);

  // QR Scanner
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Additional optional modals
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  

  // -------------------------
  // Load Google Maps script
  // -------------------------
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

  // Hide spinner when all loaded
  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);

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
      processedCarIdRef,
      removeStation,
      clearQrStationData,
      clearDepartureStation,
      selectDepartureStationAction,
      selectArrivalStation,
      advanceBookingStep,
    ]
  );

  // For StationList usage
  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      pickStationAsDeparture(station.id, false);
    },
    [pickStationAsDeparture]
  );

  // -------------------------
  // 3D overlay
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
    // Optionally hide the sheet while scanning
    setSheetMode("none");
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
  // Locate Me
  // -------------------------
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
        // Force the sheet to show the station list
        setSheetMode("list");
        setSheetMinimized(false);
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
  ]);

  // -------------------------
  // Example confirm logic
  // -------------------------
  const handleStationConfirm = useCallback(() => {
    if (bookingStep === 2) {
      dispatch(advanceBookingStep(3));
      toast.success("Departure confirmed! Now choose your arrival station.");
    }
  }, [bookingStep, dispatch]);

  // -------------------------
  // Which station are we showing in detail?
  // -------------------------
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

// -------------------------
// Render dynamic header content
// -------------------------
const renderSheetHeader = useCallback(() => {
  // 1) If we are in station-list mode, show StationsDisplay in the header.
  if (sheetMode === "list") {
    return (
      <StationsDisplay
        stationsCount={sortedStations.length}
        totalStations={stations.length}
      />
    );
  }

  // 2) If scanning a car and at booking step 2
  if (isQrScanStation && scannedCar && bookingStep === 2) {
    return (
      <CarPlate
        plateNumber={scannedCar.name}
        vehicleModel={scannedCar.model || "Electric Vehicle"}
      />
    );
  }

  // 3) Otherwise, check the booking step
  if (bookingStep === 1) {
    return <PickupGuide isDepartureFlow />;
  } else if (bookingStep === 2) {
    // Example pickup time
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
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

  // 4) Default if none of the above
  return null;
}, [
  sheetMode,
  sortedStations,
  stations,
  isQrScanStation,
  scannedCar,
  bookingStep
]);

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
              Sheet: {sheetMode} {sheetMinimized ? "(minimized)" : ""}<br />
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
              // If you want a simpler approach, do so here.
              // We'll just mimic the locate-me approach:
              setSearchLocation(loc);
              if (googleMapsReady) {
                const sorted = sortStationsByDistanceToPoint(loc, stations);
                setSortedStations(sorted);
              } else {
                setSortedStations(stations);
              }
              setSheetMode("list");
              setSheetMinimized(false);
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
            onLocateMe={handleLocateMe}
            onScan={handleOpenQrScanner}
            isQrScanStation={isQrScanStation}
            virtualStationId={virtualStationId}
            scannedCar={scannedCar}
          />

          {/* The single sheet for both list & detail */}
          <Sheet
            isOpen={sheetMode !== "none" && !isStepTransitioning}
            isMinimized={sheetMinimized}
            onMinimize={() => setSheetMinimized(true)}
            onExpand={() => setSheetMinimized(false)}
            onDismiss={() => setSheetMode("none")}
            disableMinimize={disableMinimize}
            headerContent={
         <div className="flex items-center w-full">
           <div className="flex-1 flex justify-center">
              {renderSheetHeader()}
          </div>

      {bookingStep !== 1 && bookingStep !== 3 && (
        sheetMinimized ? (
          /* If minimized, show Maximize2 icon to restore */
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-200"
            onClick={() => { if (!disableMinimize) setSheetMinimized(false); }}
          >
            <Maximize2 size={20} />
          </button>
        ) : (
          /* If expanded, show Minimize2 icon to collapse */
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-200"
            onClick={() => { if (!disableMinimize) setSheetMinimized(true); }}
          >
            <Minimize2 size={20} />
          </button>
        )
      )}
    </div>
            }
          >
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
            />
            )}
          </Sheet>

          {/* QR Scanner Overlay */}
          <QrScannerOverlay
            isOpen={isQrScannerOpen}
            onClose={() => {
              setIsQrScannerOpen(false);
            }}
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