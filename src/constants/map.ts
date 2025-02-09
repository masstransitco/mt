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
  // A stylized car arrow path, can be further refined
  const carPath = `
  M0,1
  L-2,2
  L0,-2
  L2,2
  L0,1
  Z
`;

  // A diamond shape (for active station)
  const diamondPath = 'M 0 -1 L 1 0 0 1 -1 0 z';

  // A subtle “pin” shape for the user location
  // Overlaps a circle on top of a small rectangular tail
const userPinPath = `
  M -3 1
  L -3 -1
  L -2 -1
  L -1 -1
  L -1 1
  A 1 1 0 0 0 -2 2
  A 1 1 0 0 0 -3 1
  Z
`;

  // A hexagon shape for the default station marker
  // Offers a more distinct geometry than just a circle
  const hexagonPath = `
    M 0,-1
    L 0.866,-0.5
    L 0.866,0.5
    L 0,1
    L -0.866,0.5
    L -0.866,-0.5
    Z
  `;

  return {
    // 1) User Location - a pin shape in a gentle sky-blue
    user: {
      path: userPinPath,
      scale: 10,
      fillColor: '#93C5FD',   // Light blue (Tailwind blue-300)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF', // White stroke for clarity
      anchor: new google.maps.Point(0, 2), // slightly offset the anchor
    },

    // 2) Default station marker - a hexagon with a warm gray fill
    station: {
      path: hexagonPath,
      scale: 9,
      fillColor: '#6B7280',   // Gray (Tailwind gray-500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 3) Active station (user has clicked) - diamond with a soft peach fill
    //    to convey a gentle highlight.
    activeStation: {
      path: diamondPath,
      scale: 10,
      fillColor: '#F9A8D4',   // Pink (Tailwind pink-300)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },

    // 4) Confirmed departure station - circle with teal fill
    //    Slightly smaller scale than default so it’s distinct from the hex.
    departureStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#14B8A6',   // Teal (Tailwind teal-500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9', // Very light gray stroke
    },

    // 5) Confirmed arrival station - circle with dusty purple fill
    arrivalStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#8B5CF6',   // Violet (Tailwind violet-500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9',
    },

    // 6) Car marker - arrow-like shape in a lively royal blue
    //    with a bright accent stroke. 
    car: {
      path: carPath,
      scale: 10,
      fillColor: '#3B82F6',    // Vibrant Blue (Tailwind blue-500)
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#BFDBFE',  // Lighter blue stroke (Tailwind blue-200)
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
