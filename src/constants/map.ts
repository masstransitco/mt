// src/constants/map.ts

import type { Libraries } from '@react-google-maps/api';

// Base map configuration - safe for SSR
export const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

export const DEFAULT_CENTER = {
  lat: 22.3,
  lng: 114.0,
};

export const DEFAULT_ZOOM = 14;

export const LIBRARIES: Libraries = ['geometry', 'places'];

// Map boundaries for Hong Kong
export const HK_BOUNDS = {
  north: 22.6,
  south: 22.1,
  east: 114.4,
  west: 113.8,
};

// Dark minimalist map styling
export const MAP_STYLES = [
  // 1) General text fill: a warm off-white for better contrast on dark
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#EAEAEA' }],
  },
  // 2) Subtle text stroke that merges with the background
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#1E1E1E' },
      { lightness: -100 },
      { visibility: 'simplified' },
    ],
  },
  // 3) Hide administrative boundaries
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  // 4) Landscape in a deep neutral
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#1B1B1B' }],
  },
  // 5) Points of Interest (POI) in a slightly different dark shade
  //    to differentiate them from the landscape
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#202020' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  // 6) Roads
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2B2B2B' }], // Slightly lighter than the landscape
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#353535' }], // Subtle stroke
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#999999' }], // Mid-gray for road labels
  },
  // 7) Arterial roads
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#333333' }],
  },
  // 8) Highways
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3F3F3F' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4A4A4A' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#777777' }],
  },
  // 9) Transit icons & labels hidden
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  // 10) Water - a deeper navy to contrast the dark land
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0E1621' }], // deep navy
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3A3A3A' }],
  },
];

// Create map options with a dark theme
export const createMapOptions = (): google.maps.MapOptions => ({
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  backgroundColor: '#212121',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
  styles: MAP_STYLES,
  restriction: {
    latLngBounds: HK_BOUNDS,
    strictBounds: true,
  },
});

// Marker icons factory - implementing the dark-themed marker plan
export const createMarkerIcons = () => {

    const carPath = `
        M 0,-1
    L 0.8,0 
    L 0.25,0
    L 0.25,1
    L -0.25,1
    L -0.25,0
    L -0.8,0
    Z
  `;
  // A diamond shape (for active station)
  const diamondPath = 'M 0 -1 L 1 0 0 1 -1 0 z';

  return {
    // 1) User Location
    //    A simple circle with a subtle accent fill.
    user: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 7,
      fillColor: '#A3BFFA',     // Soft periwinkle
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',   // White stroke for clarity
    },

    // 2) Default station marker
    //    A low-saturation gray fill with a white stroke for high contrast.
    station: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 8,
      fillColor: '#5F5F5F',     // Muted gray
      fillOpacity: 0.9,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 3) Active station (user has clicked) 
    //    A diamond shape with a soft teal fill to highlight “active” selection.
    activeStation: {
      path: diamondPath,
      scale: 9,
      fillColor: '#5EEAD4',     // Soft teal (Tailwind teal‑300)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 4) Confirmed departure station
    //    A circle in a slightly more saturated teal to convey “locked in.”
    departureStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#14B8A6',     // Teal (Tailwind teal‑500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9',   // Very light gray stroke
    },

    // 5) Confirmed arrival station
    //    A circle in a soft violet, distinct from teal but still harmonious.
    arrivalStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#8B5CF6',     // Violet (Tailwind violet‑500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9', 
    },

    // 6) Car marker
    //    A slightly smaller circle in neutral gray with a subtle stroke accent.
        car: {
      path: carPath,
      scale: 9,
      fillColor: '#3B82F6',       // Vibrant “Blue” (Tailwind blue-500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#DBEAFE',
    },
  };
};

// For the Places API usage in StationSelector
export const PLACES_OPTIONS = {
  componentRestrictions: {
    country: 'HK',
  },
  types: ['address'],
};

// Debounce time for address searches
export const SEARCH_DEBOUNCE_MS = 300;
