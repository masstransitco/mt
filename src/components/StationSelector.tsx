"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { X, AlertCircle, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRoute,
} from "@/store/bookingSlice";
import { selectStationsWithDistance, StationFeature } from "@/store/stationsSlice";
import { clearDispatchRoute } from "@/store/dispatchSlice";
import { setSearchLocation } from "@/store/userSlice";
import { MapPinDown } from "@/components/ui/icons/MapPinDown";
import { MapPinUp } from "@/components/ui/icons/MapPinUp";
import { NearPin } from "@/components/ui/icons/NearPin";
import { cn } from "@/lib/utils";

/* -----------------------------------------------------------
   Typing & Dot Animations
----------------------------------------------------------- */
function useSynchronizedAnimation(text: string) {
  const [typedText, setTypedText] = useState("");
  const textRef = useRef(text);
  const indexRef = useRef(0);

  useEffect(() => {
    // If text changes (e.g. new step), reset
    textRef.current = text;
    setTypedText("");
    indexRef.current = 0;
  }, [text]);

  useEffect(() => {
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
      <div className="w-2 h-2 rounded-full bg-blue-900/80 backdrop-blur-md dot-animate px-1 py-0" />
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
  return (
    <div className={cn(
      "p-1.5 rounded-full flex items-center justify-center",
      highlight ? "bg-blue-600" : "bg-gray-700"
    )}>
      {step === 1 ? (
        <Search className="w-4 h-4 backdrop-blur-md text-white" />
      ) : (
        <MapPinUp className="w-4 h-4 text-white" />
      )}
    </div>
  );
});
DepartureIcon.displayName = "DepartureIcon";

const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => {
  return (
    <div className={cn(
      "p-1.5 rounded-full flex items-center justify-center",
      highlight ? "bg-blue-600" : "bg-gray-700"
    )}>
      {step === 3 ? (
        <Search className="w-4 h-4 backdrop-blur-md text-white" />
      ) : (
        <MapPinDown className="w-4 h-4 text-white" />
      )}
    </div>
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
          <div className="px-1 py-1 text-white font-medium">
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
                className={cn(
                  "w-full bg-slate-950/90 bakcdrop-blur-md text-white",
                  "focus:outline-none",
                  "placeholder:text-gray-500 disabled:cursor-not-allowed p-0 text-base transition-colors"
                )}
              />
              {searchText && (
                <button
                  onClick={() => {
                    setSearchText("");
                    setPredictions([]);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:bg-gray-700 p-1 rounded-full transition-colors"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <AnimatePresence>
              {isDropdownOpen && predictions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                  {predictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(prediction)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
                      type="button"
                    >
                      <div className="font-medium">
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-xs text-gray-400">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
  onLocateMe?: () => void;
}

function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
  onLocateMe,
}: StationSelectorProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);
  const bookingRoute = useAppSelector(selectRoute);

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

  // Subtle highlight vs default - removed border color as requested
  const highlightDepartureClass = highlightDeparture
    ? "bg-slate-950/80"
    : "bg-gray-900";
  const highlightArrivalClass = highlightArrival
    ? "bg-slate-950/80"
    : "bg-gray-900";

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

  const handleClearDeparture = useCallback(() => {
    dispatch(clearDispatchRoute());
    onClearDeparture?.();
  }, [dispatch, onClearDeparture]);

  const handleClearArrival = useCallback(() => {
    onClearArrival?.();
  }, [onClearArrival]);

  return (
    <div className="relative z-10 w-full max-w-screen-md mx-auto px-1">
      {/* Station Inputs Container */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-800/50 rounded-lg backdrop-blur-md px-1 py-1 space-y-1 border-0.5 border-zinc-800/90 shadow-xl"
        style={{ overscrollBehavior: "hidden", touchAction: "none" }}
      >
        {/* Same-station error */}
        <AnimatePresence>
          {departureId && arrivalId && departureId === arrivalId && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-1 py-1 text-sm text-red-400 bg-red-900/30 rounded-md border border-red-800"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Departure and arrival stations cannot be the same</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DEPARTURE INPUT */}
        <div className={`flex items-center gap-3 rounded-full p-1 border border-gray-800 transition-all duration-200 ${highlightDepartureClass}`}>
          <DepartureIcon highlight={highlightDeparture} step={step} />
          <AddressSearch
            onAddressSelect={handleAddressSearch}
            disabled={step >= 3}
            placeholder="Where from?"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <button
              onClick={handleClearDeparture}
              className="p-1.5 hover:bg-gray-700 transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
              type="button"
              aria-label="Clear departure"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ARRIVAL INPUT */}
        <AnimatePresence>
          {step >= 3 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-3 rounded-full p-1 border border-gray-800 transition-all duration-200 ${highlightArrivalClass}`}
            >
              <ArrivalIcon highlight={highlightArrival} step={step} />
              <AddressSearch
                onAddressSelect={handleAddressSearch}
                disabled={step < 3}
                placeholder="Where to?"
                selectedStation={arrivalStation}
              />
              {arrivalStation && step <= 4 && (
                <button
                  onClick={handleClearArrival}
                  className="p-1.5 hover:bg-gray-700 transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                  type="button"
                  aria-label="Clear arrival"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info Bar and Action Buttons */}
      <div className="mt-2">
        <div className="flex items-center justify-between px-2 py-2">
          {/* Left side - Info Text */}
          <div className="flex items-center gap-2">
            <AnimatedDot />
            <span className="text-xs text-white px-2 py-1 min-w-[14ch] whitespace-nowrap backdrop-blur-sm rounded-md">
              <AnimatedInfoText text={step < 3 ? "Choose pick-up station" : "Select arrival station"} />
            </span>
          </div>
          
          {/* Right side - Action Buttons and Distance */}
          <div className="flex items-center gap-2">
            {departureStation && arrivalStation && distanceInKm && (
              <div className="text-xs font-medium text-white px-3 py-1 bg-blue-600/60 backdrop-blur-sm rounded-full mr-2">
                {distanceInKm} km
              </div>
            )}
            
            {/* Only show locate me button in steps 1 or 2 */}
            {(step === 1 || step === 2) && (
              <button
                onClick={onLocateMe || handleLocateMe}
                className="w-10 h-10 bg-gray-800 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center"
                type="button"
                aria-label="Find stations near me"
              >
                <NearPin className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(StationSelector);
