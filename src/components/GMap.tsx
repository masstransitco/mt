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
import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
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
import {
  createVirtualStationFromCar,
} from "@/lib/stationUtils";

// Lazy‐load GaussianSplatModal
const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

type OpenSheetType = "none" | "car" | "list" | "detail";

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

  // Steps for bottom sheets
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("car");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);

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

  // Decode route from booking
  const decodedPath = useAppSelector(selectRouteDecoded);
  // Decode dispatch route
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

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

  // Keep booking step in a ref
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => {
    bookingStepRef.current = bookingStep;
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

  // QR scan success => create a virtual station
  const handleQrScanSuccess = useCallback(() => {
    if (scannedCar) {
      console.log("QR Scan Success, scannedCar ID:", scannedCar.id);

      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);

      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);

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

      setDetailKey(Date.now());
      setForceSheetOpen(true);
      setOpenSheet("detail");

      if (actualMap) {
        actualMap.panTo({ lat: scannedCar.lat, lng: scannedCar.lng });
        actualMap.setZoom(16);
      }
      console.log("Sheet opening with virtual station:", vStationId);
    }
  }, [
    scannedCar,
    stations,
    userLocation,
    sortStationsByDistanceToPoint,
    actualMap
  ]);

  // If user scanned a car in step=2 => auto setup
  useEffect(() => {
    if (scannedCar && bookingStep === 2) {
      console.log("Scanned car in step 2, setting up virtual station...");

      const vStationId = 1000000 + scannedCar.id;
      setVirtualStationId(vStationId);
      setIsQrScanStation(true);

      const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);

      const existingIndex = stations.findIndex((s) => s.id === vStationId);
      const updatedStations = [...stations];
      if (existingIndex >= 0) {
        updatedStations[existingIndex] = virtualStation;
      } else {
        updatedStations.push(virtualStation);
      }

      if (userLocation) {
        const sorted = sortStationsByDistanceToPoint(userLocation, updatedStations);
        setSortedStations(sorted);
      } else {
        setSortedStations(updatedStations);
      }

      setTimeout(() => {
        if (bookingStepRef.current === 2) {
          setDetailKey(Date.now());
          setForceSheetOpen(true);
          setOpenSheet("detail");
          if (actualMap) {
            actualMap.panTo({ lat: scannedCar.lat, lng: scannedCar.lng });
            actualMap.setZoom(16);
          }
          console.log("Detail sheet opened after short delay for scanned car.");
        }
      }, 300);
    }
  }, [
    scannedCar,
    stations,
    userLocation,
    bookingStep,
    actualMap,
    sortStationsByDistanceToPoint
  ]);

  // Station selection logic
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      const stepNow = bookingStepRef.current;

      // If we are in a QR-based departure station & user picks a different station for departure,
      // only reset if we're still in step ≤2 (haven't locked in).
      if (
        isQrScanStation &&
        station.id !== virtualStationId &&
        stepNow <= 2
      ) {
        console.log("User switching from QR-based station to normal => reset QR flow");
        dispatch(clearDepartureStation());
        dispatch(setScannedCar(null));
        setIsQrScanStation(false);
        setVirtualStationId(null);
        dispatch(advanceBookingStep(1));
      }

      // Now proceed with normal station selection
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
    }}, [isLoaded, googleMapsReady]);

    // Fetch data
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
  
    // Booking route logic
    useEffect(() => {
      if (!googleMapsReady) return;
  
      if (departureStationId && arrivalStationId) {
        const departureStation = stations.find((s) => s.id === departureStationId);
        const arrivalStation = stations.find((s) => s.id === arrivalStationId);
        if (departureStation && arrivalStation) {
          dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
        }
      }
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
  
      toast.success("Departure station cleared. (Back to selecting departure.)");
      if (openSheet === "detail") {
        setOpenSheet("none");
        setPreviousSheet("none");
      }
    }, [dispatch, openSheet, isQrScanStation]);
  
    const handleClearArrivalInSelector = useCallback(() => {
      dispatch(clearArrivalStation());
      dispatch(advanceBookingStep(3));
      dispatch(clearRoute());
      toast.success("Arrival station cleared. (Back to selecting arrival.)");
      if (openSheet === "detail") {
        setOpenSheet("none");
        setPreviousSheet("none");
      }
    }, [dispatch, openSheet]);
  
    // Helpers for opening/closing sheets
    const openNewSheet = (newSheet: OpenSheetType) => {
      if (newSheet !== "detail") {
        setForceSheetOpen(false);
      }
      if (openSheet !== newSheet) {
        setPreviousSheet(openSheet);
        setOpenSheet(newSheet);
      }
    };
  
    const closeCurrentSheet = () => {
      if (openSheet === "detail") {
        setOpenSheet("none");
        setPreviousSheet("none");
        setForceSheetOpen(false);
        overlayRef.current?.requestRedraw();
      } else {
        setOpenSheet(previousSheet);
        setPreviousSheet("none");
      }
    };
  
    // Close detail sheet
    const handleStationDetailClose = useCallback(() => {
      // If it was a QR station, reset user to step=1 if we haven't locked in
      if (isQrScanStation) {
        console.log("Dismissing a QR-scanned station => clearing station + step=1");
        dispatch(clearDepartureStation());
        dispatch(setScannedCar(null));
        setIsQrScanStation(false);
        setVirtualStationId(null);
  
        toast("Scan the car's QR code again if you want to select this vehicle", {
          duration: 4000,
          position: "bottom-center",
          icon: "ℹ️",
          style: { background: "#3b82f6", color: "#ffffff" },
        });
      } else {
        console.log("Dismissing a normal station => do not discard station");
      }
      closeCurrentSheet();
    }, [isQrScanStation, closeCurrentSheet, dispatch]);
  
    // QR scanner open
    const handleOpenQrScanner = useCallback(() => {
      setIsQrScannerOpen(true);
    }, []);
  
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
  
    // Any error?
    const hasError = stationsError || carsError || loadError;
  
    // Which station are we focusing on in step≥3 (arrival) or step≤2 (departure)
    const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;
  
    // Compute stationToShow
    let stationToShow: StationFeature | null = null;
    if (
      hasStationSelected &&
      isQrScanStation &&
      virtualStationId === hasStationSelected
    ) {
      console.log("Virtual station match => using scannedCar station");
      if (scannedCar && virtualStationId !== null) {
        stationToShow = createVirtualStationFromCar(scannedCar, virtualStationId);
      }
    } else {
      // normal station
      const stationsToSearch = sortedStations.length > 0 ? sortedStations : stations;
      stationToShow = stationsToSearch.find((s) => s.id === hasStationSelected) ?? null;
    }
  
    // For step 2, we need the pickup time range for the PickupTime component
    const getPickupTimeRange = useCallback(() => {
      const now = new Date();
      let startTime: Date, endTime: Date;
      
      if (dispatchRoute?.duration) {
        // If we have a dispatch route, calculate arrival time based on that
        startTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
        endTime = new Date(startTime.getTime() + 15 * 60 * 1000); // 15 min window
      } else {
        // Fallback values (now + 15min window)
        startTime = new Date(now.getTime() + 5 * 60 * 1000);
        endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
      }
      
      return { startTime, endTime };
    }, [dispatchRoute]);
  
    // Sign In
    const handleOpenSignIn = useCallback(() => {
      setSignInModalOpen(true);
    }, []);
  
    // Custom Sheet Content for each step
    const renderSheetContent = useCallback(() => {
      // Determine if we need to show custom content in the sheet header
      if (bookingStep === 2) {
        // Step 2: Show pickup time
        const { startTime, endTime } = getPickupTimeRange();
        return <PickupTime startTime={startTime} endTime={endTime} />;
      } else if (bookingStep === 4) {
        // Step 4: Show fare display
        return <FareDisplay baseFare={50.00} currency="HKD" perMinuteRate={1} />;
      }
      
      // Default: empty (no custom header content)
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
              isOpen={openSheet === "list"}
              onDismiss={closeCurrentSheet}
              title="Nearby Stations"
              count={sortedStations.length}
            >
              <div className="space-y-2 overflow-y-auto max-h-[60vh] px-4 py-2">
                {sortedStations.map((station, idx) => (
                  <StationListItem
                    key={station.id}
                    index={idx}
                    style={{}}
                    data={{
                      items: sortedStations,
                      onStationSelected: handleStationSelectedFromList,
                      departureId: departureStationId,
                      arrivalId: arrivalStationId,
                      dispatchRoute,
                    }}
                  />
                ))}
              </div>
            </Sheet>
  
            {/* Station Detail Sheet with custom header content */}
            <Sheet
  key={detailKey}
  isOpen={(openSheet === "detail" || forceSheetOpen) && !!stationToShow}
  onDismiss={handleStationDetailClose}
  title={bookingStep <= 2 ? "Pickup car" : ""} 
  headerContent={renderSheetContent()} // Use headerContent prop to place content above pulsating strip
>
  {stationToShow && (
    <StationDetail
      key={detailKey}
      stations={searchLocation ? sortedStations : stations}
      activeStation={stationToShow}
      onOpenSignIn={handleOpenSignIn}
      onDismiss={closeCurrentSheet}
      isQrScanStation={isQrScanStation}
      onClose={handleStationDetailClose}
    />
  )}
</Sheet>
  
            {/* QR Scanner */}
            <QrScannerOverlay
              isOpen={isQrScannerOpen}
              onClose={() => setIsQrScannerOpen(false)}
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