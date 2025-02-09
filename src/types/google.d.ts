// src/types/google.d.ts

import type * as THREE from 'three';

declare global {
  namespace google.maps {
    /**
     * The experimental WebGLOverlayView class, introduced in Maps JS v3.50+.
     * Make sure you load the Maps JavaScript API with a version that
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
        transformer?: any; // Replace 'any' with a known type if available
      }): void;

      /**
       * Return the custom WebGLCamera that Google Maps uses for
       * positioning & projecting the 3D scene.
       */
      getCamera(): google.maps.WebGLCamera;

      // Standard setMap / getMap
      setMap(map: google.maps.Map | null): void;
      getMap(): google.maps.Map | null;
    }

    /**
     * Minimal interface for Google's WebGLCamera.
     * We extend THREE.Camera so you can still use typical Three.js
     * camera properties/methods in your code.
     */
    interface WebGLCamera extends THREE.Camera {
      // Add Google-specific properties or methods if needed
      // e.g. heading, tilt, etc.
    }
  }

  namespace google.maps.places {
    // (Existing places definitions remain unchanged)
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
        callback?: (
          predictions: AutocompletePrediction[],
          status: string
        ) => void
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
}

// Dummy export to mark this file as a module
export {};
