"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import debounce from "lodash/debounce";

import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  selectRoute as selectBookingRoute,
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/bookingSlice";
import { selectStationsWithDistance, StationFeature } from "@/store/stationsSlice";
import { clearDispatchRoute } from "@/store/dispatchSlice";

/* -----------------------------------------------------------
   Reusable Icons
----------------------------------------------------------- */
import { ArrowRightFromLine, ArrowRightToLine } from "lucide-react";

function DepartureIcon({ highlight }: { highlight: boolean }) {
  return (
    <ArrowRightFromLine
      className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
      style={{ marginLeft: "12px" }} // Shift to the right
    />
  );
}

function ArrivalIcon({ highlight }: { highlight: boolean }) {
  return (
    <ArrowRightToLine
      className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
      style={{ marginLeft: "12px" }} // Shift to the right
    />
  );
}

/* -----------------------------------------------------------
   AddressSearch
----------------------------------------------------------- */
interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
  selectedStation?: StationFeature;
}

const AddressSearch = ({
  onAddressSelect,
  disabled,
  placeholder,
  selectedStation,
}: AddressSearchProps) => {
  const [searchText, setSearchText] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (window.google) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      geocoder.current = new google.maps.Geocoder();
    }
  }, []);

  // If station is already selected, display station name & disable input
  if (selectedStation) {
    return (
      <div className="flex-1 px-1 py-1 text-foreground font-medium">
        {selectedStation.properties.Place}
      </div>
    );
  }

  // Debounced search
  const searchPlaces = debounce(async (input: string) => {
    if (!input.trim() || !autocompleteService.current) return;

    try {
      const request: google.maps.places.AutocompleteRequest = {
        input,
        // @ts-ignore 
        types: ["establishment", "geocode"],
        componentRestrictions: { country: "HK" },
      };
      const response = await autocompleteService.current.getPlacePredictions(request);
      setPredictions(response.predictions);
      setShowResults(true);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      setPredictions([]);
    }
  }, 300);

  // On selecting a prediction => geocode => call parent's onAddressSelect
  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!geocoder.current) return;

    try {
      const response = await geocoder.current.geocode({ placeId: prediction.place_id });
      const result = response.results[0];
      if (result?.geometry?.location) {
        const { lat, lng } = result.geometry.location;
        onAddressSelect({ lat: lat(), lng: lng() });
        setSearchText(prediction.structured_formatting.main_text);
        setPredictions([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      toast.error("Unable to locate address");
    }
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <input
          type="text"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            searchPlaces(e.target.value);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-transparent border-none focus:outline-none disabled:cursor-not-allowed
                     placeholder:text-muted-foreground/60 p-1 text-base"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText("");
              setPredictions([]);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && predictions.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border
                     rounded-lg shadow-md z-50"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="w-full px-2 py-1 text-left hover:bg-muted/50 text-sm"
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
  );
};

/* -----------------------------------------------------------
   StationSelector
----------------------------------------------------------- */
interface StationSelectorProps {
  /** Callback when user searches an address and selects a location on the map */
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
  /** Callback when user clears the departure station */
  onClearDeparture?: () => void;
  /** Callback when user clears the arrival station */
  onClearArrival?: () => void;
}

export default function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
}: StationSelectorProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  // Booking slice: selected departure & arrival station IDs
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // All stations with distance
  const stations = useAppSelector(selectStationsWithDistance);
  const departureStation = stations.find((s) => s.id === departureId);
  const arrivalStation = stations.find((s) => s.id === arrivalId);

  // Booking route (departure→arrival) for distance
  const bookingRoute = useAppSelector(selectBookingRoute);
  const distanceInKm = bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null;

  // Step UI logic
  const uiStepNumber = step < 3 ? 1 : 2;
  const highlightDeparture = step <= 2;
  const highlightArrival = step >= 3;

  // We'll add a ring highlight for whichever input is relevant
  const highlightDepartureClass = highlightDeparture ? "ring-1 ring-white bg-background" : "";
  const highlightArrivalClass = highlightArrival ? "ring-1 ring-white bg-background" : "";

  return (
    <div
      className="absolute top-[2px] left-5 right-5 z-10
                 bg-background/90 backdrop-blur-sm
                 border-b border-border
                 rounded-md"
      style={{ overscrollBehavior: "none", touchAction: "none" }}
    >
      <div className="px-2 py-2 space-y-2">
        {/* ------------------ DEPARTURE INPUT ------------------ */}
        <div
          className={`
            flex items-center gap-2 rounded-md transition-all duration-200
            ${highlightDepartureClass}
            ${departureStation ? "bg-accent/10" : "bg-muted/50"}
          `}
        >
          <DepartureIcon highlight={highlightDeparture} />

          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step >= 3} // once step=3 or beyond, user can't re-search departure
            placeholder="Search here"
            selectedStation={departureStation}
          />

          {/* Clear departure if set, and step <= 3 */}
          {departureStation && step <= 3 && (
            <button
              onClick={() => {
                // Also clear the dispatch route
                dispatch(clearDispatchRoute());
                if (onClearDeparture) {
                  onClearDeparture();
                } else {
                  toast.success("Departure station cleared (fallback logic)");
                }
              }}
              className="p-1 hover:bg-muted transition-colors flex-shrink-0 m-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ------------------ ARRIVAL INPUT (only if step >= 3) ------------------ */}
        {step >= 3 && (
          <div
            className={`
              flex items-center gap-2 rounded-md transition-all duration-200
              ${highlightArrivalClass}
              ${arrivalStation ? "bg-accent/10" : "bg-muted/50"}
            `}
          >
            <ArrivalIcon highlight={highlightArrival} />

            <AddressSearch
              onAddressSelect={onAddressSearch}
              disabled={step < 3}
              placeholder="Search here"
              selectedStation={arrivalStation}
            />

            {/* Clear arrival if set, and step <= 4 */}
            {arrivalStation && step <= 4 && (
              <button
                onClick={() => {
                  if (onClearArrival) {
                    onClearArrival();
                  } else {
                    toast.success("Arrival station cleared (fallback logic)");
                  }
                }}
                className="p-1 hover:bg-muted transition-colors flex-shrink-0 m-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Info Bar */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>•</span>
            {uiStepNumber === 1
              ? "Choose pick-up station"
              : "Select arrival station"}
          </div>

          {/* Show route distance if both stations chosen & we have route data */}
          {departureStation && arrivalStation && distanceInKm && (
            <div className="text-xs font-medium">
              Drive Distance: {distanceInKm} km
            </div>
          )}
        </div>

        {/* Validation: same-station error */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}
      </div>
    </div>
  );
}
