// src/constants/map.ts

import type { Libraries } from '@react-google-maps/api';

// Base map configuration - safe for SSR
export const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

export const DEFAULT_CENTER = {
  lat: 22.280,
  lng: 114.175,
};

export const DEFAULT_ZOOM = 12;

// Zoom threshold for expanded marker state
export const MARKER_POST_MIN_ZOOM = 15;

export const LIBRARIES: Libraries = [
  "geometry",
  "places",
  "marker",
  "maps3d" as any,
];

// Map boundaries for Hong Kong (expanded)
export const HK_BOUNDS = {
  north: 22.8,  // Expanded north bound
  south: 21.9,  // Expanded south bound
  east: 114.6,  // Expanded east bound
  west: 113.6,  // Expanded west bound
};


// Create map options with a dark theme
export const createMapOptions = (): google.maps.MapOptions => ({
  disableDefaultUI: true,
  zoomControl: false, // hide zoom controls
  gestureHandling: 'greedy',
  rotateControl: true, // Enable rotate control for camera animations
  // @ts-ignore
  tiltControl: true, // Enable tilt control for camera animations
  backgroundColor: '#212121',
  maxZoom: 20,
  minZoom: 3,
  clickableIcons: false,
  mapId: 'f2f6c137cc748dc3',
  restriction: {
    latLngBounds: HK_BOUNDS,
    strictBounds: true,
  },
  tilt: 0, // Initial tilt set to 0
  heading: 0, // Initial heading set to 0
});

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
      path: google?.maps?.SymbolPath?.CIRCLE,
      scale: 10,
      fillColor: '#0717f5',   // Light blue
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
      fillOpacity: 0,   // <--- temporary hiding the station markers
      strokeWeight: 2,
      strokeColor: '#1C1C1F',
      strokeOpacity: 0,
    },
    // 3) Example special station marker (ICC)
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
      path: userPinPath,
      scale: 9,
      fillColor: '#0717f5',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#F1F5F9',
    },
    // 5) Arrival station
    arrivalStation: {
      path: userPinPath,
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

// A “shadow” polyline (thicker, dark stroke)
export const DISPATCH_ROUTE_LINE_OPTIONS_SHADOW: google.maps.PolylineOptions = {
  strokeColor: "#2B2B2B",  // dark gray
  strokeWeight: 8,         // slightly thicker
  strokeOpacity: 0.9,
  geodesic: true,
  zIndex: 90,              // draw under the main line
};

// A “foreground” polyline (white or light gray)
export const DISPATCH_ROUTE_LINE_OPTIONS_FOREGROUND: google.maps.PolylineOptions = {
  strokeColor: "#f5f5f5",  // light gray/white
  strokeWeight: 5,
  strokeOpacity: 1,
  geodesic: true,
  zIndex: 100,             // draw on top
};

export const ROUTE_LINE_OPTIONS_SHADOW: google.maps.PolylineOptions = {
  strokeColor: "#0A2239", // a darker "navy" or "blueprint"
  strokeWeight: 8,
  strokeOpacity: 0.9,
  geodesic: true,
  zIndex: 80, // slightly behind the normal route's lines
};

export const ROUTE_LINE_OPTIONS_FOREGROUND: google.maps.PolylineOptions = {
  strokeColor: "#03A9F4", // bright "Uber-ish" blue
  strokeWeight: 5,
  strokeOpacity: 1,
  geodesic: true,
  zIndex: 90,
};

// For the Places API usage in StationSelector
export const PLACES_OPTIONS = {
  componentRestrictions: {
    country: 'HK',
  },
  types: ['address'],
};

export const SEARCH_DEBOUNCE_MS = 300;