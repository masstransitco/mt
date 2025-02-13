"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-hot-toast";
import { Car, Locate } from "lucide-react";

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
} from "@/store/carSlice";
import {
  selectUserLocation,
  setUserLocation,
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
} from "@/store/userSlice";
import { toggleSheet, selectIsSheetMinimized } from "@/store/uiSlice";
import {
  selectBookingStep,
  advanceBookingStep,
  fetchRoute,
} from "@/store/bookingSlice";
import {
  fetchStations3D,
  selectStations3D,
} from "@/store/stations3DSlice";

// UI components
import Sheet from "@/components/ui/sheet";
import StationSelector from "./StationSelector";
import { LoadingSpinner } from "./LoadingSpinner";
import CarSheet from "@/components/booking/CarSheet";
import StationDetail from "./StationDetail";
import { StationListItem } from "./StationListItem";
import GaussianSplatModal from "@/components/GaussianSplatModal";
import TicketOptions from "@/components/booking/TicketOptions"; // <-- Import the new component

// Constants
import {
  LIBRARIES,
  MAP_CONTAINER_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMapOptions,
  createMarkerIcons,
  INTER_CC,
} from "@/constants/map";

// Our custom hook that creates & disposes the Three.js overlay
import { useThreeOverlay } from "@/hooks/useThreeOverlay";

interface GMapProps {
  googleApiKey: string;
}

type OpenSheetType = "none" | "car" | "list" | "detail";

export default function GMap({ googleApiKey }: GMapProps) {
  // We'll store the map in a piece of state so that once it's non-null,
  // React re-renders and the hook sees a valid map object.
  const [actualMap, setActualMap] = useState<google.maps.Map | null>(null);

  // Local UI states
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [searchLocation, setSearchLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [sortedStations, setSortedStations] = useState<StationFeature[]>([]);
  const [mapOptions, setMapOptions] = useState<google.maps.MapOptions | null>(null);
  const [markerIcons, setMarkerIcons] = useState<any>(null);

  const [openSheet, setOpenSheet] = useState<OpenSheetType>("car");
  const [previousSheet, setPreviousSheet] = useState<OpenSheetType>("none");
  const [detailKey, setDetailKey] = useState(0);
  const [forceSheetOpen, setForceSheetOpen] = useState(false);
  const [isSplatModalOpen, setIsSplatModalOpen] = useState(false);

  // Redux
  const dispatch = useAppDispatch();
  const stations = useAppSelector(selectStationsWithDistance);
  const stationsLoading = useAppSelector(selectStationsLoading);
  const stationsError = useAppSelector(selectStationsError);
  const cars = useAppSelector(selectAllCars);
  const carsLoading = useAppSelector(selectCarsLoading);
  const carsError = useAppSelector(selectCarsError);
  const stations3D = useAppSelector(selectStations3D);

  const userLocation = useAppSelector(selectUserLocation);
  const isSheetMinimized = useAppSelector(selectIsSheetMinimized);
  const bookingStep = useAppSelector(selectBookingStep);

  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleApiKey,
    version: "beta",
    libraries: LIBRARIES,
  });

  // Use the Three.js overlay hook, passing `actualMap`.
  const { overlayRef, stationCubesRef } = useThreeOverlay(actualMap, stations);

  // Map + icon setup
  useEffect(() => {
    if (isLoaded && window.google) {
      setMapOptions(createMapOptions());
      setMarkerIcons(createMarkerIcons());
    }
  }, [isLoaded]);

  // Fetch data (stations, cars, 3D)
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

  // Once stations & cars are loaded, hide overlay spinner
  useEffect(() => {
    if (isLoaded && !stationsLoading && !carsLoading) {
      setOverlayVisible(false);
    }
  }, [isLoaded, stationsLoading, carsLoading]);

  // Error check
  const hasError = stationsError || carsError || loadError;
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

  // Auto-fetch route if departure & arrival
  useEffect(() => {
    if (departureStationId && arrivalStationId) {
      const departureStation = stations.find((s) => s.id === departureStationId);
      const arrivalStation = stations.find((s) => s.id === arrivalStationId);
      if (departureStation && arrivalStation) {
        dispatch(fetchRoute({ departure: departureStation, arrival: arrivalStation }));
      }
    }
  }, [departureStationId, arrivalStationId, stations, dispatch]);

  // Sorting logic
  const sortStationsByDistanceToPoint = useCallback(
    (point: google.maps.LatLngLiteral, stationsToSort: StationFeature[]) => {
      if (!google?.maps?.geometry?.spherical) return stationsToSort;
      return [...stationsToSort].sort((a, b) => {
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

  // Handle address search => pan to location, sort stations
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!actualMap) return;
      actualMap.panTo(location);
      actualMap.setZoom(15);

      const sorted = sortStationsByDistanceToPoint(location, stations);
      setSearchLocation(location);
      setSortedStations(sorted);

      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, stations, isSheetMinimized, sortStationsByDistanceToPoint, actualMap]
  );

  // Clear departure => step 1
  const handleClearDepartureInSelector = () => {
    dispatch(clearDepartureStation());
    dispatch(advanceBookingStep(1));
    toast.success("Departure station cleared");

    if (openSheet === "detail") {
      setOpenSheet("none");
      setPreviousSheet("none");
    }
  };

  // Clear arrival => step 3
  const handleClearArrivalInSelector = () => {
    dispatch(clearArrivalStation());
    dispatch(advanceBookingStep(3));
    toast.success("Arrival station cleared");

    if (openSheet === "detail") {
      setOpenSheet("none");
      setPreviousSheet("none");
    }
  };

  // openNewSheet
  const openNewSheet = (newSheet: OpenSheetType) => {
    if (newSheet !== "detail") {
      setForceSheetOpen(false);
    }
    if (openSheet !== newSheet) {
      setPreviousSheet(openSheet);
      setOpenSheet(newSheet);
    }
  };

  // closeCurrentSheet
  const closeCurrentSheet = () => {
    const old = openSheet;
    if (old === "detail") {
      // If user closes detail in step 2 => forcibly unselect
      if (bookingStep === 2) {
        dispatch(clearDepartureStation());
        dispatch(advanceBookingStep(1));
        toast.success("Departure station unselected (sheet closed)");
      }
      setOpenSheet("none");
      setPreviousSheet("none");
      setForceSheetOpen(false);

      // If the overlay needs a redraw
      overlayRef.current?.requestRedraw();
    } else {
      setOpenSheet(previousSheet);
      setPreviousSheet("none");
    }
  };

  // "Locate me"
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

  // "Car" sheet toggle
  const handleCarToggle = () => {
    if (openSheet === "car") {
      closeCurrentSheet();
    } else {
      openNewSheet("car");
    }
  };

  // Station click => departure or arrival
  const handleStationClick = useCallback(
    (station: StationFeature) => {
      if (bookingStep < 3) {
        dispatch({ type: "user/selectDepartureStation", payload: station.id });
      } else {
        dispatch({ type: "user/selectArrivalStation", payload: station.id });
      }
      setDetailKey((prev) => prev + 1);

      setForceSheetOpen(true);
      setOpenSheet("detail");
      setPreviousSheet("none");

      if (isSheetMinimized) {
        dispatch(toggleSheet());
      }
    },
    [dispatch, bookingStep, isSheetMinimized]
  );

  // Station selected from list
  const handleStationSelectedFromList = (station: StationFeature) => {
    if (bookingStep < 3) {
      dispatch({ type: "user/selectDepartureStation", payload: station.id });
    } else {
      dispatch({ type: "user/selectArrivalStation", payload: station.id });
    }
    setDetailKey((prev) => prev + 1);

    setForceSheetOpen(true);
    setOpenSheet("detail");
    setPreviousSheet("none");
  };

  // Confirm departure => step 3
  const handleConfirmDeparture = () => {
    dispatch(advanceBookingStep(3));
    setOpenSheet("none");
    setPreviousSheet("none");
    setForceSheetOpen(false);
  };

  // Cleanup forceSheetOpen
  useEffect(() => {
    return () => {
      setForceSheetOpen(false);
    };
  }, []);

  // On map load => bounding & set state
  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      console.log("[GMap] handleMapLoad => map loaded");
      setActualMap(map); // <--- Store the map in state
      if (stations.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stations.forEach((station) => {
          const [lng, lat] = station.geometry.coordinates;
          bounds.extend({ lat, lng });
        });
        map.fitBounds(bounds, 50);
      }
    },
    [stations]
  );

  // If still loading => show spinner
  if (overlayVisible) {
    return <LoadingSpinner />;
  }

  // Which station is currently selected
  const hasStationSelected =
    bookingStep < 3 ? departureStationId : arrivalStationId;
  const stationToShow = hasStationSelected
    ? stations.find((s) => s.id === hasStationSelected)
    : null;

  // Toggling sheets
  const isCarOpen = openSheet === "car";
  const isListOpen = openSheet === "list";
  const isDetailOpen = (openSheet === "detail" || forceSheetOpen) && !!stationToShow;

  // Handlers for TicketOptions
  const handleSelectSingleJourney = () => {
    toast.success("You chose Single Journey. Fare calculation TBD.");
    // Possibly dispatch(advanceBookingStep(6)) if that’s your final step...
  };
  const handleSelectPayAsYouGo = () => {
    toast.success("You chose Pay-as-you-go. We'll store that soon!");
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      {/* Main Google Map */}
      <div className="absolute inset-0">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={userLocation || DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          options={mapOptions || {}}
          onLoad={handleMapLoad} // sets actualMap, triggers overlay effect
        >
          {/* User Location Marker */}
          {userLocation && markerIcons && (
            <Marker
              position={userLocation}
              icon={markerIcons.user}
              clickable={false}
            />
          )}

          {/* Example special marker */}
          {markerIcons && (
            <Marker
              position={INTER_CC}
              icon={markerIcons.icc}
              title="ICC Marker"
              onClick={() => setIsSplatModalOpen(true)}
            />
          )}

          {/* Station Markers */}
          {(searchLocation ? sortedStations : stations).map((station) => {
            const [lng, lat] = station.geometry.coordinates;
            return (
              <Marker
                key={station.id}
                position={{ lat, lng }}
                icon={(() => {
                  if (!markerIcons) return undefined;
                  if (station.id === departureStationId) return markerIcons.departureStation;
                  if (station.id === arrivalStationId) return markerIcons.arrivalStation;
                  return markerIcons.station;
                })()}
                onClick={() => handleStationClick(station)}
              />
            );
          })}

          {/* Car Markers */}
          {cars.map((car) => (
            <Marker
              key={car.id}
              position={{ lat: car.lat, lng: car.lng }}
              icon={markerIcons?.car}
              title={car.name}
            />
          ))}
        </GoogleMap>
      </div>

      {/* Station Selector Overlay */}
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
          onClick={handleCarToggle}
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground shadow"
        >
          <Car className="w-5 h-5" />
        </button>
      </div>

      {/* Car Sheet (Always in DOM, but toggled) */}
      <CarSheet isOpen={isCarOpen} onToggle={handleCarToggle} />

      {/* Station list sheet (Always in DOM, but toggled) */}
      <Sheet
        isOpen={isListOpen}
        onToggle={closeCurrentSheet}
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
                onStationSelected: () => handleStationSelectedFromList(station),
              }}
            />
          ))}
        </div>
      </Sheet>

      {/* Station detail sheet (Always in DOM, but toggled) */}
      <Sheet
        key={detailKey}
        isOpen={isDetailOpen}
        onToggle={closeCurrentSheet}
        title="Station Details"
        count={(searchLocation ? sortedStations : stations).length}
      >
        {stationToShow && (
          <StationDetail
            key={detailKey}
            stations={searchLocation ? sortedStations : stations}
            activeStation={stationToShow}
            onConfirmDeparture={handleConfirmDeparture}
          />
        )}
      </Sheet>

      {/* GaussianSplatModal */}
      <GaussianSplatModal
        isOpen={isSplatModalOpen}
        onClose={() => setIsSplatModalOpen(false)}
      />

      {/* Ticket Options => only shows if step === 5 */}
      {bookingStep === 5 && (
        <TicketOptions
          onSelectSingleJourney={handleSelectSingleJourney}
          onSelectPayAsYouGo={handleSelectPayAsYouGo}
          onClose={() => {
            // If you want a "close" button:
            toast("Closed payment options");
            // e.g. dispatch(advanceBookingStep(6)) or set some local state
          }}
        />
      )}
    </div>
  );
}
