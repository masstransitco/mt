// src/types/google.d.ts

// If you need to reference THREE types, ensure you import it as a type:
import type * as THREE from 'three';

declare namespace google.maps {
  /**
   * The experimental WebGLOverlayView class, introduced in Maps JS v3.50+.
   * Note that you need to load the Maps JavaScript API with a version that
   * includes WebGLOverlayView (e.g. "beta" or "weekly").
   */
  class WebGLOverlayView extends google.maps.MVCObject {
    // Optional lifecycle methods
    onAdd?(): void;
    onRemove?(): void;
    onContextLost?(): void;
    onContextRestored?(params: { gl: WebGLRenderingContext }): void;
    onDraw?(params: {
      gl: WebGLRenderingContext;
      transformer?: any; // You can replace 'any' with a known type if available
    }): void;

    /**
     * Return the custom WebGLCamera that Google Maps uses for
     * positioning & projecting the 3D scene.
     * No longer marked as optional, to satisfy getCamera() calls.
     */
    getCamera(): google.maps.WebGLCamera;

    // Standard setMap / getMap
    setMap(map: google.maps.Map | null): void;
    getMap(): google.maps.Map | null;
  }

  /**
   * Minimal interface for Google's WebGLCamera.
   * You can expand this if you need more properties/methods.
   * We extend THREE.Camera so you can still use typical Three.js
   * camera properties/methods in your code.
   */
  interface WebGLCamera extends THREE.Camera {
    // e.g. additional Google-specific properties or methods
    // projectionMatrix: THREE.Matrix4; // if you want to type it
  }
}

declare namespace google.maps.places {
  // (Your existing places definitions remain unchanged below)
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
