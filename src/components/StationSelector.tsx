'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Navigation, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep, advanceBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
} from '@/store/userSlice';
import { selectStationsWithDistance, StationFeature } from '@/store/stationsSlice';
import debounce from 'lodash/debounce';

interface StationSelectorProps {
  onAddressSearch: (location: google.maps.LatLngLiteral) => void;
}

interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
  selectedStation?: StationFeature;
}

// Replaces the old Lucide MapPin with your desired path
function CustomPinIcon({ highlight }: { highlight: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-3 -7 6 8"
      // No fill; we use stroke to draw the lines
      fill="none"
      stroke="currentColor"
      strokeWidth={0.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-5 h-5 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}
    >
      <path
        d="
          M 0 0
            L -2 0
            L -2 -4
            L -1 -4

          M 1 -4
            L 2 -4
            L 2 0
            L 0 0

          M 0 -2
            L 0 -6
            L -1 -5

          M 0 -6
            L 1 -5
        "
      />
    </svg>
  );
}

////////////////////////////////////////////////////////////////
// AddressSearch input (unchanged, aside from any minor styling)
////////////////////////////////////////////////////////////////
const AddressSearch = ({
  onAddressSelect,
  disabled,
  placeholder,
  selectedStation,
}: AddressSearchProps) => {
  const [searchText, setSearchText] = useState('');
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

  // If a station is already selected, display its name rather than an input
  if (selectedStation) {
    return (
      <div className="flex-1 px-1 py-1 text-foreground font-medium">
        {selectedStation.properties.Place}
      </div>
    );
  }

  // Debounced search function for Google Autocomplete
  const searchPlaces = debounce(async (input: string) => {
    if (!input.trim() || !autocompleteService.current) return;

    try {
      const request: any = {
        input,
        componentRestrictions: { country: 'HK' },
        types: ['address'],
      };
      const response = await autocompleteService.current.getPlacePredictions(request);
      setPredictions(response.predictions);
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    }
  }, 300);

  // When user selects a prediction
  const handleSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!geocoder.current) return;

    try {
      const response = await geocoder.current.geocode({ placeId: prediction.place_id });
      if (response.results[0]?.geometry?.location) {
        const { lat, lng } = response.results[0].geometry.location;
        onAddressSelect({ lat: lat(), lng: lng() });
        setSearchText(prediction.structured_formatting.main_text);
        setPredictions([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Unable to locate address');
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
                     placeholder:text-muted-foreground/60 p-1 text-sm"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText('');
              setPredictions([]);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border
                        rounded-lg shadow-md z-50">
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

////////////////////////////////////////////////////////////////
// The main StationSelector
////////////////////////////////////////////////////////////////
export default function StationSelector({ onAddressSearch }: StationSelectorProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);

  // IDs of the selected departure & arrival stations
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  // All stations + distance
  const stations = useAppSelector(selectStationsWithDistance);

  const departureStation = stations.find((s) => s.id === departureId);
  const arrivalStation = stations.find((s) => s.id === arrivalId);

  // 2-step UI logic:
  // If bookingStep < 3 => Show "Step 1 of 2"
  // If bookingStep >= 3 => Show "Step 2 of 2"
  const uiStepNumber = step < 3 ? 1 : 2;

  // Highlight departure if step < 3, highlight arrival if step >= 3
  const highlightDeparture = step < 3;
  const highlightArrival = step >= 3;

  return (
    <div
      className="absolute top-[2px] left-5 right-5 z-10
                 bg-background/90 backdrop-blur-sm
                 border-b border-border
                 rounded-md"
    >
      <div className="px-2 py-2 space-y-2">

        {/* DEPARTURE Input */}
        <div
          className={`
            flex items-center gap-2 rounded-md transition-all duration-200
            ${highlightDeparture ? 'ring-1 ring-primary bg-background' : ''}
            ${departureStation ? 'bg-accent/10' : 'bg-muted/50'}
          `}
        >
          {/* Replaced <MapPin> with our custom icon */}
          <CustomPinIcon highlight={highlightDeparture} />

          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step >= 3}
            placeholder="Search for departure station"
            selectedStation={departureStation}
          />

          {departureStation && (
            <button
              onClick={() => {
                dispatch(clearDepartureStation());
                dispatch(clearArrivalStation());
                dispatch(advanceBookingStep(1));
                toast.success('Departure station cleared');
              }}
              className="p-1 hover:bg-muted transition-colors flex-shrink-0 m-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ARRIVAL Input */}
        <div
          className={`
            flex items-center gap-2 rounded-md transition-all duration-200
            ${highlightArrival ? 'ring-1 ring-primary bg-background' : ''}
            ${arrivalStation ? 'bg-accent/10' : 'bg-muted/50'}
          `}
        >
          {/* We keep the same <Navigation> icon for arrival */}
          <Navigation
            className={`
              w-5 h-5 m-1 flex-shrink-0
              ${highlightArrival ? 'text-primary' : 'text-muted-foreground'}
            `}
          />
          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step < 3}
            placeholder="Search for arrival station"
            selectedStation={arrivalStation}
          />

          {arrivalStation && (
            <button
              onClick={() => {
                dispatch(clearArrivalStation());
                dispatch(advanceBookingStep(3));
                toast.success('Arrival station cleared');
              }}
              className="p-1 hover:bg-muted transition-colors flex-shrink-0 m-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Step {uiStepNumber} of 2</span>
            <span>•</span>
            {uiStepNumber === 1 ? (
              <span>Select departure station</span>
            ) : (
              <span>Select arrival station</span>
            )}
          </div>
          {departureStation && arrivalStation && (
            <div className="text-xs font-medium">
              Total Route:{' '}
              {(
                (departureStation.distance || 0) +
                (arrivalStation.distance || 0)
              ).toFixed(1)}{' '}
              km
            </div>
          )}
        </div>

        {/* Validation Messages */}
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
