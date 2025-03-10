"use client";

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  memo,
  Suspense,
} from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import * as THREE from "three";
import dynamic from "next/dynamic";

// Redux & store hooks
import { useAppDispatch, useAppSelector } from "@/store/store";

// Slices
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

// Import your SignInModal
import SignInModal from "@/components/ui/SignInModal";

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

// Import our Google Maps utility
import { ensureGoogleMapsLoaded } from "@/lib/googleMaps";
import { addVirtualCarStation } from "@/lib/stationUtils";

// Lazy-load GaussianSplatModal
const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

type OpenSheetType = "none" | "car" | "list" | "detail";

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();

  // --------------------------
  // Local States
  // --------------------------
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("car");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  
  // QR code related states
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [virtualStationId, setVirtualStationId] = useState<number | null>(null);
  const [isQrScanStation, setIsQrScanStation] = useState(false);

  // We still keep the GaussianSplatModal logic if needed
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);

  // Sign-in modal
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // --------------------------
  // Redux States
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

  // Booking route decode
  const decodedPath = useAppSelector(selectRouteDecoded);

  // Dispatch route (raw + decoded)
  const dispatchRoute = useAppSelector(selectDispatchRoute);
  const decodedDispatchPath = useAppSelector(selectDispatchRouteDecoded);

  // Load Google Maps script
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

  // Ensure Google Maps is loaded and ready for our utilities
  useEffect(() => {
    if (isLoaded) {
      // Give a small delay to ensure the API is fully initialized
      const timer = setTimeout(async () => {
        try {
          await ensureGoogleMapsLoaded();
          setGoogleMapsReady(true);
        } catch (error) {
          console.error("Failed to ensure Google Maps is loaded:", error);
          toast.error("Map services unavailable. Please refresh the page.");
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // 3D overlay for stations & cars
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

  // Keep booking step in a ref to avoid stale closures
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => {
    bookingStepRef.current = bookingStep;
  }, [bookingStep]);

    // --------------------------
  // Sorting logic
  // --------------------------
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!googleMapsReady || !window.google?.maps?.geometry?.spherical) return stationsToSort;
      
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
// QR Scan Success Handler
// --------------------------
const handleQrScanSuccess = useCallback(() => {
  // This will be called when QR scan is successful
  if (scannedCar) {
    console.log('QR Scan Success, scannedCar ID:', scannedCar.id, 'isVirtualCarLocation being set');
    
    // Create a virtual station ID based on car ID
    const vStationId = 1000000 + scannedCar.id;
    setVirtualStationId(vStationId);
    setIsQrScanStation(true);
    
    // Explicitly create and add a virtual station to the stations list
    const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
    
    // Add it to stations if it doesn't exist
    const existingVirtualStation = stations.find(s => s.id === vStationId);
    let updatedStations = stations;
    
    if (!existingVirtualStation) {
      updatedStations = addVirtualCarStation(stations, scannedCar, vStationId);
    }
    
    // Sort these stations if we have a location
    if (userLocation) {
      const sorted = sortStationsByDistanceToPoint(userLocation, updatedStations);
      setSortedStations(sorted);
    } else {
      setSortedStations(updatedStations);
    }
    
    // Force open the detail panel (important for QR flow)
    setDetailKey((prev) => prev + 1);
    setForceSheetOpen(true);
    setOpenSheet("detail");
    
    // If the map is loaded, center it on the car's position
    if (actualMap) {
      actualMap.panTo({
        lat: scannedCar.lat,
        lng: scannedCar.lng
      });
      actualMap.setZoom(16);
    }
    
    console.log('Sheet should be opening with key:', detailKey + 1);
  }
}, [scannedCar, stations, userLocation, sortStationsByDistanceToPoint, actualMap, detailKey]);

// Modify the useEffect that watches for scanned car changes
useEffect(() => {
  if (scannedCar && bookingStep === 2) {
    console.log('Scanned car detected in step 2, setting up virtual station');
    
    // Create a virtual station ID
    const vStationId = 1000000 + scannedCar.id;
    setVirtualStationId(vStationId);
    setIsQrScanStation(true);
    
    // Create the virtual station
    const virtualStation = createVirtualStationFromCar(scannedCar, vStationId);
    
    // Check if this virtual station already exists
    const existingVirtualStation = stations.find(s => s.id === vStationId);
    let updatedStations = stations;
    
    if (!existingVirtualStation) {
      updatedStations = [...stations, virtualStation];
    }
    
    // Sort these stations if we have a location
    if (userLocation) {
      const sorted = sortStationsByDistanceToPoint(userLocation, updatedStations);
      setSortedStations(sorted);
    } else {
      setSortedStations(updatedStations);
    }
    
    // Open detail panel with a forced delay to ensure state is updated
    setTimeout(() => {
      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      
      // If the map is loaded, center it on the car's position
      if (actualMap) {
        actualMap.panTo({
          lat: scannedCar.lat,
          lng: scannedCar.lng
        });
        actualMap.setZoom(16);
      }
      
      console.log('Detail sheet scheduled to open for scanned car after delay');
    }, 200);
  }
}, [scannedCar, virtualStationId, stations, userLocation, sortStationsByDistanceToPoint, bookingStep, actualMap]);

  // --------------------------
  // Station selection logic
  // --------------------------
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      if (bookingStepRef.current === 1) {
        dispatch(selectDepartureStation(station.id));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected!");
      } else if (bookingStepRef.current === 2) {
        dispatch(selectDepartureStation(station.id));
        toast.success("Departure station re-selected!");
      } else if (bookingStepRef.current === 3) {
        dispatch(selectArrivalStation(station.id));
        dispatch(advanceBookingStep(4));
        toast.success("Arrival station selected!");
      } else if (bookingStepRef.current === 4) {
        dispatch(selectArrivalStation(station.id));
        toast.success("Arrival station re-selected!");
      } else {
        toast(`Station clicked, but no action—already at step ${bookingStepRef.current}`);
      }

      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setPreviousSheet("none");
    },
    [dispatch]
  );

  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      handleStationSelection(station);
    },
    [handleStationSelection]
  );

  // --------------------------
  // Raycast on map click for station picking
  // --------------------------
  useEffect(() => {
    if (!actualMap || !overlayRef.current) return;
    
    const clickListener = actualMap.addListener("click", (ev: google.maps.MapMouseEvent) => {
      const overlayAny = overlayRef.current as any;
      if (!overlayAny?.raycast || !overlayAny?.camera) return;
      const domEvent = ev.domEvent;
      if (!domEvent || !(domEvent instanceof MouseEvent)) return;

      // Convert the click to normalized device coords
      const mapDiv = actualMap.getDiv();
      const { left, top, width, height } = mapDiv.getBoundingClientRect();
      const mouseX = domEvent.clientX - left;
      const mouseY = domEvent.clientY - top;
      const mouseVec = new THREE.Vector2(
        (2 * mouseX) / width - 1,
        1 - (2 * mouseY) / height
      );

      // Build array of InstancedMesh objects to test
      const objectsToTest: THREE.Object3D[] = [];
      if (greyInstancedMeshRef.current) objectsToTest.push(greyInstancedMeshRef.current);
      if (blueInstancedMeshRef.current) objectsToTest.push(blueInstancedMeshRef.current);
      if (redInstancedMeshRef.current) objectsToTest.push(redInstancedMeshRef.current);

      // Perform the raycast
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
    handleStationSelection,
  ]);

  // --------------------------
  // Load icons / map options
  // --------------------------
  useEffect(() => {
    if (isLoaded && googleMapsReady && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded, googleMapsReady]);

  // --------------------------
  // Fetch data (stations + cars)
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

  // Once loaded, hide the spinner overlay
  useEffect(() => {
    if (isLoaded && googleMapsReady && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, googleMapsReady, stationsLoading, carsLoading]);

  // --------------------------
  // Booking route logic - Only trigger once Google Maps is fully loaded
  // --------------------------
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

  // --------------------------
  // Dispatch route logic - Only trigger once Google Maps is fully loaded
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
  // Handle address search
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
      }
    },
    [actualMap, stations, openSheet, sortStationsByDistanceToPoint, googleMapsReady]
  );

  // --------------------------
  // Clear station logic
  // --------------------------
  const handleClearDepartureInSelector = () => {
    dispatch(clearDepartureStation());
    dispatch(advanceBookingStep(1));
    dispatch(clearDispatchRoute());
    
    // Clear QR scan station flag if set
    if (isQrScanStation) {
      setIsQrScanStation(false);
      setVirtualStationId(null);
    }
    
    toast.success("Departure station cleared. (Back to selecting departure.)");
    if (openSheet === "detail") {
      setOpenSheet("none");
      setPreviousSheet("none");
    }
  };

  const handleClearArrivalInSelector = () => {
    dispatch(clearArrivalStation());
    dispatch(advanceBookingStep(3));
    dispatch(clearRoute());
    toast.success("Arrival station cleared. (Back to selecting arrival.)");
    if (openSheet === "detail") {
      setOpenSheet("none");
      setPreviousSheet("none");
    }
  };

  // --------------------------
  // Helpers to open/close sheets
  // --------------------------
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

  // --------------------------
  // Geolocation
  // --------------------------
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    
    // Show loading toast
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
  };

  // Derived error state
  const hasError = stationsError || carsError || loadError;

  // Identify which station to show in "detail" view
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = hasStationSelected
    ? stations.find((s) => s.id === hasStationSelected)
    : null;

  // Format time
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const minutesStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minutesStr}${ampm}`;
  };

  // Sheet Title
  const getSheetTitle = useCallback(() => {
    if (!stationToShow) return "";
    
    // Special title for QR scanned car
    if (isQrScanStation && bookingStep <= 2) {
      return "Start your trip";
    }
    
    if (bookingStep <= 2) {
      if (dispatchRoute?.duration) {
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
        const arrivalTimeEnd = new Date(arrivalTime.getTime() + 15 * 60 * 1000);
        return `Pickup car at ${formatTime(arrivalTime)}-${formatTime(arrivalTimeEnd)}`;
      }
      return "Pick-up station";
    }
    return "Trip details";
  }, [bookingStep, dispatchRoute, stationToShow, isQrScanStation]);

  // Sheet Subtitle
  const getSheetSubtitle = useCallback(() => {
    if (!stationToShow) return "";
    
    // Special subtitle for QR scanned car
    if (isQrScanStation && bookingStep <= 2) {
      return "Car is ready at your current location";
    }
    
    if (bookingStep <= 2) {
      return "Your car will be delivered here";
    } else if (bookingStep === 4) {
      return (
        <span>
          Starting fare: <strong className="text-white">HKD $50.00</strong> • $1 / min hereafter
        </span>
      );
    }
    return "Return the car at your arrival station";
  }, [bookingStep, stationToShow, isQrScanStation]);

  // Open sign-in when user tries to confirm trip but isn't signed in
  const handleOpenSignIn = () => {
    setSignInModalOpen(true);
  };

  // Open QR scanner
  const handleOpenQrScanner = useCallback(() => {
    setIsQrScannerOpen(true);
  }, []);

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
          {/* GoogleMap container */}
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
              {/* Car markers are in 3D overlay */}
            </GoogleMap>
          </div>

          {/* Station Selector Overlay */}
          <StationSelector
            onAddressSearch={handleAddressSearch}
            onClearDeparture={handleClearDepartureInSelector}
            onClearArrival={handleClearArrivalInSelector}
            onLocateMe={handleLocateMe}
            onScan={handleOpenQrScanner}
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
                    dispatchRoute: dispatchRoute,
                  }}
                />
              ))}
            </div>
          </Sheet>

         {/* Station Detail Sheet */}
          <Sheet
            key={detailKey}
            isOpen={(openSheet === "detail" || forceSheetOpen) && !!stationToShow}
            onDismiss={() => {
              requestAnimationFrame(() => {
                closeCurrentSheet();
                if (overlayRef.current?.requestRedraw) {
                  overlayRef.current.requestRedraw();
                }
              });
            }}
            title={getSheetTitle()}
            subtitle={getSheetSubtitle()}
          >
            {stationToShow && (
              <StationDetail
                key={detailKey}
                stations={searchLocation ? sortedStations : stations}
                activeStation={stationToShow}
                onOpenSignIn={handleOpenSignIn}
                onDismiss={closeCurrentSheet}
                isQrScanStation={isQrScanStation}
              />
            )}
          </Sheet>

          {/* QR Scanner Overlay */}
          <QrScannerOverlay
            isOpen={isQrScannerOpen}
            onClose={() => setIsQrScannerOpen(false)}
            onScanSuccess={handleQrScanSuccess}
          />

          {/* GaussianSplatModal (still here if needed) */}
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
