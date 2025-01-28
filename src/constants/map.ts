import type { Libraries } from '@react-google-maps/api';

// Map styling - Dark minimalist theme
export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ffffff' }]
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#212121' }, { lightness: -100 }, { visibility: 'simplified' }]
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#212121' }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#262626' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#373737' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a8a' }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#373737' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3c3c3c' }]
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }]
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#616161' }]
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d3d3d' }]
  }
];

// Base map configuration
export const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
};

export const DEFAULT_CENTER = { 
  lat: 22.3, 
  lng: 114.0 
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

// Map styling options
export const MAP_OPTIONS: google.maps.MapOptions = {
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
};

// Marker icons and styling
export const MARKER_ICONS = {
  user: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: '#4285F4',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#FFFFFF',
  },
  departureStation: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#22C55E',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#FFFFFF',
  },
  arrivalStation: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#EF4444',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#FFFFFF',
  },
  activeStation: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: '#6B7280',
    fillOpacity: 0.8,
    strokeWeight: 2,
    strokeColor: '#FFFFFF',
  },
  inactiveStation: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 5,
    fillColor: '#6B7280',
    fillOpacity: 0.6,
    strokeWeight: 2,
    strokeColor: '#FFFFFF',
  },
  car: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#333333',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#0000FF',
  },
};

// Places API configuration
export const PLACES_OPTIONS = {
  componentRestrictions: { 
    country: 'HK' 
  },
  types: ['address']
};

// Search debounce timeout (in milliseconds)
export const SEARCH_DEBOUNCE_MS = 300;
