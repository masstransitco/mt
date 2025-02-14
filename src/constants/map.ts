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
    stylers: [{ color: '#EAEAEA' }],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#1E1E1E' },
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
    stylers: [{ color: '#1B1B1B' }],
  },
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
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2B2B2B' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#353535' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#999999' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#333333' }],
  },
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
    stylers: [{ color: '#0E1621' }],
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
  zoomControl: false, // hide zoom controls
  gestureHandling: 'greedy',
  backgroundColor: '#212121',
  maxZoom: 18,
  minZoom: 8,
  clickableIcons: false,
  styles: MAP_STYLES,
  mapTypeId: 'roadmap',
  restriction: {
    latLngBounds: HK_BOUNDS,
    strictBounds: true,
  },
  tilt: 45,
});

// ----- NEW ADDITIONS -----

/**
 * The dispatch hub (previously `hongKongCenter`).
 * We anchor the ThreeJSOverlayView here for 3D transformations.
 */
export const DISPATCH_HUB = {
  lat: 22.298,
  lng: 114.177,
  altitude: 0,
};

/**
 * A special marker location for demonstration: 
 * International Commerce Centre (ICC).
 */
export const INTER_CC = {
  lat: 22.304,
  lng: 114.160,
};

// Marker icons factory
export const createMarkerIcons = () => {
  const carPath = `
    M0,0.3
    L-0.6,0.6
    L0,-0.6
    L0.6,0.6
    L0,0.3
    Z
  `;

  const diamondPath = 'M 0 -1 L 1 0 0 1 -1 0 z';

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

  const hexagonPath = `
    M -1,1
    L -1,-1
    L 1,-1
    L 1,1
    L -1,1
    Z
  `;

  return {
    // 1) User Location
    user: {
      path: userPinPath,
      scale: 10,
      fillColor: '#93C5FD',   // Light blue
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF', 
      anchor: new google.maps.Point(0, 2),
    },
    // 2) Default station marker
    station: {
      path: hexagonPath,
      scale: 9,
      fillColor: '#C9C9C9',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#1C1C1F',
    },
    // 3) Previously 'activeStation' -> now 'icc'
    icc: {
      path: diamondPath,
      scale: 10,
      fillColor: '#F9A8D4', // Pink
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
    },
    // 4) Departure station
    departureStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#0717f5',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9',
    },
    // 5) Arrival station
    arrivalStation: {
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 9,
      fillColor: '#A8161B',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9',
    },
    // 6) Car marker
    car: {
      path: carPath,
      scale: 10,
      fillColor: '#161617',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#f5f5f7',
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

export const SEARCH_DEBOUNCE_MS = 300;
