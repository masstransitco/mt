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
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#212121' },
      { lightness: -100 },
      { visibility: 'simplified' },
    ],
  },
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
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#212121' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#262626' }],
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
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#373737' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#373737' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }],
  },
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
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d3d' }],
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
