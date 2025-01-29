'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep } from '@/store/bookingSlice';
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

const AddressSearch = ({ onAddressSelect, disabled, placeholder, selectedStation }: AddressSearchProps) => {
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

  // Don't render input if station is selected
  if (selectedStation) {
    return (
      <div className="flex-1 px-2 py-1.5 text-foreground font-medium">
        {selectedStation.properties.Place}
      </div>
    );
  }

  const searchPlaces = debounce(async (input: string) => {
    if (!input.trim() || !autocompleteService.current) return;

    const request = {
      input,
      componentRestrictions: { country: 'HK' },
      types: ['address']
    };

    try {
      const response = await autocompleteService.current.getPlacePredictions(request);
      setPredictions(response.predictions);
      setShowResults(true);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    }
  }, 300);

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
          className="w-full bg-transparent border-none focus:outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground/60"
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50">
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className="w-full px-4 py-2 text-left hover:bg-muted/50 text-sm"
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

export default function StationSelector({ onAddressSearch }: StationSelectorProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const departureStation = stations.find(s => s.id === departureId);
  const arrivalStation = stations.find(s => s.id === arrivalId);

  return (
    <div className="absolute top-4 left-4 right-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg">
      <div className="p-4 space-y-3">
        {/* Departure Input */}
        <div className={`
          flex items-center gap-2 p-3 rounded-lg transition-all duration-200
          ${step === 1 ? 'ring-2 ring-primary bg-background' : ''}
          ${departureStation ? 'bg-accent/10' : 'bg-muted/50'}
        `}>
          <MapPin className={`w-5 h-5 flex-shrink-0 ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`} />
          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step !== 1}
            placeholder="Search for a station to pick-up the car"
            selectedStation={departureStation}
          />
          {departureStation && (
            <button
              onClick={() => {
                dispatch(clearDepartureStation());
                toast.success('Departure station cleared');
              }}
              className="p-1 hover:bg-muted rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Arrival Input */}
        <div className={`
          flex items-center gap-2 p-3 rounded-lg transition-all duration-200
          ${step === 2 ? 'ring-2 ring-primary bg-background' : ''}
          ${arrivalStation ? 'bg-accent/10' : 'bg-muted/50'}
        `}>
          <Navigation className={`w-5 h-5 flex-shrink-0 ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`} />
          <AddressSearch
            onAddressSelect={onAddressSearch}
            disabled={step !== 2}
            placeholder="Search for a station to return the car"
            selectedStation={arrivalStation}
          />
          {arrivalStation && (
            <button
              onClick={() => {
                dispatch(clearArrivalStation());
                toast.success('Arrival station cleared');
              }}
              className="p-1 hover:bg-muted rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Step {step} of 2</span>
            <span>•</span>
            <span>
              {step === 1 ? 'Select departure station' : 'Select arrival station'}
            </span>
          </div>
          {departureStation && arrivalStation && (
            <div className="text-xs font-medium">
              Total Route: {((departureStation.distance || 0) + (arrivalStation.distance || 0)).toFixed(1)} km
            </div>
          )}
        </div>

        {/* Validation Messages */}
        {departureId && arrivalId && departureId === arrivalId && (
          <div className="flex items-center gap-2 px-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>Departure and arrival stations cannot be the same</span>
          </div>
        )}
      </div>
    </div>
  );
}
