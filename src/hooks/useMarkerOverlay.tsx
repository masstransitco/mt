"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { store, useAppDispatch, useAppSelector } from "@/store/store"
import { selectStationsWithDistance, type StationFeature } from "@/store/stationsSlice"
import { selectStations3D } from "@/store/stations3DSlice"
import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  selectRoute as selectBookingRoute
} from "@/store/bookingSlice"
import { selectDispatchRoute } from "@/store/dispatchSlice"
import { selectListSelectedStationId } from "@/store/userSlice"
import "@/styles/marker-styles.css"
import stationSelectionManager from "@/lib/stationSelectionManager"
import cameraAnimationManager from "@/lib/cameraAnimationManager"
import { setScannedCar, fetchCarByRegistration } from "@/store/carSlice";
import { toast } from "react-hot-toast"
import { removeStation } from "@/store/stationsSlice";

// Improved types for marker-related data
interface MarkerData {
  position: google.maps.LatLngAltitudeLiteral;
  stationData: StationFeature;
  marker: google.maps.marker.AdvancedMarkerElement | null;
  isVirtualCarLocation?: boolean;
}

interface MarkerStateConfig {
  state: MarkerState;
  isExpanded: boolean;
  isVirtual: boolean;
  isImportant: boolean;
}

// Type for marker state to improve type safety
type MarkerState = "normal" | "departure" | "arrival" | "listSelected" | "qr" | "virtual" | "pickupDropoff";

// Using inline console.log instead of helper function for development logging

// CENTRALIZED HELPER FUNCTIONS
// ---------------------------

// Get a complete marker state configuration - consolidated helper function
function getMarkerStateConfig(
  station: StationFeature,
  departureStationId: number | null,
  arrivalStationId: number | null,
  listSelectedStationId: number | null
): MarkerStateConfig {
  const isVirtual = station.properties?.isVirtualCarLocation === true;
  const isImportant = station.id === departureStationId || 
                     station.id === arrivalStationId || 
                     station.id === listSelectedStationId;
  
  // Determine state using simplified precedence rules
  let state: MarkerState = "normal";
  if (isVirtual && station.id === departureStationId) state = "qr";
  else if (station.id === departureStationId && station.id === arrivalStationId) state = "pickupDropoff";
  else if (station.id === departureStationId) state = "departure";
  else if (station.id === arrivalStationId) state = "arrival";
  else if (station.id === listSelectedStationId) state = "listSelected";
  else if (isVirtual) state = "virtual";
  
  // Determine if expanded
  const isNearestSelected = station.id === listSelectedStationId && 
                           station.id !== departureStationId &&
                           station.id !== arrivalStationId;
  const isExpanded = station.id === departureStationId || 
                    station.id === arrivalStationId || 
                    isNearestSelected ||
                    (isVirtual && station.id === departureStationId);
  
  return { state, isExpanded, isVirtual, isImportant };
}

// Get stations that should be displayed based on various criteria
function getStationsToDisplay(
  visibleStationIds: number[],
  stationsRef: {
    [stationId: number]: MarkerData
  },
  importantStationIds: Set<number>,
  bookingStep: number
): Set<number> {
  // Start with important stations which are always visible
  const stationsToShow = new Set<number>(importantStationIds);
  
  // Performance optimization: In bookingStep 2 and 4, only show essential markers
  if (bookingStep !== 2 && bookingStep !== 4) {
    // In steps 1 and 3, show all stations in view
    visibleStationIds.forEach(id => stationsToShow.add(id));
  }
  
  // Also add any virtual car stations (always visible)
  Object.entries(stationsRef).forEach(([id, data]) => {
    if (data.isVirtualCarLocation) {
      stationsToShow.add(Number(id));
    }
  });
  
  return stationsToShow;
}

// Check if selection state changed, with special case for cleared selection
function hasSelectionStateChanged(
  prev: { 
    departure: number | null, 
    arrival: number | null, 
    selected: number | null, 
    step: number 
  },
  current: { 
    departure: number | null, 
    arrival: number | null, 
    selected: number | null, 
    step: number 
  }
): boolean {
  // Special case for cleared selection
  const listSelectedCleared = prev.selected !== null && current.selected === null;
  
  return prev.departure !== current.departure ||
         prev.arrival !== current.arrival ||
         prev.selected !== current.selected ||
         prev.step !== current.step ||
         listSelectedCleared;
}

// Track event listeners for proper cleanup
const markerEventListeners = new Map<number, (() => void)[]>();

// CSS class map for marker states
const MARKER_STATE_CLASSES = {
  qr: "marker-qr",
  virtual: "marker-virtual",
  departure: "marker-departure",
  arrival: "marker-arrival",
  listSelected: "marker-selected",
  normal: "marker-normal",
  pickupDropoff: "marker-pickup-dropoff"
};

// DOM MANIPULATION UTILITIES
// -------------------------

// Apply marker classes based on marker state
function applyMarkerClasses(
  element: HTMLElement,
  stateConfig: MarkerStateConfig
): void {
  // Remove all existing state classes (mutually exclusive)
  Object.values(MARKER_STATE_CLASSES).forEach(cls => {
    element.classList.remove(cls);
  });
  
  // Apply new state class
  element.classList.add(MARKER_STATE_CLASSES[stateConfig.state]);
  
  // Apply virtual status class
  element.classList.toggle('virtual-car', stateConfig.isVirtual);
  
  // Apply expanded state class
  element.classList.toggle('marker-expanded-state', stateConfig.isExpanded);
  
  // Apply importance class
  element.classList.toggle('marker-important', stateConfig.isImportant);
}

// Toggle marker expansion state
function toggleMarkerExpansion(
  container: HTMLElement,
  isExpanded: boolean
): void {
  const collapsedWrapper = container.querySelector('.marker-wrapper.collapsed') as HTMLElement;
  const expandedWrapper = container.querySelector('.marker-wrapper.expanded') as HTMLElement;
  
  if (!collapsedWrapper || !expandedWrapper) return;
  
  // Update visibility classes for wrappers
  if (isExpanded) {
    collapsedWrapper.classList.remove('visible');
    expandedWrapper.classList.add('visible');
    expandedWrapper.classList.add('expanded-wrapper-visible');
    expandedWrapper.classList.remove('expanded-wrapper-hidden');
  } else {
    collapsedWrapper.classList.add('visible');
    expandedWrapper.classList.remove('visible');
    expandedWrapper.classList.remove('expanded-wrapper-visible');
    expandedWrapper.classList.add('expanded-wrapper-hidden');
  }
}

// Initialize a marker element from template
function initializeMarkerElement(stationId: number): HTMLElement {
  const template = getMarkerTemplate();
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const container = clone.firstElementChild as HTMLElement;
  
  // Set station ID as data attribute for event delegation
  const collapsedMarker = container.querySelector('.marker-collapsed') as HTMLElement;
  if (collapsedMarker) {
    collapsedMarker.setAttribute('data-station-id', stationId.toString());
  }
  
  // Make container visible and apply basic classes
  container.classList.add('visible', 'marker-container-sizing');
  
  return container;
}

// Add tracked event listener with automatic cleanup
function addTrackedEventListener(
  stationId: number, 
  element: HTMLElement, 
  eventType: string, 
  handler: (e: Event) => void
): void {
  element.addEventListener(eventType, handler);
  
  // Store cleanup function
  if (!markerEventListeners.has(stationId)) {
    markerEventListeners.set(stationId, []);
  }
  
  markerEventListeners.get(stationId)?.push(() => {
    element.removeEventListener(eventType, handler);
  });
}

// Clean up event listeners for a station
function cleanupMarkerListeners(stationId: number): void {
  const listeners = markerEventListeners.get(stationId) || [];
  listeners.forEach(cleanup => cleanup());
  markerEventListeners.delete(stationId);
}

// Update virtual station content
function updateVirtualStationContent(
  container: HTMLElement,
  station: StationFeature
): void {
  const expandedInfoSection = container.querySelector('.expanded-info-section') as HTMLElement;
  const virtualIndicator = expandedInfoSection?.querySelector('.compact-virtual-indicator') as HTMLElement;
  const carPlateContainer = container.querySelector('.car-plate-container') as HTMLElement;
  const carPlate = carPlateContainer?.querySelector('.car-plate') as HTMLElement;
  
  if (carPlateContainer) {
    carPlateContainer.classList.add('virtual-car-plate-container');
  }
  
  if (expandedInfoSection?.querySelector('.expanded-wrapper')) {
    (expandedInfoSection.querySelector('.expanded-wrapper') as HTMLElement).classList.add('expanded-wrapper-full');
  }
  
  // Show virtual indicator
  if (virtualIndicator) {
    virtualIndicator.classList.remove('hidden');
  }
  
  // Set car registration info
  const plateTitle = carPlate?.querySelector('.plate-title') as HTMLElement;
  const plateNumber = carPlate?.querySelector('.plate-number') as HTMLElement;
  
  if (carPlate && plateTitle && plateNumber) {
    const plateNumberText = station.properties.registration || station.properties.plateNumber || '';
    const vehicleModel = station.properties.Place ? 
                      station.properties.Place.split('[')[0].trim() : 
                      'Electric Vehicle';
    
    if (plateNumberText) {
      plateTitle.textContent = vehicleModel;
      plateNumber.textContent = plateNumberText;
      carPlate.classList.remove('hidden');
    } else {
      carPlate.classList.add('hidden');
    }
  }
}

// Update standard station content
function updateStandardStationContent(
  container: HTMLElement,
  station: StationFeature,
  stateConfig: MarkerStateConfig,
  departureStationId: number | null,
  arrivalStationId: number | null
): void {
  const expandedInfoSection = container.querySelector('.expanded-info-section') as HTMLElement;
  const virtualIndicator = expandedInfoSection?.querySelector('.compact-virtual-indicator') as HTMLElement;
  const carPlateContainer = container.querySelector('.car-plate-container') as HTMLElement;
  const carPlate = carPlateContainer?.querySelector('.car-plate') as HTMLElement;
  
  // Hide virtual station elements
  if (carPlateContainer) {
    carPlateContainer.classList.add('car-plate-hidden');
  }
  
  if (virtualIndicator) {
    virtualIndicator.classList.add('hidden');
  }
  
  if (carPlate) {
    carPlate.classList.add('hidden');
  }
  
  // Set basic station info
  const titleEl = expandedInfoSection?.querySelector('.info-title') as HTMLElement;
  const valueEl = expandedInfoSection?.querySelector('.info-value') as HTMLElement;
  
  if (titleEl) {
    // Determine station role
    const stationStatus = (station.id === departureStationId && station.id === arrivalStationId) ? 'pickupdropoff' :
                          station.id === departureStationId ? 'pickup' :
                          station.id === arrivalStationId ? 'dropoff' : 'nearest';
    titleEl.setAttribute('data-station-status', stationStatus);
    
    // Set the text content based on role
    titleEl.textContent = (station.id === departureStationId && station.id === arrivalStationId) ? 'PICKUP & DROPOFF' :
                          station.id === departureStationId ? 'Pickup' : 
                          station.id === arrivalStationId ? 'Dropoff' : 'NEAREST';
  }
  
  if (valueEl) {
    valueEl.textContent = station.properties.Address || (station.properties.Place || 'Station').replace(/\[.*\]/, '');
    valueEl.className = 'info-value info-value-base ' + (stateConfig.isImportant ? 'info-value-selected' : 'info-value-normal');
  }
  
  if (expandedInfoSection) {
    expandedInfoSection.classList.add('expanded-info-compact');
  }
}

// Update marker content based on station and state
function updateMarkerContent(
  container: HTMLElement,
  station: StationFeature,
  stateConfig: MarkerStateConfig,
  departureStationId: number | null,
  arrivalStationId: number | null
): void {
  // Apply expanded marker styling
  const expandedMarker = container.querySelector('.marker-expanded') as HTMLElement;
  if (expandedMarker) {
    expandedMarker.classList.add('marker-content-compact');
    expandedMarker.classList.toggle('marker-expanded-selected', stateConfig.isImportant);
  }
  
  // Update content based on virtual status
  if (stateConfig.isVirtual) {
    updateVirtualStationContent(container, station);
  } else {
    updateStandardStationContent(container, station, stateConfig, departureStationId, arrivalStationId);
  }
}

// Set up click handler for station
function setupStationClickHandler(
  stationId: number,
  container: HTMLElement,
  handleStationClick: (stationId: number) => void,
  shouldAddClickHandler: boolean
): void {
  // Clean up any existing handlers
  cleanupMarkerListeners(stationId);
  
  // Add click handler if needed
  if (shouldAddClickHandler) {
    const collapsedMarker = container.querySelector('.marker-collapsed') as HTMLElement;
    if (collapsedMarker) {
      // Set station ID for event delegation
      collapsedMarker.setAttribute('data-station-id', stationId.toString());
      
      const clickHandler = (ev: Event) => {
        ev.stopPropagation();
        handleStationClick(stationId);
      };
      
      addTrackedEventListener(stationId, collapsedMarker, 'click', clickHandler);
    }
  }
}

// TEMPLATES
// ---------

// Cached templates for marker elements (singleton pattern)
let markerTemplateCache: HTMLTemplateElement | null = null;
let routeMarkerTemplateCache: HTMLTemplateElement | null = null;

// Create template for markers
function getMarkerTemplate(): HTMLTemplateElement {
  if (!markerTemplateCache) {
    markerTemplateCache = document.createElement('template');
    markerTemplateCache.innerHTML = `
      <div class="marker-container">
        <!-- Collapsed view -->
        <div class="marker-wrapper collapsed">
          <div class="marker-collapsed" data-station-id=""></div>
          <div class="marker-post marker-post-standard"></div>
        </div>
        
        <!-- Expanded view -->
        <div class="marker-wrapper expanded">
          <div class="marker-expanded">
            <!-- Info section - simplified to avoid duplication with StationDetail -->
            <div class="expanded-info-section info-section">
              <div class="info-title info-title-style"></div>
              <div class="info-value info-value-base"></div>
              <div class="compact-virtual-indicator hidden">Scanned Vehicle</div>
            </div>
            
            <!-- Car plate indicator for virtual stations -->
            <div class="car-plate-container">
              <div class="car-plate virtual-car-plate hidden">
                <div class="plate-title plate-title-style"></div>
                <div class="plate-number plate-number-style"></div>
              </div>
            </div>
            
          </div>
          <div class="marker-post marker-post-standard"></div>
        </div>
      </div>
    `;
  }
  return markerTemplateCache;
}

// Create template for route markers
function getRouteMarkerTemplate(): HTMLTemplateElement {
  if (!routeMarkerTemplateCache) {
    routeMarkerTemplateCache = document.createElement('template');
    routeMarkerTemplateCache.innerHTML = `
      <div class="route-marker-container route-marker-container--hidden">
        <div class="route-marker-wrapper">
          <div class="route-box"></div>
          <div class="route-post marker-post-standard"></div>
        </div>
      </div>
    `;
  }
  return routeMarkerTemplateCache;
}

// -----------------------
// Spatial Indexing System
// -----------------------

// Bounds interface for spatial queries
interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Point interface for spatial indexing
interface Point {
  lat: number;
  lng: number;
  id: number;
}

// QuadTree node for efficient spatial indexing
class QuadTreeNode {
  private bounds: Bounds;
  private points: Point[] = [];
  private divided = false;
  private maxPoints = 8;
  private level: number;
  private maxLevel = 6;
  
  // Children quadrants
  private northWest?: QuadTreeNode;
  private northEast?: QuadTreeNode;
  private southWest?: QuadTreeNode;
  private southEast?: QuadTreeNode;
  
  constructor(bounds: Bounds, level: number) {
    this.bounds = bounds;
    this.level = level;
  }
  
  // Insert a point into the quadtree
  insert(point: Point): boolean {
    // Point is outside this quad
    if (!this.containsPoint(point)) {
      return false;
    }
    
    // If we have space or at max level, add here
    if (this.points.length < this.maxPoints || this.level >= this.maxLevel) {
      this.points.push(point);
      return true;
    }
    
    // Otherwise, subdivide if needed and insert into children
    if (!this.divided) {
      this.subdivide();
    }
    
    return this.northWest!.insert(point) ||
           this.northEast!.insert(point) ||
           this.southWest!.insert(point) ||
           this.southEast!.insert(point);
  }
  
  // Query points within a bounds
  query(bounds: Bounds, found: number[]): void {
    // If bounds doesn't intersect this quad, return empty
    if (!this.intersectsBounds(bounds)) {
      return;
    }
    
    // Check points at this level
    for (const point of this.points) {
      if (point.lat >= bounds.minLat && 
          point.lat <= bounds.maxLat &&
          point.lng >= bounds.minLng &&
          point.lng <= bounds.maxLng) {
        found.push(point.id);
      }
    }
    
    // If this node is divided, query children
    if (this.divided) {
      this.northWest!.query(bounds, found);
      this.northEast!.query(bounds, found);
      this.southWest!.query(bounds, found);
      this.southEast!.query(bounds, found);
    }
  }
  
  // Create four child nodes
  subdivide(): void {
    const { minLat, maxLat, minLng, maxLng } = this.bounds;
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    
    this.northWest = new QuadTreeNode(
      { minLat: midLat, maxLat, minLng, maxLng: midLng },
      this.level + 1
    );
    
    this.northEast = new QuadTreeNode(
      { minLat: midLat, maxLat, minLng: midLng, maxLng },
      this.level + 1
    );
    
    this.southWest = new QuadTreeNode(
      { minLat, maxLat: midLat, minLng, maxLng: midLng },
      this.level + 1
    );
    
    this.southEast = new QuadTreeNode(
      { minLat, maxLat: midLat, minLng: midLng, maxLng },
      this.level + 1
    );
    
    this.divided = true;
    
    // Move existing points to children
    const existingPoints = [...this.points];
    this.points = [];
    
    for (const point of existingPoints) {
      this.northWest.insert(point) ||
      this.northEast.insert(point) ||
      this.southWest.insert(point) ||
      this.southEast.insert(point);
    }
  }
  
  // Check if point is within bounds
  containsPoint(point: Point): boolean {
    return point.lat >= this.bounds.minLat &&
           point.lat <= this.bounds.maxLat &&
           point.lng >= this.bounds.minLng &&
           point.lng <= this.bounds.maxLng;
  }
  
  // Check if this quad intersects with a bounds
  intersectsBounds(bounds: Bounds): boolean {
    return !(bounds.maxLat < this.bounds.minLat ||
             bounds.minLat > this.bounds.maxLat ||
             bounds.maxLng < this.bounds.minLng ||
             bounds.minLng > this.bounds.maxLng);
  }
}

// Efficient spatial index using QuadTree
class SpatialIndex {
  private root: QuadTreeNode;
  private bounds: Bounds;

  constructor() {
    // Initialize with global bounds that can contain any valid lat/lng
    this.bounds = {
      minLat: -90,
      maxLat: 90,
      minLng: -180,
      maxLng: 180
    };
    this.root = new QuadTreeNode(this.bounds, 0);
    this.clear();
  }

  clear(): void {
    this.root = new QuadTreeNode(this.bounds, 0);
  }

  addStation(lat: number, lng: number, stationId: number): void {
    this.root.insert({ lat, lng, id: stationId });
  }

  getVisibleStations(bounds: google.maps.LatLngBounds): number[] {
    if (!bounds) return [];

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    const queryBounds: Bounds = {
      minLat: sw.lat(),
      maxLat: ne.lat(),
      minLng: sw.lng(),
      maxLng: ne.lng()
    };
    
    const result: number[] = [];
    this.root.query(queryBounds, result);
    
    return result;
  }
}

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  if (!window.google?.maps?.geometry?.encoding) {
    console.warn("No geometry library available for decoding polyline")
    return []
  }
  const decodedPath = window.google.maps.geometry.encoding.decodePath(encoded)
  return decodedPath.map((latLng) => latLng.toJSON())
}

/**
 * Compute the midpoint of a route by walking along the route's distance.
 */
function computeRouteMidpoint(routeCoords: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
  if (!window.google?.maps?.geometry?.spherical) {
    const midIndex = Math.floor(routeCoords.length / 2)
    return routeCoords[midIndex]
  }
  const spherical = window.google.maps.geometry.spherical
  const latLngs = routeCoords.map((p) => new window.google.maps.LatLng(p))
  const totalLength = spherical.computeLength(latLngs)
  const halfDist = totalLength / 2

  let accumulated = 0
  for (let i = 0; i < latLngs.length - 1; i++) {
    const segStart = latLngs[i]
    const segEnd = latLngs[i + 1]
    const segDist = spherical.computeDistanceBetween(segStart, segEnd)
    if (accumulated + segDist >= halfDist) {
      const overshoot = halfDist - accumulated
      const fraction = overshoot / segDist
      const midLatLng = spherical.interpolate(segStart, segEnd, fraction)
      return midLatLng.toJSON()
    }
    accumulated += segDist
  }
  // fallback
  return routeCoords[Math.floor(routeCoords.length / 2)]
}

// Route marker animations are not currently in use

interface UseMarkerOverlayOptions {
  onPickupClick?: (stationId: number) => void
}

export function useMarkerOverlay(googleMap: google.maps.Map | null | undefined, options?: UseMarkerOverlayOptions) {
  // Redux state
  const stations = useAppSelector(selectStationsWithDistance)
  const buildings3D = useAppSelector(selectStations3D)

  const bookingStep = useAppSelector(selectBookingStep)
  const departureStationId = useAppSelector(selectDepartureStationId)
  const arrivalStationId = useAppSelector(selectArrivalStationId)
  const listSelectedStationId = useAppSelector(selectListSelectedStationId)

  const dispatch = useAppDispatch()

  // The route from dispatch hub -> departure station
  const dispatchRoute = useAppSelector(selectDispatchRoute)
  // The route from departure -> arrival
  const bookingRoute = useAppSelector(selectBookingRoute)

  // Spatial index for efficient geographic lookups
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  
  // Station "candidates" with geometry + station ID
  const stationsRef = useRef<{
    [stationId: number]: MarkerData
  }>({})
  
  // Memoize important station IDs to reduce recalculations
  const importantStationIds = useMemo(() => {
    const ids = new Set<number>();
    if (departureStationId) ids.add(departureStationId);
    if (arrivalStationId) ids.add(arrivalStationId);
    if (listSelectedStationId) ids.add(listSelectedStationId);
    return ids;
  }, [departureStationId, arrivalStationId, listSelectedStationId]);
  
  // Keep the ref for cleanup purposes, even if functionality is inactive
  const routeMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  
  // Handler for station clicks with camera animations using CameraAnimationManager
  const handleStationClick = useCallback((stationId: number) => {
    const station = stationsRef.current[stationId]?.stationData;
  
    if (station?.properties?.isVirtualCarLocation) {
      const registration = station.properties.registration || station.properties.plateNumber;
  
      if (!registration) {
        toast.error('No registration found for this car');
        return;
      }
  
      // Remove the existing virtual station before recreating
      store.dispatch(removeStation(station.id));

      // Fetch actual car data and use the same workflow as QR scan
      store.dispatch(fetchCarByRegistration(registration))
        .unwrap()
        .then(carResult => {
          // Use the same logic as QR scan to ensure all state and UI is correct
          if (!carResult) {
            toast.error('Car not found');
            return;
          }
          stationSelectionManager.handleQrScanSuccess(carResult);
        })
        .catch(error => {
          console.error('Error fetching car data:', error);
          toast.error('Failed to load car details');
        });
    } else {
      // Use the pre-imported managers directly
      stationSelectionManager.selectStation(stationId, false);
    }
  }, [departureStationId, dispatch]);

  // Create a marker element with appropriate styling for a station
  const createMarkerElement = useCallback((station: StationFeature): HTMLElement => {
    // Get marker state configuration
    const stateConfig = getMarkerStateConfig(
      station, 
      departureStationId, 
      arrivalStationId, 
      listSelectedStationId
    );
    
    // Initialize marker element from template
    const container = initializeMarkerElement(station.id);
    
    // Apply appropriate marker container class
    container.classList.add(stateConfig.isVirtual ? 'marker-container-virtual' : 'marker-container-standard');
    
    // Apply all marker classes based on state
    applyMarkerClasses(container, stateConfig);
    
    // Update marker content
    updateMarkerContent(container, station, stateConfig, departureStationId, arrivalStationId);
    
    // Set expansion state (expanded or collapsed)
    toggleMarkerExpansion(container, stateConfig.isExpanded);
    
    // Setup click handler if needed
    const isOptimizedStep = bookingStep === 2 || bookingStep === 4;
    const shouldAddClickHandler = !isOptimizedStep || stateConfig.isImportant;
    setupStationClickHandler(station.id, container, handleStationClick, shouldAddClickHandler);
    
    return container;
  }, [departureStationId, arrivalStationId, listSelectedStationId, bookingStep, handleStationClick]);
  
  // Determine if marker needs content update
  const shouldUpdateMarkerContent = useCallback((
    station: StationFeature,
    marker: google.maps.marker.AdvancedMarkerElement,
    forceContentUpdate: boolean
  ): boolean => {
    // No marker on map always requires update
    if (!marker.map) return true;
    
    // Force update always returns true
    if (forceContentUpdate) return true;
    
    // Set up marker userData object if it doesn't exist
    if (!marker.userData) marker.userData = {};
    
    // Check if this marker WAS previously the list selected station
    const wasListSelected = marker.userData.wasListSelected === true && 
                            station.id !== listSelectedStationId;
    
    // Update tracking state
    marker.userData.wasListSelected = station.id === listSelectedStationId;
    
    // Check if this is important
    const stateConfig = getMarkerStateConfig(
      station, 
      departureStationId, 
      arrivalStationId, 
      listSelectedStationId
    );
    
    // In optimization steps (2 and 4), only update important markers
    if (bookingStep === 2 || bookingStep === 4) {
      return stateConfig.isImportant || wasListSelected;
    }
    
    // In other steps, all markers need updates but prioritize important ones
    return true;
  }, [departureStationId, arrivalStationId, listSelectedStationId, bookingStep]);
  
  // Create or update a station marker
  const createOrUpdateStationMarker = useCallback((
    station: StationFeature, 
    position: google.maps.LatLngAltitudeLiteral,
    forceContentUpdate: boolean = false
  ) => {
    if (!googleMap || !window.google?.maps?.marker?.AdvancedMarkerElement) return null;
    
    const { AdvancedMarkerElement } = window.google.maps.marker;
    const stationEntry = stationsRef.current[station.id];
    
    // Get marker state configuration
    const stateConfig = getMarkerStateConfig(
      station, 
      departureStationId, 
      arrivalStationId, 
      listSelectedStationId
    );
    
    // Determine collision behavior based on importance
    const collisionBehavior = stateConfig.isImportant
      ? google.maps.CollisionBehavior.REQUIRED
      : google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
    
    // Create new marker if needed
    if (!stationEntry || !stationEntry.marker) {
      return createNewMarker(station, position, stateConfig, collisionBehavior);
    } else {
      // Update existing marker
      return updateExistingMarker(
        station, 
        position, 
        stationEntry, 
        stateConfig,
        collisionBehavior, 
        forceContentUpdate
      );
    }
  }, [
    googleMap, 
    departureStationId, 
    arrivalStationId, 
    listSelectedStationId, 
    bookingStep, 
    shouldUpdateMarkerContent, 
    createMarkerElement
  ]);
  
  // Helper to create a new marker
  const createNewMarker = useCallback((
    station: StationFeature, 
    position: google.maps.LatLngAltitudeLiteral, 
    stateConfig: MarkerStateConfig,
    collisionBehavior: any
  ) => {
    if (!googleMap || !window.google?.maps?.marker?.AdvancedMarkerElement) return null;
    
    const { AdvancedMarkerElement } = window.google.maps.marker;
    
    // Create new marker element
    const markerElement = createMarkerElement(station);
    
    const marker = new AdvancedMarkerElement({
      position,
      collisionBehavior,
      gmpClickable: true,
      content: markerElement,
      map: googleMap || null,
    });
    
    // Initialize userData for state tracking
    marker.userData = {
      wasListSelected: station.id === listSelectedStationId,
      // Add other properties needed by TypeScript
      map: googleMap || null
    };
    
    // Store reference
    stationsRef.current[station.id] = {
      position,
      stationData: station,
      marker,
      isVirtualCarLocation: stateConfig.isVirtual
    };
    
    return marker;
  }, [googleMap, createMarkerElement]);
  
  // Helper to update an existing marker
  const updateExistingMarker = useCallback((
    station: StationFeature, 
    position: google.maps.LatLngAltitudeLiteral,
    stationEntry: MarkerData,
    stateConfig: MarkerStateConfig,
    collisionBehavior: any,
    forceContentUpdate: boolean
  ) => {
    if (!googleMap) return null;
    
    const marker = stationEntry.marker!;
    
    // Update position if needed
    if (marker.position) {
      const positionChanged = 
        marker.position.lat !== position.lat || 
        marker.position.lng !== position.lng;
      
      // Check for altitude - only if both positions have this property
      const altitudeChanged = 
        'altitude' in marker.position && 
        'altitude' in position && 
        (marker.position as google.maps.LatLngAltitudeLiteral).altitude !== position.altitude;
        
      if (positionChanged || altitudeChanged) {
        marker.position = position;
      }
    } else {
      // If position is null/undefined, just set it
      marker.position = position;
    }
    
    // Update collision behavior if needed
    if (marker.collisionBehavior !== collisionBehavior) {
      marker.collisionBehavior = collisionBehavior;
    }
    
    // Determine if content update is needed
    const needsContentUpdate = shouldUpdateMarkerContent(station, marker, forceContentUpdate);
    
    if (needsContentUpdate) {
      const existingContent = marker.content as HTMLElement;
      const isOptimizedStep = bookingStep === 2 || bookingStep === 4;
      const shouldAddClickHandler = !isOptimizedStep || stateConfig.isImportant;
      
      if (!existingContent || (marker.userData?.wasListSelected === true && station.id !== listSelectedStationId)) {
        // For complete rebuilds, create a new marker element
        const markerElement = createMarkerElement(station);
        marker.content = markerElement;
      } else {
        // For most updates, just update the existing element
        // Apply all marker classes based on state
        applyMarkerClasses(existingContent, stateConfig);
        
        // Update marker content
        updateMarkerContent(existingContent, station, stateConfig, departureStationId, arrivalStationId);
        
        // Set expansion state
        toggleMarkerExpansion(existingContent, stateConfig.isExpanded);
        
        // Update click handler
        setupStationClickHandler(station.id, existingContent, handleStationClick, shouldAddClickHandler);
      }
      
      // Update user data reference
      if (marker.userData) {
        marker.userData.wasListSelected = station.id === listSelectedStationId;
      }
    }
    
    // Ensure it's on the map
    if (!marker.map) {
      marker.map = googleMap || null;
    }
    
    return marker;
  }, [
    googleMap, 
    createMarkerElement, 
    departureStationId, 
    arrivalStationId, 
    listSelectedStationId, 
    bookingStep, 
    handleStationClick, 
    shouldUpdateMarkerContent
  ]);

  // Initialize a route marker element
  const createRouteMarkerElement = useCallback((driveMins: number): HTMLElement => {
    const template = getRouteMarkerTemplate();
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const container = clone.firstElementChild as HTMLElement;
    
    // Update route box text with drive time
    const boxDiv = container.querySelector('.route-box') as HTMLElement;
    if (boxDiv) {
      boxDiv.textContent = `${driveMins} mins drive`;
    }
    
    return container;
  }, []);
  
  // Update route marker text
  const updateRouteMarkerText = useCallback((markerElement: HTMLElement, driveMins: number): void => {
    const textDiv = markerElement.querySelector(".route-box") as HTMLDivElement;
    if (textDiv) {
      textDiv.textContent = `${driveMins} mins drive`;
    }
  }, []);
  
  // Create or update the route marker on the map
  const createOrUpdateRouteMarker = useCallback(() => {
    if (!googleMap) return;

    // Only show route marker in booking step 4
    if (bookingStep !== 4) {
      if (routeMarkerRef.current) {
        routeMarkerRef.current.map = null;
        routeMarkerRef.current = null;
      }
      return;
    }

    // Use the booking route (departure ➜ arrival)
    const route = bookingRoute;

    // No route → remove any existing marker and exit.
    if (!route?.polyline) {
      if (routeMarkerRef.current) {
        routeMarkerRef.current.map = null;
        routeMarkerRef.current = null;
      }
      return;
    }

    /* ---------- 1 / Compute core data ---------- */
    const coords = decodePolyline(route.polyline);
    if (!coords.length) return;

    const midpoint = computeRouteMidpoint(coords);

    // Prefer API-provided duration; else estimate from distance (computeLength)
    const driveSecs = route.duration ??
      (() => {
        if (!window.google?.maps?.geometry?.spherical) return 0;
        const len = window.google.maps.geometry.spherical.computeLength(
          coords.map(p => new window.google.maps.LatLng(p))
        );
        // crude ~40 km h⁻¹ urban average
        return (len / 1000) / 40 * 3600;
      })();
    const driveMins = Math.max(1, Math.round(driveSecs / 60));

    /* ---------- 2 / Create or update marker ---------- */
    const { AdvancedMarkerElement } = window.google.maps.marker;

    if (!routeMarkerRef.current) {
      // ⬇️ strip initial hidden class
      const elt = createRouteMarkerElement(driveMins);
      elt.classList.remove("route-marker-container--hidden");

      routeMarkerRef.current = new AdvancedMarkerElement({
        position: midpoint,
        gmpClickable: false,
        collisionBehavior: google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
        content: elt,
        map: googleMap,
      });
    } else {
      routeMarkerRef.current.position = midpoint;
      updateRouteMarkerText(
        routeMarkerRef.current.content as HTMLElement,
        driveMins
      );
      if (!routeMarkerRef.current.map) {
        routeMarkerRef.current.map = googleMap;
      }
    }
  }, [
    googleMap,
    bookingStep,
    bookingRoute?.polyline,
    bookingRoute?.duration,
    dispatchRoute?.polyline,
    dispatchRoute?.duration,
    createRouteMarkerElement,
    updateRouteMarkerText,
  ]);

  // Initialize station data
  const initializeStations = useCallback(() => {
    // Clear spatial index
    spatialIndexRef.current.clear();
    
    // Process all stations
    const stationByObjectId = new Map<number, StationFeature>();
    
    // First collect stations by ObjectId
    stations.forEach(station => {
      const objId = station.properties.ObjectId;
      if (typeof objId === "number") {
        stationByObjectId.set(objId, station);
      }
    });
    
    // Process 3D building stations
    buildings3D.forEach(building => {
      const objId = building.properties?.ObjectId;
      if (!objId) return;
      
      const station = stationByObjectId.get(objId);
      if (!station) return;
      
      // Get polygon center
      const coords = building.geometry?.coordinates?.[0] as [number, number][] | undefined;
      if (!coords || coords.length < 3) return;
      
      let totalLat = 0;
      let totalLng = 0;
      coords.forEach(([lng, lat]) => {
        totalLat += lat;
        totalLng += lng;
      });
      
      const centerLat = totalLat / coords.length;
      const centerLng = totalLng / coords.length;
      
      // Add to spatial index
      spatialIndexRef.current.addStation(centerLat, centerLng, station.id);
      
      // Store position
      const topHeight = building.properties?.topHeight ?? 250;
      const altitude = topHeight + 5;
      
      const position = { 
        lat: centerLat, 
        lng: centerLng, 
        altitude 
      };
      
      // Store in stations ref or update existing
      if (stationsRef.current[station.id]) {
        stationsRef.current[station.id].position = position;
        stationsRef.current[station.id].stationData = station;
      } else {
        stationsRef.current[station.id] = {
          position,
          stationData: station,
          marker: null
        };
      }
    });
    
    // Add virtual car stations
    stations.forEach(station => {
      if (station.properties?.isVirtualCarLocation === true) {
        // Skip if already processed
        if (stationsRef.current[station.id] && 
            stationsRef.current[station.id].isVirtualCarLocation) {
          return;
        }
        
        // Extract coordinates
        const [lng, lat] = station.geometry.coordinates;
        const altitude = 5; // Ground level
        
        // Add to spatial index
        spatialIndexRef.current.addStation(lat, lng, station.id);
        
        // Store in stations ref
        stationsRef.current[station.id] = {
          position: { lat, lng, altitude },
          stationData: station,
          marker: null,
          isVirtualCarLocation: true
        };
      }
    });
  }, [stations, buildings3D]);

  // Clean up a single marker
  const cleanupMarker = useCallback((stationId: number, marker: google.maps.marker.AdvancedMarkerElement | null): void => {
    if (!marker) return;
    
    // Clean up event listeners
    cleanupMarkerListeners(stationId);
    
    // Remove from map
    marker.map = null;
  }, []);

  // Update visible markers based on map bounds and state
  const updateVisibleMarkers = useCallback((forceContentUpdate: boolean = false) => {
    if (!googleMap) return;
    
    // Get current bounds
    const bounds = googleMap.getBounds();
    if (!bounds) return;
    
    // Get stations in bounds
    const visibleStationIds = spatialIndexRef.current.getVisibleStations(bounds);
    
    // Use our helper function to determine which stations to show
    const stationsToShow = getStationsToDisplay(
      visibleStationIds,
      stationsRef.current,
      importantStationIds,
      bookingStep
    );
    
    // Track which markers we've updated
    const updatedMarkers = new Set<number>();
    
    // Update each station
    let visibleMarkerCount = 0;
    Object.entries(stationsRef.current).forEach(([id, data]) => {
      const stationId = Number(id);
      const shouldBeVisible = stationsToShow.has(stationId);
      
      if (shouldBeVisible) {
        // Create or update marker
        if (data.stationData) {
          createOrUpdateStationMarker(data.stationData, data.position, forceContentUpdate);
          visibleMarkerCount++;
          updatedMarkers.add(stationId);
        }
      } else if (data.marker) {
        // Use our dedicated cleanup function instead of handling event listeners manually
        cleanupMarker(stationId, data.marker);
        data.marker = null;
      }
    });
    
    // Development logging is handled through inline conditionals
    
    // Update route marker
    createOrUpdateRouteMarker();
    
    // Return information about the update
    return {
      visibleMarkerCount,
      totalMarkerCount: Object.keys(stationsRef.current).length,
      updatedMarkers
    };
  }, [
    googleMap, 
    importantStationIds,
    bookingStep,
    createOrUpdateStationMarker, 
    createOrUpdateRouteMarker,
    cleanupMarker
  ]);
  
  // Initialize stations when data changes
  useEffect(() => {
    initializeStations();
    // Initial load - force content update for all markers
    updateVisibleMarkers(true);
  }, [stations, buildings3D, initializeStations, updateVisibleMarkers]);

  // Listen for map events - with special handling for optimized steps
  useEffect(() => {
    if (!googleMap) return;
    
    let idleListener: google.maps.MapsEventListener | null = null;
    
    // Only attach idle listener in steps 1 and 3 where we need to show all stations in view
    if (bookingStep === 1 || bookingStep === 3) {
      // OPTIMIZATION: Do not force content update on map movement
      idleListener = googleMap.addListener("idle", () => updateVisibleMarkers(false));
    }
    
    // Initial update - always needed
    updateVisibleMarkers(true);
    
    return () => {
      if (idleListener) {
        google.maps.event.removeListener(idleListener);
      }
    };
  }, [googleMap, updateVisibleMarkers, bookingStep]);

  // Memoize the selection state to prevent unnecessary updates
  const selectionState = useMemo(() => ({
    departure: departureStationId,
    arrival: arrivalStationId,
    selected: listSelectedStationId,
    step: bookingStep
  }), [departureStationId, arrivalStationId, listSelectedStationId, bookingStep]);
  
  // Reference to previous selection state for comparison
  const prevSelectionStateRef = useRef(selectionState);
  
  useEffect(() => {
    const prev = prevSelectionStateRef.current;
    const current = selectionState;
    
    const selectionStateChanged = hasSelectionStateChanged(prev, current);
    
    if (selectionStateChanged) {
      // Track which station IDs actually changed
      const changedStationIds = new Set<number>();
      
      // Check departure station changes
      if (prev.departure !== current.departure) {
        if (prev.departure) changedStationIds.add(prev.departure);
        if (current.departure) changedStationIds.add(current.departure);
      }
      
      // Check arrival station changes
      if (prev.arrival !== current.arrival) {
        if (prev.arrival) changedStationIds.add(prev.arrival);
        if (current.arrival) changedStationIds.add(current.arrival);
      }
      
      // Check selected station changes
      if (prev.selected !== current.selected) {
        if (prev.selected) changedStationIds.add(prev.selected);
        if (current.selected) changedStationIds.add(current.selected);
      }
      
      // First update all markers normally without forcing content rebuild
      updateVisibleMarkers(false);
      
      // Then only force updates for the changed stations
      changedStationIds.forEach(id => {
        const entry = stationsRef.current[id];
        if (entry) createOrUpdateStationMarker(entry.stationData, entry.position, true);
      });
    } else {
      // Routes changed but not selection state, just update positions without forcing content rebuild
      updateVisibleMarkers(false);
    }
    
    // Store current state for next comparison
    prevSelectionStateRef.current = selectionState;
  }, [
    selectionState,
    dispatchRoute?.polyline,
    bookingRoute?.polyline,
    updateVisibleMarkers,
    createOrUpdateStationMarker
  ]);
  
  // Clean up a collection of markers
  const cleanupMarkers = useCallback((markerEntries: Record<number, MarkerData>): void => {
    Object.entries(markerEntries).forEach(([id, data]) => {
      if (data.marker) {
        cleanupMarker(Number(id), data.marker);
        data.marker = null;
      }
    });
  }, [cleanupMarker]);
  
  // Enhanced pruning function with improved memory management
  const pruneStaleStations = useCallback(() => {
    let visibleStationIds: number[] = [];
    
    // Get visible stations from map bounds
    if (googleMap) {
      const bounds = googleMap.getBounds();
      if (bounds) {
        visibleStationIds = spatialIndexRef.current.getVisibleStations(bounds);
      }
    }
    
    // Use our helper function to determine which stations to keep
    const stationsToKeep = getStationsToDisplay(
      visibleStationIds,
      stationsRef.current,
      importantStationIds,
      bookingStep
    );
    
    // Count stations before pruning
    const totalBefore = Object.keys(stationsRef.current).length;
    
    // Keep only stations that:
    // 1. Are currently visible
    // 2. Are important (departure, arrival, selected)
    // 3. Are virtual car locations
    // 4. Have active markers
    const entriesToRemove: number[] = [];
    
    Object.entries(stationsRef.current).forEach(([id, data]) => {
      const stationId = Number(id);
      
      // If not in the keep set, check for removal
      if (!stationsToKeep.has(stationId)) {
        // If it has a marker, first remove it and clean up listeners
        if (data.marker) {
          cleanupMarker(stationId, data.marker);
          data.marker = null;
        }
        
        // Add to removal list if it has no marker
        if (!data.marker) {
          entriesToRemove.push(stationId);
        }
      }
    });
    
    // Remove the stale entries
    entriesToRemove.forEach(id => {
      delete stationsRef.current[id];
    });
    
    // Development logging removed to reduce code size
  }, [
    googleMap, 
    importantStationIds, 
    bookingStep,
    cleanupMarker
  ]);
  
  // Periodically clean up stations that are no longer visible to prevent memory growth
  useEffect(() => {
    // Set up an interval to periodically clean up stations
    // Use more aggressive pruning in high-load steps
    const interval = bookingStep === 1 || bookingStep === 3 ? 15000 : 30000; // 15s in high-load steps, 30s otherwise
    const pruneInterval = setInterval(pruneStaleStations, interval);
    
    return () => {
      clearInterval(pruneInterval);
    };
  }, [pruneStaleStations, bookingStep]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove all markers from map and clear event listeners
      cleanupMarkers(stationsRef.current);
      
      // Clear stations ref to allow garbage collection
      Object.keys(stationsRef.current).forEach(key => {
        delete stationsRef.current[Number(key)];
      });
      
      // Clear route marker
      if (routeMarkerRef.current) {
        routeMarkerRef.current.map = null;
        routeMarkerRef.current = null;
      }
      
      // Clear spatial index
      spatialIndexRef.current.clear();
      
      // Clear all event listeners to prevent memory leaks
      markerEventListeners.forEach(arr => arr.forEach(fn => fn()));
      markerEventListeners.clear();
    };
  }, [cleanupMarkers]);

  // Return the route marker ref for compatibility
  return {
    routeMarkerRef
  };
}