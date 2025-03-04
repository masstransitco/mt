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
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);

  // 1) Track sign-in modal open state
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

    // Setup a single click listener
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
              ev.stop(); // Prevent map from ignoring
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
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

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
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // --------------------------
  // Booking route logic
  // --------------------------
  useEffect(() => {
    if (departureStationId && arrivalStationId) {
      const departureStation = stations.find((s) => s.id === departureStationId);
      const arrivalStation = stations.find((s) => s.id === arrivalStationId);
      if (departureStation && arrivalStation) {
        dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
      }
    }
  }, [departureStationId, arrivalStationId, stations, dispatch]);

  useEffect(() => {
    if (!departureStationId) {
      dispatch(clearDispatchRoute());
      return;
    }
    const depStation = stations.find((s) => s.id === departureStationId);
    if (depStation) {
      dispatch(fetchDispatchDirections(depStation));
    }
  }, [departureStationId, stations, dispatch]);

  // --------------------------
  // Sort stations
  // --------------------------
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!window.google?.maps?.geometry?.spherical) return stationsToSort;
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
    },
    []
  );

  // --------------------------
  // Handle address search
  // --------------------------
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!actualMap) return;
      actualMap.panTo(location);
      actualMap.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);

      if (openSheet !== "list") {
        setPreviousSheet(openSheet);
        setOpenSheet("list");
      }
    },
    [actualMap, stations, openSheet, sortStationsByDistanceToPoint]
  );

  // --------------------------
  // Clear station logic
  // --------------------------
  const handleClearDepartureInSelector = () => {
    dispatch(clearDepartureStation());
    dispatch(advanceBookingStep(1));
    dispatch(clearDispatchRoute());
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

  // This is only called when the X button is clicked to actually close the sheet
  // Our new Sheet component will only call onDismiss when the X button is clicked
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        dispatch(setUserLocation(loc));
        if (actualMap) {
          actualMap.panTo(loc);
          actualMap.setZoom(15);
        }
        const sorted = sortStationsByDistanceToPoint(loc, stations);
        setSearchLocation(loc);
        setSortedStations(sorted);
        openNewSheet("list");
        toast.success("Location found!");
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("Unable to retrieve location.");
      }
    );
  };

  // Derived error state
  const hasError = stationsError || carsError || loadError;

  // Identify which station to show in "detail" view
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = hasStationSelected
    ? stations.find((s) => s.id === hasStationSelected)
    : null;

  // Format time (for the sheet title)
  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const minutesStr = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${minutesStr}${ampm}`;
  };

  // Compute sheet title based on step
  const getSheetTitle = useCallback(() => {
    if (!stationToShow) return "";
    if (bookingStep <= 2) {
      // If there's a dispatchRoute w/ duration
      if (dispatchRoute?.duration) {
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
        const arrivalTimeEnd = new Date(arrivalTime.getTime() + 15 * 60 * 1000);
        return `Pickup car at ${formatTime(arrivalTime)}-${formatTime(arrivalTimeEnd)}`;
      }
      return "Pick-up station";
    }
    return "Trip details";
  }, [bookingStep, dispatchRoute, stationToShow]);

  // Compute sheet subtitle based on step
  const getSheetSubtitle = useCallback(() => {
    if (!stationToShow) return "";
    if (bookingStep <= 2) {
      return "Your car will be delivered here";
    } else if (bookingStep === 4) {
      return (
        <span>
          Starting fare: <strong className="text-white">HKD $50.00</strong> • $1 / min hereafter
        </span>
      );
    } else {
      return "Return the car at your arrival station";
    }
  }, [bookingStep, stationToShow]);

  // 2) StationDetail needs to open sign-in if user not signed in
  const handleOpenSignIn = () => {
    setSignInModalOpen(true);
  };

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
          {/* The GoogleMap container */}
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
              {/* 
                Cars are now rendered in 3D overlay (Three.js),
                so no <CarMarkers> needed here
              */}
            </GoogleMap>
          </div>

          {/* Station Selector Overlay */}
          <StationSelector
            onAddressSearch={handleAddressSearch}
            onClearDeparture={handleClearDepartureInSelector}
            onClearArrival={handleClearArrivalInSelector}
            onLocateMe={handleLocateMe}
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
              // With our updated Sheet, this is only called from the X button
              requestAnimationFrame(() => {
                closeCurrentSheet();
                if (overlayRef.current?.requestRedraw) {
                  overlayRef.current.requestRedraw();
                }
              });
            }}
            onClearSelection={() => {
              // This is the X button handler
              requestAnimationFrame(() => {
                if (bookingStep <= 2) {
                  handleClearDepartureInSelector();
                } else {
                  handleClearArrivalInSelector();
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
                onOpenWalletModal={() => setIsSplatModalOpen(true)}
                onDismiss={() => {
                  // This is only called when the sheet actually needs to close
                  requestAnimationFrame(() => {
                    closeCurrentSheet();
                  });
                }}
                onClearStation={() => {
                  // This is only triggered when we want to clear the station
                  requestAnimationFrame(() => {
                    if (bookingStep <= 2) {
                      handleClearDepartureInSelector();
                    } else {
                      handleClearArrivalInSelector();
                    }
                  });
                }}
              />
            )}
          </Sheet>
          {/* GaussianSplatModal */}
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

      {/* 4) The SignInModal rendered at GMap level */}
      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </div>
  );
}
