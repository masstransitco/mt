"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { ArrowRightFromLine, ArrowRightToLine, X, AlertCircle, Search } from "lucide-react";
import { toast } from "react-hot-toast";
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
import { CarSignalIcon } from "@/components/ui/icons/CarSignalIcon";

// Dynamically import CarSheet
const CarSheet = dynamic(() => import("@/components/booking/CarSheet"), {
  ssr: false,
  loading: () => <div className="h-10 bg-gray-200 animate-pulse rounded-md"></div>,
});

/* -----------------------------------------------------------
   Typing & Dot Animations
----------------------------------------------------------- */
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

    function beginCycle() {
      // Step A: Wait 1.5s before typing
      dotDelayTimeout = setTimeout(() => {
        // Step B: type text every 50ms
        typingInterval = setInterval(() => {
          const full = textRef.current;
          if (indexRef.current < full.length) {
            indexRef.current++;
            setTypedText(full.slice(0, indexRef.current));
          } else {
            clearInterval(typingInterval);
            // Step C: Wait 2s, then reset & restart
            cycleEndTimeout = setTimeout(() => {
              setTypedText("");
              indexRef.current = 0;
              beginCycle();
            }, 3500);
          }
        }, 50);
      }, 2500);
    }

    beginCycle();

    return () => {
      clearTimeout(dotDelayTimeout);
      clearTimeout(cycleEndTimeout);
      clearInterval(typingInterval);
    };
  }, []);

  return typedText;
}

function AnimatedInfoText({ text }: { text: string }) {
  const typedText = useSynchronizedAnimation(text);
  return <>{typedText}</>;
}

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

const DepartureIcon = React.memo(({ highlight, step }: IconProps) => {
  const Icon = step === 1 ? Search : ArrowRightFromLine;
  return (
    <Icon
      className={`w-5 h-5 ${highlight ? "text-zinc-800" : "text-zinc-700"} transition-colors`}
      style={{ marginLeft: "12px" }}
    />
  );
});
DepartureIcon.displayName = "DepartureIcon";

const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => {
  const Icon = step === 3 ? Search : ArrowRightToLine;
  return (
    <Icon
      className={`w-5 h-5 ${highlight ? "text-zinc-800" : "text-zinc-700"} transition-colors`}
      style={{ marginLeft: "12px" }}
    />
  );
});
ArrivalIcon.displayName = "ArrivalIcon";

/* -----------------------------------------------------------
   AddressSearch Component
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
            onAddressSelect({ lat: lat(), lng: lng() });
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
          <div className="px-1 py-1 text-gray-700 font-medium">
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
                className="w-full bg-zinc-200 text-gray-700 border border-gray-100
                           rounded-md focus:outline-none focus:border-gray-400
                           placeholder:text-gray-500 disabled:cursor-not-allowed
                           p-1 text-base transition-colors"
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-white
                              border border-gray-200 rounded-md shadow-md
                              z-50 max-h-64 overflow-y-auto">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(prediction)}
                    className="w-full px-2 py-1 text-left text-sm text-gray-800
                               hover:bg-gray-100 transition-colors"
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
   Main StationSelector
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
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);
  const bookingRoute = useAppSelector(selectRoute);
  const viewState = useAppSelector((state) => state.ui.viewState);

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
  const highlightDeparture = step <= 2;
  const highlightArrival = step >= 3;

  // Subtle highlight vs default
  const highlightDepartureClass = highlightDeparture
    ? "ring-1 ring-white bg-[#F2F2F7]"
    : "bg-[#E5E5EA]";
  const highlightArrivalClass = highlightArrival
    ? "ring-1 ring-white bg-[#F2F2F7]"
    : "bg-[#E5E5EA]";

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

  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      dispatch(setSearchLocation(location));
      onAddressSearch(location);
    },
    [dispatch, onAddressSearch]
  );

  const handleCarToggle = useCallback(() => {
    if (viewState === "showCar") {
      dispatch(closeCurrentSheet());
    } else {
      dispatch(setViewState("showCar"));
    }
  }, [dispatch, viewState]);

  const handleClearDeparture = useCallback(() => {
    dispatch(clearDispatchRoute());
    onClearDeparture?.();
  }, [dispatch, onClearDeparture]);

  const handleClearArrival = useCallback(() => {
    onClearArrival?.();
  }, [onClearArrival]);

  const showCarSheet = viewState === "showCar";

  return (
    <div className="relative z-10 w-full max-w-screen-md mx-auto px-2">
      {/* 
        Wrap the station selector in a normal (non-absolute) container 
        so it can push other content down. 
      */}
      <div
        className="
          bg-zinc-800/90
          rounded-md 
          backdrop-blur-md
          px-2 py-2 
          space-y-2
          border-0
          border-zinc-600
          shadow-md
        "
      >
        {/* Same-station error */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}

        {/* DEPARTURE INPUT */}
        <div className={`flex items-center gap-2 rounded-xl transition-all duration-200 ${highlightDepartureClass}`}>
          <DepartureIcon highlight={highlightDeparture} step={step} />
          <AddressSearch
            onAddressSelect={handleAddressSearch}
            disabled={step >= 3}
            placeholder="  Where from?"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <button
              onClick={handleClearDeparture}
              className="
                p-1 hover:bg-gray-300 transition-colors 
                flex-shrink-0 m-1 rounded-md 
                text-zinc-400/80
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
          <div className={`flex items-center gap-2 rounded-xl transition-all duration-200 ${highlightArrivalClass}`}>
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
                  text-zinc-400/80
                "
                type="button"
                aria-label="Clear arrival"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* "Locate me" & Car Button (only in steps 1 or 2) */}
        {(step === 1 || step === 2) && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLocateMe}
              className="
                px-3 h-8 text-sm font-medium
                bg-blue-600/80 text-zinc-200
                rounded-xl hover:bg-blue-400
                transition-colors flex-1 shadow-md
                flex items-center justify-center
              "
              type="button"
            >
              Near me
            </button>
            <button
              onClick={handleCarToggle}
              className="
                w-8 h-8
                text-slate-950 bg-zinc-200/80
                rounded-xl hover:bg-gray-300 hover:text-black
                transition-colors flex items-center justify-center
                shadow-md flex-shrink-0
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
          <div className="flex items-center gap-2">
            <AnimatedDot />
            <span
              className="text-xs text-zinc-300 px-1 py-1
                         min-w-[14ch] whitespace-nowrap"
            >
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

      {/* 
        Render CarSheet *after* the selector, so it's not clipped. 
        You can also make it absolutely positioned or a portal, if desired.
      */}
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