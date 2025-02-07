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
  // A diamond shape (for active station) as an SVG path string
  // M 0 -1 L 1 0 0 1 -1 0 z  => simple diamond around origin
  const diamondPath = 'M 0 -1 L 1 0 0 1 -1 0 z';

  return {
    // 1) User Location (blue circle)
    user: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 7,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 2) Default station marker (dark circle)
    station: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 6,
      fillColor: '#2E2E2E',   // dark gray fill
      fillOpacity: 0.9,
      strokeWeight: 2,
      strokeColor: '#444',    // slightly lighter gray stroke
    },

    // 3) Active station (user has clicked or hovered; highlight)
    //    Using a diamond shape with a bright accent color
    activeStation: {
      path: diamondPath,
      scale: 8,
      fillColor: '#48BB78',   // accent (green)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 4) Confirmed departure station (circle with teal fill)
    departureStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 8,
      fillColor: '#38B2AC',   // teal
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 5) Confirmed arrival station (circle with purple fill)
    arrivalStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 8,
      fillColor: '#A78BFA',   // purple
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // Car marker (simple circle, dark fill with a subtle accent stroke)
    car: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 7,
      fillColor: '#333333',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#48BB78', // green stroke or a brand accent
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
