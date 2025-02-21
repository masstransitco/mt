"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRoute,
} from "@/store/bookingSlice";
import { selectStationsWithDistance, StationFeature } from "@/store/stationsSlice";
import { clearDispatchRoute } from "@/store/dispatchSlice";
import { closeCurrentSheet, setViewState } from "@/store/uiSlice";
import dynamic from "next/dynamic";
import { ArrowRightFromLine, ArrowRightToLine, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { CarSignalIcon } from "@/components/ui/icons/CarSignalIcon";
import { setSearchLocation } from "@/store/userSlice";

/* -----------------------------------------------------------
   Dynamically import CarSheet (no SSR)
----------------------------------------------------------- */
const CarSheet = dynamic(() => import("@/components/booking/CarSheet"), {
  ssr: false,
  loading: () => <div className="h-10 bg-muted animate-pulse rounded-md"></div>,
});

/* -----------------------------------------------------------
   Reusable Icons - Memoized
----------------------------------------------------------- */
const DepartureIcon = React.memo(({ highlight }: { highlight: boolean }) => (
  <ArrowRightFromLine
    className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
    style={{ marginLeft: "12px" }}
  />
));

const ArrivalIcon = React.memo(({ highlight }: { highlight: boolean }) => (
  <ArrowRightToLine
    className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
    style={{ marginLeft: "12px" }}
  />
));

/* -----------------------------------------------------------
   AddressSearch Component (same as before)
----------------------------------------------------------- */
interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
  selectedStation?: StationFeature;
}

const handleClickOutside = () => {
  setIsDropdownOpen(false);
};

const AddressSearch = React.memo(
  ({ onAddressSelect, disabled, placeholder, selectedStation }: AddressSearchProps) => {
    const [searchText, setSearchText] = useState("");
    const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
    const geocoder = useRef<google.maps.Geocoder | null>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Google services once
    useEffect(() => {
      if (window.google && !autocompleteService.current) {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        geocoder.current = new google.maps.Geocoder();
      }
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }, []);

    // If a station is already selected, we just show it in read-only mode
    const isStationSelected = Boolean(selectedStation);

    const searchPlaces = useCallback((input: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (!input.trim() || !autocompleteService.current) {
        setPredictions([]);
        return;
      }
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const request: google.maps.places.AutocompleteRequest = {
            input,
            // @ts-ignore
            types: ["establishment", "geocode"],
            componentRestrictions: { country: "HK" },
          };
          const response = await autocompleteService.current!.getPlacePredictions(request);
          // Limit to 5 predictions
          setPredictions(response.predictions.slice(0, 5));
          setIsDropdownOpen(response.predictions.length > 0);
        } catch (error) {
          console.error("Error fetching predictions:", error);
          setPredictions([]);
          setIsDropdownOpen(false);
        }
      }, 300);
    }, []);

    const handleSelect = useCallback(
      async (prediction: google.maps.places.AutocompletePrediction) => {
        if (!geocoder.current) return;
        try {
          const response = await geocoder.current.geocode({
            placeId: prediction.place_id,
            // @ts-ignore
            fields: ["geometry.location"],
          });
          const result = response.results[0];
          if (result?.geometry?.location) {
            const { lat, lng } = result.geometry.location;
            // Pass the final { lat, lng } to the parent
            onAddressSelect({ lat: lat(), lng: lng() });
            // Update our local input
            setSearchText(prediction.structured_formatting.main_text);
            setPredictions([]);
            setIsDropdownOpen(false);
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          toast.error("Unable to locate address");
        }
      },
      [onAddressSelect]
    );
  
    

    return (
      <div className="flex-1">
        {isStationSelected ? (
          <div className="px-1 py-1 text-foreground font-medium">
            {selectedStation!.properties.Place}
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  searchPlaces(e.target.value);
                }}
                onFocus={() => setIsDropdownOpen(predictions.length > 0)}
                onBlur={() => setIsDropdownOpen(false)}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full bg-transparent border-none focus:outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground/60 p-1 text-base"
              />
              {searchText && (
                <button
                  onClick={() => {
                    setSearchText("");
                    setPredictions([]);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isDropdownOpen && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-md z-9999 max-h-64 overflow-y-auto">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => handleSelect(prediction)}
                    className="w-full px-2 py-1 text-left hover:bg-muted/50 text-sm"
                    type="button"
                  >
                    <div className="font-medium">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

AddressSearch.displayName = "AddressSearch";

/* -----------------------------------------------------------
   StationSelector Component - with setSearchLocation
----------------------------------------------------------- */
interface StationSelectorProps {
  // Parent or GMap callback if needed
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
  onClearDeparture?: () => void;
  onClearArrival?: () => void;
}

function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
}: StationSelectorProps) {
  const dispatch = useAppDispatch();

  // Booking state
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);
  const bookingRoute = useAppSelector(selectRoute);

  // UI state
  const viewState = useAppSelector((state) => state.ui.viewState);

  // Memoized station lookups
  const departureStation = useMemo(
    () => stations.find((s) => s.id === departureId),
    [stations, departureId]
  );
  const arrivalStation = useMemo(
    () => stations.find((s) => s.id === arrivalId),
    [stations, arrivalId]
  );
  const distanceInKm = useMemo(
    () => (bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null),
    [bookingRoute]
  );

  // Step display logic
  const uiStepNumber = step < 3 ? 1 : 2;
  const highlightDeparture = step <= 2;
  const highlightArrival = step >= 3;

  const highlightDepartureClass = highlightDeparture ? "ring-1 ring-white bg-background" : "";
  const highlightArrivalClass = highlightArrival ? "ring-1 ring-white bg-background" : "";

  /**
   * 1) If user hits "Locate me", we set location in GMap
   *    or in Redux (via onAddressSearch?), then toast success.
   */
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        toast.success("Location found!");
        // Here we can do the same pattern: dispatch to Redux + call parent's callback
        dispatch(setSearchLocation(loc));
        onAddressSearch(loc);
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("Unable to retrieve location.");
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
    );
  }, [dispatch, onAddressSearch]);

  /**
   * 2) This is the main callback for AddressSearch.
   *    We dispatch setSearchLocation so that the rest of the app can see it,
   *    and also call onAddressSearch if GMap or a parent needs to do something specific.
   */
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      // Save to Redux
      dispatch(setSearchLocation(location));
      // Also call the parent if needed (e.g. to pan the map)
      onAddressSearch(location);
    },
    [dispatch, onAddressSearch]
  );

  // Show/hide the CarSheet
  const handleCarToggle = useCallback(() => {
    if (viewState === "showCar") {
      dispatch(closeCurrentSheet());
    } else {
      dispatch(setViewState("showCar"));
    }
  }, [dispatch, viewState]);

  // Clear departure
  const handleClearDeparture = useCallback(() => {
    dispatch(clearDispatchRoute());
    if (onClearDeparture) {
      onClearDeparture();
    } else {
      toast.success("Departure station cleared");
    }
  }, [dispatch, onClearDeparture]);

  // Clear arrival
  const handleClearArrival = useCallback(() => {
    if (onClearArrival) {
      onClearArrival();
    } else {
      toast.success("Arrival station cleared");
    }
  }, [onClearArrival]);

  // Decide if we show CarSheet
  const showCarSheet = viewState === "showCar";

  return (
    <div
      className="absolute top-[2px] left-5 right-5 z-10 bg-neutral-800/90 backdrop-blur-sm border-b border-neutral-700 rounded-md"
      style={{ overscrollBehavior: "none", touchAction: "auto" }}
    >
      <div className="px-2 py-2 space-y-2">
        {/* Info Bar */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>•</span>
            {uiStepNumber === 1 ? "Choose pick-up station" : "Select arrival station"}
          </div>
          {departureStation && arrivalStation && distanceInKm && (
            <div className="text-xs font-medium">Drive Distance: {distanceInKm} km</div>
          )}
        </div>

        {/* Validation for same-station error */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}

        {/* DEPARTURE INPUT */}
        <div
          className={`flex items-center gap-2 rounded-md transition-all duration-200 ${highlightDepartureClass} ${
            departureStation ? "bg-neutral-700" : "bg-neutral-800/70"
          }`}
        >
          <DepartureIcon highlight={highlightDeparture} />
          <AddressSearch
            onAddressSelect={handleAddressSearch}
            disabled={step >= 3}
            placeholder="Search here"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <button
              onClick={handleClearDeparture}
              className="p-1 hover:bg-neutral-600 transition-colors flex-shrink-0 m-1 rounded-md"
              type="button"
              aria-label="Clear departure"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ARRIVAL INPUT */}
        {step >= 3 && (
          <div
            className={`flex items-center gap-2 rounded-md transition-all duration-200 ${highlightArrivalClass} ${
              arrivalStation ? "bg-neutral-700" : "bg-neutral-800/70"
            }`}
          >
            <ArrivalIcon highlight={highlightArrival} />
            <AddressSearch
              onAddressSelect={handleAddressSearch}
              disabled={step < 3}
              placeholder="Search here"
              selectedStation={arrivalStation}
            />
            {arrivalStation && step <= 4 && (
              <button
                onClick={handleClearArrival}
                className="p-1 hover:bg-neutral-600 transition-colors flex-shrink-0 m-1 rounded-md"
                type="button"
                aria-label="Clear arrival"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Locate Me & Car Button (only during steps 1 or 2) */}
        {(step === 1 || step === 2) && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLocateMe}
              className="
                px-3
                h-8
                text-sm
                font-medium
                bg-blue-600
                text-white
                rounded-full
                hover:bg-blue-500
                transition-colors
                flex-1
                shadow-md
                flex
                items-center
                justify-center
              "
              type="button"
            >
              Near me
            </button>
            <button
              onClick={handleCarToggle}
              className="
                w-8
                h-8
                bg-neutral-800
                text-gray-100
                rounded-full
                hover:bg-neutral-700
                transition-colors
                flex
                items-center
                justify-center
                shadow-md
                flex-shrink-0
                focus:outline-none
                focus:ring-2
                focus:ring-offset-2
                focus:ring-neutral-500
              "
              type="button"
              aria-label="Toggle car view"
            >
              <CarSignalIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div onClick={handleClickOutside}></div>

      {/* Conditionally render CarSheet */}
      {showCarSheet && (
        <div className="mt-2">
          <CarSheet isOpen={true} onToggle={handleCarToggle} className="max-w-screen-md mx-auto mt-10" />
        </div>
      )}
    </div>
  );
}

export default React.memo(StationSelector);
