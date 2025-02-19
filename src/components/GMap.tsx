"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  memo,
  Suspense,
} from "react";
import { GoogleMap, Polyline, Marker, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import { Car, Locate } from "lucide-react";
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
  toggleSheet,
  selectIsSheetMinimized,
} from "@/store/uiSlice";
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
import CarSheet from "@/components/booking/CarSheet";
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

/* ------------------------------------------------------------
   StationMarkers - a memoized component for rendering stations
------------------------------------------------------------ */
interface StationMarkersProps {
  stations: StationFeature[];
  sortedStations: StationFeature[];
  searchLocation: google.maps.LatLngLiteral | null;
  departureStationId: number | null;
  arrivalStationId: number | null;
  markerIcons: any;
  onStationClick: (station: StationFeature) => void;
}

const StationMarkers = memo(function StationMarkers(props: StationMarkersProps) {
  const {
    stations,
    sortedStations,
    searchLocation,
    departureStationId,
    arrivalStationId,
    markerIcons,
    onStationClick,
  } = props;

  // If the user searched an address, show that sorted list first
  const listToRender = searchLocation ? sortedStations : stations;

  return (
    <>
      {listToRender.map((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const isDeparture = station.id === departureStationId;
        const isArrival = station.id === arrivalStationId;

        const icon = (() => {
          if (!markerIcons) return undefined;
          if (isDeparture) return markerIcons.departureStation;
          if (isArrival) return markerIcons.arrivalStation;
          return markerIcons.station;
        })();

        return (
          <Marker
            key={station.id}
            position={{ lat, lng }}
            icon={icon}
            onClick={() => onStationClick(station)}
          />
        );
      })}
    </>
  );
});

/* ------------------------------------------------------------
   CarMarkers - a memoized component for rendering cars
------------------------------------------------------------ */
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

/* ------------------------------------------------------------
   GMap - main map component
------------------------------------------------------------ */
interface GMapProps {
  googleApiKey: string;
}

type OpenSheetType = "none" | "car" | "list" | "detail";

const GaussianSplatModal = dynamic(() => import("@/components/GaussianSplatModal"), {
  suspense: true,
});

export default function GMap({ googleApiKey }: GMapProps) {
  const dispatch = useAppDispatch();

  // Local load states
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [isSheetReady, setIsSheetReady] = useState(false);

  // Local states for map + markers
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  // Bottom sheet states
  const [openSheet, setOpenSheet] = useState<OpenSheetType>("car");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);

  // Redux store data
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);

  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);

  const stations3D = useAppSelector(selectStations3D);
  const userLocation = useAppSelector(selectUserLocation);

  // Booking-related
  const bookingStep = useAppSelector(selectBookingStep);
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);
  const route = useAppSelector(selectRoute);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  const sheetMinimized = useAppSelector(selectIsSheetMinimized);

  // Google Maps Loader
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

  // 3D Overlay logic
  const { overlayRef, stationCubesRef } = useThreeOverlay(
    actualMap,
    stations,
    departureStationId,
    arrivalStationId
  );

  // Station click => set departure/arrival => open detail
  const handleStationClick = useCallback(
    (station: StationFeature) => {
      if (bookingStep === 1) {
        dispatch(selectDepartureStation(station.id));
        dispatch(advanceBookingStep(2));
        toast.success("Departure station selected! (Confirm in station detail.)");
      } else if (bookingStep === 2) {
        dispatch(selectDepartureStation(station.id));
        toast.success("Departure station re-selected! (Confirm in station detail.)");
      } else if (bookingStep === 3) {
        dispatch(selectArrivalStation(station.id));
        dispatch(advanceBookingStep(4));
        toast.success("Arrival station selected! (Confirm in station detail.)");
      } else if (bookingStep === 4) {
        dispatch(selectArrivalStation(station.id));
        toast.success("Arrival station re-selected! (Confirm in station detail.)");
      } else {
        toast(`Station clicked, but no action—already at step ${bookingStep}`);
      }

      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setPreviousSheet("none");

      if (sheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [bookingStep, sheetMinimized, dispatch]
  );

  // 1) Initialize map config once loaded
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // 2) Fetch data
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

  // 3) Once data is done loading => hide spinner + set isSheetReady
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
      setIsSheetReady(true);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // 4) 3D Overlay Raycasting
  useEffect(() => {
    if (!overlayRef.current || !stationCubesRef.current || !actualMap) return;
    const overlay = overlayRef.current;

    const intervalId = setInterval(() => {
      const renderer = (overlay as any).renderer;
      const camera = (overlay as any).camera;
      if (renderer && camera) {
        clearInterval(intervalId);

        const mapDiv = actualMap.getDiv();
        const mousePosition = new THREE.Vector2();

        // Track mouse move
        actualMap.addListener("mousemove", (ev: google.maps.MapMouseEvent) => {
          const domEvent = ev.domEvent as MouseEvent;
          const { left, top, width, height } = mapDiv.getBoundingClientRect();
          const x = domEvent.clientX - left;
          const y = domEvent.clientY - top;
          mousePosition.x = (2 * x) / width - 1;
          mousePosition.y = 1 - (2 * y) / height;
          overlay.requestRedraw();
        });

        overlay.onBeforeDraw = () => {
          const intersections = overlay.raycast(mousePosition, stationCubesRef.current, {
            recursive: true,
          });
          if (intersections.length === 0) {
            actualMap.setOptions({ draggableCursor: null });
          }
        };

        // Map click for 3D cubes
        actualMap.addListener("click", (ev: google.maps.MapMouseEvent) => {
          const domEvent = ev.domEvent as MouseEvent;
          const { left, top, width, height } = mapDiv.getBoundingClientRect();
          mousePosition.x = (2 * (domEvent.clientX - left)) / width - 1;
          mousePosition.y = 1 - (2 * (domEvent.clientY - top)) / height;

          const intersections = overlay.raycast(mousePosition, stationCubesRef.current, {
            recursive: true,
          });
          if (intersections.length > 0) {
            const clickedStation = intersections[0].object.userData.station;
            if (clickedStation) {
              handleStationClick(clickedStation);
            }
          }
        });
      }
    }, 300);

    return () => clearInterval(intervalId);
  }, [overlayRef, stationCubesRef, actualMap, handleStationClick]);

  // 5) If there's an error, display
  const stationsErrorOrCarsError = stationsError || carsError;
  const hasError = stationsErrorOrCarsError || loadError;
  if (hasError) {
    return (
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
    );
  }

  // 6) Auto-fetch user’s route (departure->arrival)
  useEffect(() => {
    if (departureStationId && arrivalStationId) {
      const departureStation = stations.find((s) => s.id === departureStationId);
      const arrivalStation = stations.find((s) => s.id === arrivalStationId);
      if (departureStation && arrivalStation) {
        dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
      }
    }
  }, [departureStationId, arrivalStationId, stations, dispatch]);

  // 7) Fetch dispatch->departure route (only clear if none)
  useEffect(() => {
    if (!departureStationId) {
      dispatch(clearDispatchRoute());
      return;
    }
    const departureStation = stations.find((s) => s.id === departureStationId);
    if (departureStation) {
      dispatch(fetchDispatchDirections(departureStation));
    }
  }, [departureStationId, stations, dispatch]);

  // 8) Decode departure->arrival route
  const [decodedPath, setDecodedPath] = useState<google.maps.LatLngLiteral[]>([]);
  const mainRoute = useAppSelector(selectRoute);
  useEffect(() => {
    if (!mainRoute?.polyline || !window.google?.maps?.geometry?.encoding) {
      setDecodedPath([]);
      return;
    }
    const path = google.maps.geometry.encoding.decodePath(mainRoute.polyline);
    setDecodedPath(path.map((latLng) => latLng.toJSON()));
  }, [mainRoute]);

  // 9) Decode dispatch->departure route
  const [decodedDispatchPath, setDecodedDispatchPath] = useState<google.maps.LatLngLiteral[]>([]);
  const mainDispatchRoute = useAppSelector(selectDispatchRoute);
  useEffect(() => {
    if (!mainDispatchRoute?.polyline || !window.google?.maps?.geometry?.encoding) {
      setDecodedDispatchPath([]);
      return;
    }
    const path = google.maps.geometry.encoding.decodePath(mainDispatchRoute.polyline);
    setDecodedDispatchPath(path.map((latLng) => latLng.toJSON()));
  }, [mainDispatchRoute]);

  // 10) Sorting logic for address search
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!google?.maps?.geometry?.spherical) return stationsToSort;
      const newStations = [...stationsToSort];
      return newStations.sort((a, b) => {
        const [lngA, latA] = a.geometry.coordinates;
        const [lngB, latB] = b.geometry.coordinates;
        const distA = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latA, lngA),
          new google.maps.LatLng(point.lat, point.lng)
        );
        const distB = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(latB, lngB),
          new google.maps.LatLng(point.lat, point.lng)
        );
        return distA - distB;
      });
    },
    []
  );

  // 11) Address search => pan/zoom => sort
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!actualMap) return;
      actualMap.panTo(location);
      actualMap.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);

      if (sheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [actualMap, stations, sortStationsByDistanceToPoint, dispatch, sheetMinimized]
  );

  // 12) Clear departure => revert step to 1 + clear dispatch route
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

  // 13) Clear arrival => revert step to 3 + clear route
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

  // 14) Manage bottom sheet states
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

  // 15) 'Locate me'
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

  // 16) 'Open CarSheet'
  const openCarSheet = () => {
    openNewSheet("car");
  };

  // 17) Select station from station list
  const handleStationSelectedFromList = useCallback(
    (station: StationFeature) => {
      // reading bookingStep from top-level, not inside callback
      if (bookingStep === 1 || bookingStep === 2) {
        dispatch(selectDepartureStation(station.id));
        if (bookingStep === 1) {
          dispatch(advanceBookingStep(2));
        }
        toast.success("Departure station selected!");
      } else if (bookingStep === 3 || bookingStep === 4) {
        dispatch(selectArrivalStation(station.id));
        if (bookingStep === 3) {
          dispatch(advanceBookingStep(4));
        }
        toast.success("Arrival station selected!");
      } else {
        toast(`Selected station but no step update (current: ${bookingStep})`);
      }

      setDetailKey((prev) => prev + 1);
      setForceSheetOpen(true);
      setOpenSheet("detail");
      setPreviousSheet("none");
    },
    [bookingStep, dispatch]
  );

  // 18) Station detail logic
  const hasStationSelected = bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = hasStationSelected
    ? stations.find((s) => s.id === hasStationSelected)
    : null;

  // 19) If still loading data or map => spinner
  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  // 20) Only render the sheets if isSheetReady is true
  const isCarOpen = openSheet === "car";
  const isListOpen = openSheet === "list";
  const isDetailOpen = (openSheet === "detail" || forceSheetOpen) && !!stationToShow;

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Main Google Map */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={mapOptions || {}}
          onLoad={(map) => {
            setActualMap(map);
            // Fit bounds to all stations if we have them
            if (stations.length > 0) {
              const bounds = new google.maps.LatLngBounds();
              stations.forEach((station) => {
                const [lng, lat] = station.geometry.coordinates;
                bounds.extend({ lat, lng });
              });
              map.fitBounds(bounds, 50);
            }
          }}
        >
          {/* DispatchHub->Departure polylines */}
          {decodedDispatchPath.length > 0 && (
            <>
              <Polyline path={decodedDispatchPath} options={DISPATCH_ROUTE_LINE_OPTIONS_SHADOW} />
              <Polyline path={decodedDispatchPath} options={DISPATCH_ROUTE_LINE_OPTIONS_FOREGROUND} />
            </>
          )}

          {/* Departure->Arrival polylines */}
          {decodedPath.length > 0 && (
            <>
              <Polyline path={decodedPath} options={ROUTE_LINE_OPTIONS_SHADOW} />
              <Polyline path={decodedPath} options={ROUTE_LINE_OPTIONS_FOREGROUND} />
            </>
          )}

          {/* Memoized Station Markers */}
          <StationMarkers
            stations={stations}
            sortedStations={sortedStations}
            searchLocation={searchLocation}
            departureStationId={departureStationId}
            arrivalStationId={arrivalStationId}
            markerIcons={markerIcons}
            onStationClick={handleStationClick}
          />

          {/* Memoized Car Markers */}
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

      {/* StationSelector overlay */}
      <StationSelector
        onAddressSearch={handleAddressSearch}
        onClearDeparture={handleClearDepartureInSelector}
        onClearArrival={handleClearArrivalInSelector}
      />

      {/* Top-left buttons */}
      <div className="absolute top-[120px] left-4 z-30 flex flex-col space-y-2">
        <button
          onClick={handleLocateMe}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow"
        >
          <Locate className="w-5 h-5" />
        </button>

        <button
          onClick={openCarSheet}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow"
        >
          <Car className="w-5 h-5" />
        </button>
      </div>

      {/* Conditionally render the bottom sheets only if isSheetReady */}
      {isSheetReady && (
        <>
          {/* Car Sheet */}
          <CarSheet isOpen={isCarOpen} />

          {/* Station list sheet */}
          <Sheet
            isOpen={isListOpen}
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

          {/* Station detail sheet */}
          <Sheet
            key={detailKey}
            isOpen={isDetailOpen}
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
        </>
      )}

      {/* GaussianSplatModal */}
      <Suspense fallback={<div>Loading modal...</div>}>
        {isSplatModalOpen && (
          <GaussianSplatModal
            isOpen={isSplatModalOpen}
            onClose={() => setIsSplatModalOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}
