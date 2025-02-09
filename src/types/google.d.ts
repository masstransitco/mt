// src/types/google.d.ts

declare namespace google.maps {
  /**
   * The experimental WebGLOverlayView class, introduced in Maps JS v3.50+.
   * You can adapt/expand these method signatures as needed.
   */
  class WebGLOverlayView extends google.maps.MVCObject {
    onAdd?(): void;
    onContextLost?(): void;
    onContextRestored?(params: { gl: WebGLRenderingContext }): void;
    onDraw?(params: {
      gl: WebGLRenderingContext;
      transformer?: any; // This could be typed more specifically if you have details
    }): void;
    onRemove?(): void;
    setMap(map: google.maps.Map | null): void;
    getMap(): google.maps.Map | null;
  }
}

declare namespace google.maps.places {
  // (Your existing types remain unchanged below)
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
