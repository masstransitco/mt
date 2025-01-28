import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, X, AlertCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectBookingStep } from '@/store/bookingSlice';
import {
  selectDepartureStationId,
  selectArrivalStationId,
  clearDepartureStation,
  clearArrivalStation,
  setViewState
} from '@/store/userSlice';
import { selectStationsWithDistance } from '@/store/stationsSlice';
import debounce from 'lodash/debounce';

interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  disabled?: boolean;
  placeholder: string;
}

const AddressSearch = ({ onAddressSelect, disabled, placeholder }: AddressSearchProps) => {
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
        setSearchText(prediction.description);
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
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-transparent border-none focus:outline-none disabled:cursor-not-allowed"
        />
        {searchText && (
          <button
            onClick={() => {
              setSearchText('');
              setPredictions([]);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
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
              {prediction.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function EnhancedStationSelector() {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const stations = useAppSelector(selectStationsWithDistance);

  const departureStation = stations.find(s => s.id === departureId);
  const arrivalStation = stations.find(s => s.id === arrivalId);

  const handleAddressSelect = (location: google.maps.LatLngLiteral) => {
    // Pan map to selected location
    if (window.google) {
      const map = document.querySelector('[aria-label="Map"]');
      if (map) {
        const googleMap = (map as any).__SECRET_MAP_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
        if (googleMap) {
          googleMap.panTo(location);
          googleMap.setZoom(16);
        }
      }
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg">
      <div className="p-4 space-y-3">
        {/* Departure Input */}
        <div className={`
          flex items-center gap-2 p-3 rounded-lg transition-all duration-200
          ${step === 1 ? 'ring-2 ring-primary bg-background' : 'bg-accent/10'}
          ${departureId ? 'bg-accent/10' : 'bg-muted/50'}
        `}>
          <MapPin className={`w-5 h-5 ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`} />
          <AddressSearch
            onAddressSelect={handleAddressSelect}
            disabled={step !== 1}
            placeholder="Search or choose departure station"
          />
          {departureStation && (
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 text-xs bg-muted rounded-full">
                {departureStation.properties.Place}
              </div>
              <button
                onClick={() => {
                  dispatch(clearDepartureStation());
                  toast.success('Departure station cleared');
                }}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Arrival Input */}
        <div className={`
          flex items-center gap-2 p-3 rounded-lg transition-all duration-200
          ${step === 2 ? 'ring-2 ring-primary bg-background' : 'bg-accent/10'}
          ${arrivalId ? 'bg-accent/10' : 'bg-muted/50'}
        `}>
          <Navigation className={`w-5 h-5 ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`} />
          <AddressSearch
            onAddressSelect={handleAddressSelect}
            disabled={step !== 2}
            placeholder="Search or choose arrival station"
          />
          {arrivalStation && (
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 text-xs bg-muted rounded-full">
                {arrivalStation.properties.Place}
              </div>
              <button
                onClick={() => {
                  dispatch(clearArrivalStation());
                  toast.success('Arrival station cleared');
                }}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
