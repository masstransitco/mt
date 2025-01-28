// src/types/google.d.ts
declare namespace google.maps.places {
  interface AutocompletePrediction {
    description: string;
    place_id: string;
    structured_formatting: {
      main_text: string;
      secondary_text: string;
    };
  }

  class AutocompleteService {
    getPlacePredictions(
      request: {
        input: string;
        componentRestrictions?: { country: string };
        types?: string[];
      },
      callback?: (predictions: AutocompletePrediction[], status: string) => void
    ): Promise<{ predictions: AutocompletePrediction[] }>;
  }

  class Geocoder {
    geocode(
      request: { placeId: string } | { address: string },
      callback?: (
        results: google.maps.GeocoderResult[],
        status: google.maps.GeocoderStatus
      ) => void
    ): Promise<google.maps.GeocoderResponse>;
  }
}
