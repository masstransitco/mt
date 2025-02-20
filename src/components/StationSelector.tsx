"use client";

import React, { useState, useEffect, useRef } from "react"; // Add missing imports
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectBookingStep, selectDepartureStationId, selectArrivalStationId } from "@/store/bookingSlice";
import { selectStationsWithDistance, StationFeature } from "@/store/stationsSlice";
import { clearDispatchRoute } from "@/store/dispatchSlice";
import { closeCurrentSheet, setViewState } from "@/store/uiSlice";
import CarSheet from "@/components/booking/CarSheet"; // Import CarSheet to handle car dispatching
import { ArrowRightFromLine, ArrowRightToLine, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import debounce from "lodash/debounce";
import { Car } from "lucide-react";

/* -----------------------------------------------------------
   Reusable Icons
----------------------------------------------------------- */
function DepartureIcon({ highlight }: { highlight: boolean }) {
  return (
    <ArrowRightFromLine
      className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
      style={{ marginLeft: "12px" }}
    />
  );
}

function ArrivalIcon({ highlight }: { highlight: boolean }) {
  return (
    <ArrowRightToLine
      className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`}
      style={{ marginLeft: "12px" }}
    />
  );
}

/* -----------------------------------------------------------
   AddressSearch Component
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
  const [searchText, setSearchText] = useState(""); // Use useState to manage search text
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

  if (selectedStation) {
    return (
      <div className="flex-1 px-1 py-1 text-foreground font-medium">
        {selectedStation.properties.Place}
      </div>
    );
  }

  const searchPlaces = debounce(async (input: string) => {
    if (!input.trim() || !autocompleteService.current) return;

    try {
      const request: google.maps.places.AutocompleteRequest = {
        input,
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
          className="w-full bg-transparent border-none focus:outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground/60 p-1 text-base"
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
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-md z-50"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="w-full px-2 py-1 text-left hover:bg-muted/50 text-sm"
            >
              <div className="font-medium">{prediction.structured_formatting.main_text}</div>
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
   StationSelector Component
----------------------------------------------------------- */
interface StationSelectorProps {
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
  onClearDeparture?: () => void;
  onClearArrival?: () => void;
}

export default function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
}: StationSelectorProps) {
  const dispatch = useAppDispatch();
  const viewState = useAppSelector((state) => state.ui.viewState);
  const step = useAppSelector(selectBookingStep);

  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  const stations = useAppSelector(selectStationsWithDistance);
  const departureStation = stations.find((s) => s.id === departureId);
  const arrivalStation = stations.find((s) => s.id === arrivalId);

  const bookingRoute = useAppSelector(selectBookingRoute);
  const distanceInKm = bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null;

  const uiStepNumber = step < 3 ? 1 : 2;
  const highlightDeparture = step <= 2;
  const highlightArrival = step >= 3;

  const highlightDepartureClass = highlightDeparture ? "ring-1 ring-white bg-background" : "";
  const highlightArrivalClass = highlightArrival ? "ring-1 ring-white bg-background" : "";

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        toast.success("Location found!");
        onAddressSearch(loc);
      },
      (err) => {
        console.error("Geolocation error:", err);
        toast.error("Unable to retrieve location.");
      }
    );
  };

  const handleCarToggle = () => {
    if (viewState === "showCar") {
      dispatch(closeCurrentSheet());
    } else {
      dispatch(setViewState("showCar"));
    }
  };

  return (
    <div
      className="absolute top-[2px] left-5 right-5 z-10 bg-background/90 backdrop-blur-sm border-b border-border rounded-md"
      style={{ overscrollBehavior: "none", touchAction: "none" }}
    >
      <div className="px-2 py-2 space-y-2">
        {/* DEPARTURE INPUT */}
        <div
          className={`flex items-center gap-2 rounded-md transition-all duration-200 ${highlightDepartureClass} ${
            departureStation ? "bg-accent/10" : "bg-muted/50"
          }`}
        >
          <DepartureIcon highlight={highlightDeparture} />
          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step >= 3}
            placeholder="Search here"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <button
              onClick={() => {
                dispatch(clearDispatchRoute());
                if (onClearDeparture) {
                  onClearDeparture();
                } else {
                  toast.success("Departure station cleared");
                }
              }}
              className="p-1 hover:bg-muted transition-colors flex-shrink-0 m-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ARRIVAL INPUT */}
        {step >= 3 && (
          <div
            className={`flex items-center gap-2 rounded-md transition-all duration-200 ${highlightArrivalClass} ${
              arrivalStation ? "bg-accent/10" : "bg-muted/50"
            }`}
          >
            <ArrivalIcon highlight={highlightArrival} />
            <AddressSearch
              onAddressSelect={onAddressSearch}
              disabled={step < 3}
              placeholder="Search here"
              selectedStation={arrivalStation}
            />
            {arrivalStation && step <= 4 && (
              <button
                onClick={() => {
                  if (onClearArrival) {
                    onClearArrival();
                  } else {
                    toast.success("Arrival station cleared");
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
            {uiStepNumber === 1 ? "Choose pick-up station" : "Select arrival station"}
          </div>

          {departureStation && arrivalStation && distanceInKm && (
            <div className="text-xs font-medium">Drive Distance: {distanceInKm} km</div>
          )}
        </div>

        {/* Validation: same-station error */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-1 py-1 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}

        {/* Locate Me & Car Button */}
        {(step === 1 || step === 2) && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLocateMe}
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent/80 w-full"
            >
              Near me
            </button>
            <button
              onClick={handleCarToggle}
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent/80 w-full"
            >
              Car
            </button>
          </div>
        )}
      </div>

      {/* CarSheet */}
      <CarSheet
        isOpen={viewState === "showCar"}
        onToggle={handleCarToggle}
      />
    </div>
  );
}
