"use client";

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  memo,
  Suspense,
} from "react";
import {
  GoogleMap,
  Polyline,
  Marker,
  useJsApiLoader,
  LatLngLiteral,
} from "@react-google-maps/api";
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
  selectRoute,
  clearRoute,
  selectDepartureStationId,
  selectArrivalStationId,
  selectDepartureStation,
  selectArrivalStation,
  clearDepartureStation,
  clearArrivalStation,
} from "@/store/bookingSlice";
import {
  fetchStations3D,
  selectStations3D,
} from "@/store/stations3DSlice";
import {
  fetchDispatchDirections,
  selectDispatchRoute,
  clearDispatchRoute,
} from "@/store/dispatchSlice";

// UI Components
import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import StationDetail from "./StationDetail";
import { StationListItem } from "./StationListItem";

// Map / 3D constants & hooks
import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
  ROUTE_LINE_OPTIONS_SHADOW,
  ROUTE_LINE_OPTIONS_FOREGROUND,
  DISPATCH_ROUTE_LINE_OPTIONS_SHADOW,
  DISPATCH_ROUTE_LINE_OPTIONS_FOREGROUND,
} from "@/constants/map";
import { useThreeOverlay } from "@/hooks/useThreeOverlay";

interface CarMarkersProps {
  cars: { id: number; lat: number; lng: number; name: string }[];
  markerIcons: any;
}

const CarMarkers = memo(function CarMarkers({ cars, markerIcons }: CarMarkersProps) {
  if (!markerIcons) return null;
  return (
    <>
      {cars.map((car) => (
        <Marker
          key={car.id}
          position={{ lat: car.lat, lng: car.lng }}
          icon={markerIcons.car}
          title={car.name}
        />
      ))}
    </>
  );
});

const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

type OpenSheetType = "none" | "car" | "list" | "detail";

interface GMapProps {
  googleApiKey: string;
}

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();

  // Local State
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("car");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);

  // Redux State
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const userLocation = useAppSelector(selectUserLocation);
  const stations3D = useAppSelector(selectStations3D);
  const bookingStep = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const route = useAppSelector(selectRoute);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

  const { overlayRef, stationCubesRef } = useThreeOverlay(
    actualMap,
    stations,
    departureStationId,
    arrivalStationId
  );

  // --- Use a ref for the current booking step so our event handlers remain stable ---
  const bookingStepRef = useRef(bookingStep);
  useEffect(() => {
    bookingStepRef.current = bookingStep;
  }, [bookingStep]);

  // --- Unified station selection using the ref ---
  const handleStationSelection = useCallback(
    (station: StationFeature) => {
      // Use bookingStepRef.current to get the latest value
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
        toast.info(`Station clicked, but no action—already at step ${bookingStepRef.current}`);
      }
      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setPreviousSheet("none");
    },
    [dispatch]
  );

  // Map click handler
  const handleStationClick = useCallback(
    (station: StationFeature) => {
      handleStationSelection(station);
    },
    [handleStationSelection]
  );

  // List selection handler
  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      handleStationSelection(station);
    },
    [handleStationSelection]
  );

  // Effects / Data Fetch
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          dispatch(fetchStations()).unwrap(),
          dispatch(fetchStations3D()).unwrap(),
          dispatch(fetchCars()).unwrap(),
        ]);
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load map data");
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // --- 3D Overlay / Raycasting Effect ---
  useEffect(() => {
    if (!overlayRef.current || !stationCubesRef.current || !actualMap) return;

    // Poll for overlay readiness only once
    const intervalId = setInterval(() => {
      const overlayAny = overlayRef.current as any;
      if (overlayAny?.renderer && overlayAny?.camera) {
        clearInterval(intervalId);

        const mapDiv = actualMap.getDiv();
        const mousePosition = new THREE.Vector2();

        // Add a mousemove listener
        const moveListener = actualMap.addListener("mousemove", (ev: google.maps.MapMouseEvent) => {
          const domEvent = ev.domEvent;
          if (!domEvent || !(domEvent instanceof MouseEvent)) return;
          const { left, top, width, height } = mapDiv.getBoundingClientRect();
          const mouseX = domEvent.clientX - left;
          const mouseY = domEvent.clientY - top;
          mousePosition.x = (2 * mouseX) / width - 1;
          mousePosition.y = 1 - (2 * mouseY) / height;
          overlayAny.requestRedraw();
        });

        // Preserve old onBeforeDraw to restore on cleanup
        const oldBeforeDraw = overlayAny.onBeforeDraw;
        overlayAny.onBeforeDraw = () => {
          const intersections = overlayAny.raycast(mousePosition, stationCubesRef.current, { recursive: true });
          if (intersections.length === 0) {
            actualMap.setOptions({ draggableCursor: null });
          }
        };

        // Add a click listener that uses our stable handleStationClick
        const clickListener = actualMap.addListener("click", (ev: google.maps.MapMouseEvent) => {
          const domEvent = ev.domEvent;
          if (!domEvent || !(domEvent instanceof MouseEvent)) return;
          const { left, top, width, height } = mapDiv.getBoundingClientRect();
          const mouseX = domEvent.clientX - left;
          const mouseY = domEvent.clientY - top;
          mousePosition.x = (2 * mouseX) / width - 1;
          mousePosition.y = 1 - (2 * mouseY) / height;
          const intersections = overlayAny.raycast(mousePosition, stationCubesRef.current, { recursive: true });
          if (intersections.length > 0) {
            const clickedStation = intersections[0].object.userData.station;
            if (clickedStation) {
              handleStationClick(clickedStation);
              ev.stop();
            }
          }
        });

        // Cleanup: remove listeners and restore onBeforeDraw
        return () => {
          google.maps.event.removeListener(moveListener);
          google.maps.event.removeListener(clickListener);
          overlayAny.onBeforeDraw = oldBeforeDraw;
        };
      }
    }, 300);

    return () => clearInterval(intervalId);
  }, [overlayRef, stationCubesRef, actualMap]); // no dependency on handleStationClick

  // --- Booking + Dispatch Routes ---
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

  // --- Polyline Decoding ---
  const [decodedPath, setDecodedPath] = useState<LatLngLiteral[]>([]);
  useEffect(() => {
    if (!route?.polyline || !window.google?.maps?.geometry?.encoding) {
      setDecodedPath([]);
      return;
    }
    const path = window.google.maps.geometry.encoding.decodePath(route.polyline);
    setDecodedPath(path.map((latLng) => latLng.toJSON()));
  }, [route]);

  const [decodedDispatchPath, setDecodedDispatchPath] = useState<LatLngLiteral[]>([]);
  useEffect(() => {
    if (!dispatchRoute?.polyline || !window.google?.maps?.geometry?.encoding) {
      setDecodedDispatchPath([]);
      return;
    }
    const path = window.google.maps.geometry.encoding.decodePath(dispatchRoute.polyline);
    setDecodedDispatchPath(path.map((latLng) => latLng.toJSON()));
  }, [dispatchRoute]);

  // --- Station Sorting ---
  const sortStationsByDistanceToPoint = useCallback(
    (point: LatLngLiteral, stationsToSort: StationFeature[]) => {
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

  const handleAddressSearch = useCallback(
    (location: LatLngLiteral) => {
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

  // --- Clear Station Logic ---
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

  // --- Derived State ---
  const hasError = stationsError || carsError || loadError;
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = hasStationSelected
    ? stations.find((s) => s.id === hasStationSelected)
    : null;

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
          <div className="absolute inset-0">
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={userLocation || DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              options={mapOptions || {}}
              onLoad={(map: google.maps.Map) => {
                setActualMap(map);
                if (stations.length > 0) {
                  const bounds = new window.google.maps.LatLngBounds();
                  stations.forEach((station) => {
                    const [lng, lat] = station.geometry.coordinates;
                    bounds.extend({ lat, lng });
                  });
                  map.fitBounds(bounds, 50);
                }
              }}
            >
              {/* DispatchHub→Departure polylines */}
              {decodedDispatchPath.length > 0 && (
                <>
                  <Polyline
                    path={decodedDispatchPath}
                    options={DISPATCH_ROUTE_LINE_OPTIONS_SHADOW}
                  />
                  <Polyline
                    path={decodedDispatchPath}
                    options={DISPATCH_ROUTE_LINE_OPTIONS_FOREGROUND}
                  />
                </>
              )}

              {/* Departure→Arrival polylines */}
              {decodedPath.length > 0 && (
                <>
                  <Polyline
                    path={decodedPath}
                    options={ROUTE_LINE_OPTIONS_SHADOW}
                  />
                  <Polyline
                    path={decodedPath}
                    options={ROUTE_LINE_OPTIONS_FOREGROUND}
                  />
                </>
              )}

              {/* Car Markers */}
              <CarMarkers
                cars={cars.map((c) => ({
                  id: c.id,
                  lat: c.lat,
                  lng: c.lng,
                  name: c.name,
                }))}
                markerIcons={markerIcons}
              />
            </GoogleMap>
          </div>

          {/* Station Selector Overlay */}
          <StationSelector
            onAddressSearch={handleAddressSearch}
            onClearDeparture={handleClearDepartureInSelector}
            onClearArrival={handleClearArrivalInSelector}
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
                  }}
                />
              ))}
            </div>
          </Sheet>

          {/* Station Detail Sheet */}
          <Sheet
            key={detailKey}
            isOpen={(openSheet === "detail" || forceSheetOpen) && !!stationToShow}
            onDismiss={closeCurrentSheet}
            title={bookingStep <= 2 ? "Pick-up station" : "Trip details"}
            subtitle={
              bookingStep <= 2
                ? "Your car will be delivered here"
                : "Return the car at your arrival station"
            }
          >
            {stationToShow && (
              <StationDetail
                key={detailKey}
                stations={searchLocation ? sortedStations : stations}
                activeStation={stationToShow}
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
    </div>
  );
}
