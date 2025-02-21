"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { ArrowRightFromLine, ArrowRightToLine, X, AlertCircle, Search } from "lucide-react";
import { toast } from "react-hot-toast";

// Redux
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
import { setSearchLocation } from "@/store/userSlice";

// Icons / Components
import { CarSignalIcon } from "@/components/ui/icons/CarSignalIcon";

// Dynamically import CarSheet
const CarSheet = dynamic(() => import("@/components/booking/CarSheet"), {
  ssr: false,
  loading: () => <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>,
});

/* -----------------------------------------------------------
   Typing & Dot Animations
----------------------------------------------------------- */
// 1) A custom hook that waits 1.5s, types text char-by-char,
//    waits 2s, then resets.

function useSynchronizedAnimation(text: string) {
  const [typedText, setTypedText] = React.useState("");
  const textRef = React.useRef(text);
  const indexRef = React.useRef(0);

  React.useEffect(() => {
    // If text changes (e.g. new step), reset
    textRef.current = text;
    setTypedText("");
    indexRef.current = 0;
  }, [text]);

  React.useEffect(() => {
    let dotDelayTimeout: NodeJS.Timeout;
    let typingInterval: NodeJS.Timeout;
    let cycleEndTimeout: NodeJS.Timeout;

    // A helper function that starts the entire "dot wait + type + wait + reset" cycle
    function beginCycle() {
      // Step A: Wait 1.5s before typing (dot alone)
      dotDelayTimeout = setTimeout(() => {
        // Step B: type text every 50ms
        typingInterval = setInterval(() => {
          const full = textRef.current;
          if (indexRef.current < full.length) {
            indexRef.current++;
            setTypedText(full.slice(0, indexRef.current));
          } else {
            // Done typing
            clearInterval(typingInterval);
            // Step C: Wait 2s, then reset & restart
            cycleEndTimeout = setTimeout(() => {
              setTypedText("");
              indexRef.current = 0;
              beginCycle(); // ← CALL AGAIN to start a new cycle
            }, 3500);
          }
        }, 50);
      }, 2500);
    }

    // Kick off the first cycle
    beginCycle();

    return () => {
      clearTimeout(dotDelayTimeout);
      clearTimeout(cycleEndTimeout);
      clearInterval(typingInterval);
    };
  }, []);

  return typedText;
}

// 2) The text component that uses that hook
function AnimatedInfoText({ text }: { text: string }) {
  const typedText = useSynchronizedAnimation(text);
  return <>{typedText}</>;
}

// 3) Permanently animating dot (no step-based logic)
function AnimatedDot() {
  return (
    <>
      <style jsx>{`
        @keyframes expandShrink {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.75);
          }
          100% {
            transform: scale(1);
          }
        }
        .dot-animate {
          animation: expandShrink 1.8s ease-in-out infinite;
        }
      `}</style>

      <div className="w-2 h-2 rounded-full bg-slate-200 dot-animate px-1 py-1" />
    </>
  );
}

/* -----------------------------------------------------------
   Departure / Arrival Icons
----------------------------------------------------------- */
interface IconProps {
  highlight: boolean;
  step: number;
}

// Step 1 => Search icon, else ArrowRightFromLine
const DepartureIcon = React.memo(({ highlight, step }: IconProps) => {
  const Icon = step === 1 ? Search : ArrowRightFromLine;
  return (
    <Icon
      className={`w-5 h-5 ${highlight ? "text-black" : "text-black"} transition-colors`}
      style={{ marginLeft: "12px" }}
    />
  );
});
DepartureIcon.displayName = "DepartureIcon";

// Step 3 => Search icon, else ArrowRightToLine
const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => {
  const Icon = step === 3 ? Search : ArrowRightToLine;
  return (
    <Icon
      className={`w-5 h-5 ${highlight ? "text-black" : "text-black"} transition-colors`}
      style={{ marginLeft: "12px" }}
    />
  );
});
ArrivalIcon.displayName = "ArrivalIcon";

/* -----------------------------------------------------------
   AddressSearch Component (same as before)
----------------------------------------------------------- */
interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
  selectedStation?: StationFeature;
}

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
          <div className="px-1 py-1 text-black font-medium">
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
                className="w-full
                  bg-[#F2F2F7]
                  text-black
                  border
                  border-gray-100
                  rounded-md
                  focus:outline-none
                  focus:border-gray-400
                  placeholder:text-gray-500
                  disabled:cursor-not-allowed
                  p-1 text-base
                  transition-colors"
              />
              {searchText && (
                <button
                  onClick={() => {
                    setSearchText("");
                    setPredictions([]);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2
                    text-gray-700 hover:bg-gray-200
                    p-1 rounded-full transition-colors"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isDropdownOpen && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1
                  bg-white
                  border border-gray-200
                  rounded-md shadow-md
                  z-50
                  max-h-64
                  overflow-y-auto">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(prediction)}
                    className="w-full
                      px-2 py-1
                      text-left text-sm
                      text-gray-800
                      hover:bg-gray-100
                      transition-colors
                    "
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
   6) Main StationSelector Component
----------------------------------------------------------- */
interface StationSelectorProps {
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

  // Booking
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);
  const bookingRoute = useAppSelector(selectRoute);

  // UI
  const viewState = useAppSelector((state) => state.ui.viewState);

  // Lookups
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

  // Step logic
  const uiStepNumber = step < 3 ? 1 : 2;
  const highlightDeparture = step <= 2;
  const highlightArrival = step >= 3;

  // Subtle highlight vs default
  const highlightDepartureClass = highlightDeparture
    ? "ring-1 ring-white bg-[#F2F2F7]"
    : "bg-[#E5E5EA]";
  const highlightArrivalClass = highlightArrival
    ? "ring-1 ring-white bg-[#F2F2F7]"
    : "bg-[#E5E5EA]";

  // "Locate me"
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        toast.success("Location found!");
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

  // Address search
  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      dispatch(setSearchLocation(location));
      onAddressSearch(location);
    },
    [dispatch, onAddressSearch]
  );

  // Toggle CarSheet
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
    onClearDeparture?.();
  }, [dispatch, onClearDeparture]);

  // Clear arrival
  const handleClearArrival = useCallback(() => {
    onClearArrival?.();
  }, [onClearArrival]);

  // Show CarSheet?
  const showCarSheet = viewState === "showCar";

  return (
    <div
      className="
        absolute top-[2px] left-5 right-5 z-10 
        bg-zinc-950
        rounded-md 
        border 
        border-zinc-600
      "
      style={{ overscrollBehavior: "hidden", touchAction: "none" }}
    >
      {/* Inner wrapper */}
      <div className="px-2 py-2 space-y-2">
        {/* Same-station error */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}

        {/* DEPARTURE INPUT */}
        <div
          className={`
            flex items-center gap-2 rounded-md transition-all duration-200 
            ${highlightDepartureClass}
          `}
        >
          <DepartureIcon highlight={highlightDeparture} step={step} />
          <AddressSearch
            onAddressSelect={handleAddressSearch}
            disabled={step >= 3}
            placeholder="  Search here"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <button
              onClick={handleClearDeparture}
              className="
                p-1 hover:bg-gray-300 transition-colors 
                flex-shrink-0 m-1 rounded-md 
                text-black
              "
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
            className={`
              flex items-center gap-2 rounded-md transition-all duration-200
              ${highlightArrivalClass}
            `}
          >
            <ArrivalIcon highlight={highlightArrival} step={step} />
            <AddressSearch
              onAddressSelect={handleAddressSearch}
              disabled={step < 3}
              placeholder="  Search here"
              selectedStation={arrivalStation}
            />
            {arrivalStation && step <= 4 && (
              <button
                onClick={handleClearArrival}
                className="
                  p-1 hover:bg-gray-300 transition-colors 
                  flex-shrink-0 m-1 rounded-md 
                  text-black
                "
                type="button"
                aria-label="Clear arrival"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Locate Me & Car Button (only steps 1 or 2) */}
        {(step === 1 || step === 2) && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLocateMe}
              className="
                px-3
                h-8
                text-sm
                font-medium
                bg-sky-700
                text-white
                rounded-full
                hover:bg-blue-400
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
                text-slate-950
                bg-gray-300
                rounded-full
                hover:bg-gray-300
                hover:text-black
                transition-colors
                flex
                items-center
                justify-center
                shadow-md
                flex-shrink-0
                focus:outline-none
                focus:ring-2
                focus:ring-offset-2
                focus:ring-blue-400
              "
              type="button"
              aria-label="Toggle car view"
            >
              <CarSignalIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Info Bar (dot + typed text) */}
        <div className="flex items-center justify-between px-1 py-1">
          {/* Dot is always animating */}
          <div className="flex items-center gap-2">
            <AnimatedDot />
            <span className="text-xs text-zinc-300 px-1 py-1
                 min-w-[14ch] 
                 whitespace-nowrap">
              <AnimatedInfoText
                text={step < 3 ? "Choose pick-up station" : "Select arrival station"}
              />
            </span>
          </div>

          {departureStation && arrivalStation && distanceInKm && (
            <div className="text-xs font-medium text-slate-200">
              Drive Distance: {distanceInKm} km
            </div>
          )}
        </div>
      </div>

      {/* CarSheet */}
      {showCarSheet && (
        <div className="mt-2">
          <CarSheet
            isOpen
            onToggle={handleCarToggle}
            className="max-w-screen-md mx-auto mt-10"
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(StationSelector);
