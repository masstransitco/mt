// src/types/google-maps-augment.d.ts
/* eslint-disable @typescript-eslint/no-unused-vars */
export {}; // makes this file a module

declare global {
  namespace google.maps.marker {
    interface AdvancedMarkerElement {
      /**
       * Arbitrary metadata we store on each marker.
       * `useMarkerOverlay` guarantees this object exists right after the marker
       * is instantiated, so downstream code can read/write to it safely.
       */
      userData?: {
        lastUpdated?: number;
        [key: string]: unknown;
      };

      /**
       * We always set `position` immediately after creating the marker, so for
       * practical purposes downstream code can treat it as non‑nullable.
       */
      position: google.maps.LatLng;
    }
  }
}