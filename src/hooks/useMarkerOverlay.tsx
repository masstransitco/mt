"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { debounce } from "lodash"
import { useAppSelector, useAppDispatch } from "@/store/store"
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
import { DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, MARKER_POST_MAX_ZOOM } from "@/constants/map"

// Declare google as any to avoid TypeScript errors
declare var google: any

// --------------------------------------
// DOM Element Pool for Marker Recycling
// --------------------------------------
class MarkerPool {
  private collapsedMarkers: HTMLElement[] = [];
  private expandedMarkers: HTMLElement[] = [];
  private maxPoolSize = 50; // Limit pool size to prevent memory leaks

  getCollapsedMarker(): HTMLElement {
    if (this.collapsedMarkers.length > 0) {
      return this.collapsedMarkers.pop()!;
    }
    return this.createCollapsedMarker();
  }

  getExpandedMarker(): HTMLElement {
    if (this.expandedMarkers.length > 0) {
      return this.expandedMarkers.pop()!;
    }
    return this.createExpandedMarker();
  }

  // Function to remove all marker event listeners
  private removeAllMarkerEventListeners(element: HTMLElement): void {
    // Remove common event listeners for markers
    element.removeEventListener("click", this.handleStationClick);
    element.removeEventListener("mouseenter", this.handleMarkerHover);
    element.removeEventListener("mouseleave", this.handleMarkerUnhover);
  }

  // Event handler references for proper removal
  private handleStationClick = (ev: Event) => {}; // Will be set by useMarkerOverlay
  private handleMarkerHover = (ev: Event) => {
    const target = ev.currentTarget as HTMLElement;
    if (!target.classList.contains('hover')) {
      target.classList.add('hover');
    }
  };
  private handleMarkerUnhover = (ev: Event) => {
    const target = ev.currentTarget as HTMLElement;
    target.classList.remove('hover');
  };

  // Set the station click handler
  setStationClickHandler(handler: (ev: Event) => void): void {
    this.handleStationClick = handler;
  }

  recycleCollapsedMarker(element: HTMLElement): void {
    if (this.collapsedMarkers.length < this.maxPoolSize) {
      // 1) Remove any event listeners we attached earlier
      this.removeAllMarkerEventListeners(element);

      // 2) Reset relevant styles and classes
      // Remove all classes except basic marker class
      const classesToKeep = ['marker-collapsed'];
      const classList = Array.from(element.classList);
      classList.forEach(className => {
        if (!classesToKeep.includes(className)) {
          element.classList.remove(className);
        }
      });
      
      // Make sure we have the right class
      if (!element.classList.contains('marker-collapsed')) {
        element.classList.add('marker-collapsed');
      }
      
      // Reset content
      element.innerHTML = ''; // Empty for solid circle

      // 3) Store the original node in the pool
      this.collapsedMarkers.push(element);
    }
  }

  recycleExpandedMarker(element: HTMLElement): void {
    if (this.expandedMarkers.length < this.maxPoolSize) {
      // 1) Remove any event listeners we attached earlier
      this.removeAllMarkerEventListeners(element);

      // 2) Reset relevant styles and classes
      // Remove all classes except basic marker class
      const classesToKeep = ['marker-expanded'];
      const classList = Array.from(element.classList);
      classList.forEach(className => {
        if (!classesToKeep.includes(className)) {
          element.classList.remove(className);
        }
      });
      
      // Make sure we have the right class
      if (!element.classList.contains('marker-expanded')) {
        element.classList.add('marker-expanded');
      }

      // Reset inner HTML with our CSS classes
      element.innerHTML = `
        <div class="expanded-info-section"></div>
        
        <div class="marker-animation-progress">
          <div class="marker-animation-spinner"></div>
          <span class="marker-animation-text">SCANNING LOCATION</span>
        </div>
        
        <button class="marker-pickup-btn">
          SELECT LOCATION
        </button>
      `;

      // 3) Store the original node in the pool
      this.expandedMarkers.push(element);
    }
  }

  // Create a fresh collapsed marker with CSS classes
  private createCollapsedMarker = (): HTMLElement => {
    const collapsedDiv = document.createElement("div");
    collapsedDiv.classList.add("marker-collapsed");
    return collapsedDiv;
  }

  // Create a fresh expanded marker with CSS classes
  private createExpandedMarker = (): HTMLElement => {
    const expandedDiv = document.createElement("div");
    expandedDiv.classList.add("marker-expanded");
    
    expandedDiv.innerHTML = `
      <div class="expanded-info-section"></div>
      
      <div class="marker-animation-progress">
        <div class="marker-animation-spinner"></div>
        <span class="marker-animation-text">SCANNING LOCATION</span>
      </div>
      
      <button class="marker-pickup-btn">
        SELECT LOCATION
      </button>
    `;
    
    return expandedDiv;
  }
}

// -----------------------
// Spatial Indexing System
// -----------------------
class SpatialIndex {
  private grid = new Map<string, Set<number>>();
  private cellSize = 0.01; // ~1km at equator
  private stationPositions = new Map<number, { lat: number, lng: number }>();

  constructor() {
    this.clear();
  }

  clear(): void {
    this.grid.clear();
    this.stationPositions.clear();
  }

  addStation(lat: number, lng: number, stationId: number): void {
    const cellKey = this.getCellKey(lat, lng);
    if (!this.grid.has(cellKey)) {
      this.grid.set(cellKey, new Set());
    }
    this.grid.get(cellKey)!.add(stationId);
    this.stationPositions.set(stationId, { lat, lng });
  }

  getVisibleStations(bounds: google.maps.LatLngBounds): number[] {
    if (!bounds) return [];

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    
    const minLat = sw.lat();
    const maxLat = ne.lat();
    const minLng = sw.lng();
    const maxLng = ne.lng();
    
    const result: number[] = [];
    
    // For each cell that intersects the bounds
    for (let lat = minLat; lat <= maxLat; lat += this.cellSize) {
      for (let lng = minLng; lng <= maxLng; lng += this.cellSize) {
        const cellKey = this.getCellKey(lat, lng);
        const stationsInCell = this.grid.get(cellKey);
        
        if (stationsInCell) {
          stationsInCell.forEach(stationId => {
            if (!result.includes(stationId)) {
              result.push(stationId);
            }
          });
        }
      }
    }
    
    return result;
  }

  isStationInBounds(stationId: number, bounds: google.maps.LatLngBounds): boolean {
    const position = this.stationPositions.get(stationId);
    if (!position) return false;
    
    return bounds.contains(new google.maps.LatLng(position.lat, position.lng));
  }

  private getCellKey(lat: number, lng: number): string {
    const latCell = Math.floor(lat / this.cellSize);
    const lngCell = Math.floor(lng / this.cellSize);
    return `${latCell}:${lngCell}`;
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
 * Compute the "true" midpoint by walking along the route's cumulative distance.
 * Fallback: if geometry.spherical is missing, use the naive midIndex.
 */
function computeRouteMidpoint(routeCoords: google.maps.LatLngLiteral[]): google.maps.LatLngLiteral {
  if (!window.google?.maps?.geometry?.spherical) {
    console.warn("[useMarkerOverlay] geometry.spherical missing; fallback to midIndex")
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

// MarkerViewModel - A unified model for marker state
interface MarkerViewModel {
  isVisible: boolean;
  isExpanded: boolean;
  style: "normal" | "selected" | "virtual" | "qr"; 
  isDeparture: boolean;
  isArrival: boolean;
  isListSelected: boolean;
  postHeight: number;
  address: string;
  place: string;
  pickupMins: number | null;
  showPickupBtn: boolean;
}

interface UseMarkerOverlayOptions {
  onPickupClick?: (stationId: number) => void
  onTiltChange?: (tilt: number) => void
  onZoomChange?: (zoom: number) => void
}

export function useMarkerOverlay(googleMap: google.maps.Map | null, options?: UseMarkerOverlayOptions) {
  const dispatch = useAppDispatch()

  // Redux state
  const stations = useAppSelector(selectStationsWithDistance)
  const buildings3D = useAppSelector(selectStations3D)

  const bookingStep = useAppSelector(selectBookingStep)
  const departureStationId = useAppSelector(selectDepartureStationId)
  const arrivalStationId = useAppSelector(selectArrivalStationId)
  const listSelectedStationId = useAppSelector(selectListSelectedStationId)

  // The route from dispatch hub -> departure station
  const dispatchRoute = useAppSelector(selectDispatchRoute)
  // The route from departure -> arrival
  const bookingRoute = useAppSelector(selectBookingRoute)

  // Marker management instances
  const markerPoolRef = useRef<MarkerPool>(new MarkerPool());
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  
  // Track pending update frames for batching
  const pendingAnimationFrameRef = useRef<number | null>(null);
  
  // Station "candidates" with geometry + station ID.
  const candidateStationsRef = useRef<
    {
      stationId: number
      position: google.maps.LatLngAltitudeLiteral
      stationData?: StationFeature
      refs?: {
        container: HTMLElement
        collapsedWrapper: HTMLElement
        collapsedDiv: HTMLElement
        collapsedPost: HTMLElement
        expandedWrapper?: HTMLElement
        expandedDiv?: HTMLElement
        expandedPost?: HTMLElement
        pickupBtn?: HTMLButtonElement
        animationProgress?: HTMLDivElement
        expandedInfoSection?: HTMLDivElement
        eventHandlers: {
          collapsedMouseEnter: () => void
          collapsedMouseLeave: () => void
          expandedMouseEnter?: () => void
          expandedMouseLeave?: () => void
        }
      }
      marker?: google.maps.marker.AdvancedMarkerElement | null
      markerState?: MarkerViewModel // Track view model for diffing
    }[]
  >([])

  // Single route marker for the departure->arrival route
  const routeMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

  // For the departure station, show "Pickup in X minutes"
  const pickupMins = useMemo(() => {
    if (!dispatchRoute?.duration) return null
    const drivingMins = dispatchRoute.duration / 60
    return Math.ceil(drivingMins + 15)
  }, [dispatchRoute])
  
  // Animation state tracking
  const [circlingAnimationActive, setCirclingAnimationActive] = useState(false);
  const [circlingTargetStation, setCirclingTargetStation] = useState<number | null>(null);
  
  // Helper function to ensure expanded DOM is available
  const ensureExpandedDOM = useCallback(
    (entry: typeof candidateStationsRef.current[number]) => {
      // If we haven't built the expanded portion yet, do so now:
      if (!entry.refs?.expandedWrapper) {
        if (!entry.stationData || !entry.refs) return;
        
        // Build expanded DOM and add to container
        const expanded = buildExpandedMarkerDOM(entry.stationData, markerPoolRef.current);
        entry.refs.container.appendChild(expanded.expandedWrapper);
        
        // Merge references in one operation
        Object.assign(entry.refs, expanded);
      }
    },
    []
  );
  
  // Subscribe to animation state manager
  useEffect(() => {
    import("@/lib/animationStateManager").then(module => {
      const animationStateManager = module.default;
      
      // Only log in development mode
      if (process.env.NODE_ENV === "development") {
        console.log('[useMarkerOverlay] Initial animation state:', animationStateManager.getState());
      }
      
      // Subscribe to animation state changes
      const unsubscribe = animationStateManager.subscribe((state) => {
        if (process.env.NODE_ENV === "development") {
          console.log('[useMarkerOverlay] Animation state update:', state);
        }
        
        if (state.type === 'CAMERA_CIRCLING' || state.type === null) {
          setCirclingAnimationActive(state.isAnimating);
          setCirclingTargetStation(state.targetId);
          
          // Force immediate marker update on animation status change
          if (pendingAnimationFrameRef.current) {
            cancelAnimationFrame(pendingAnimationFrameRef.current);
          }
          
          // Need to use debouncedMapUpdate here since handleMapUpdate isn't defined yet
          pendingAnimationFrameRef.current = requestAnimationFrame(() => {
            // Will be defined at runtime
            if (typeof handleMapUpdate === 'function') {
              handleMapUpdate();
            }
            pendingAnimationFrameRef.current = null;
          });
        }
      });
      
      return unsubscribe;
    });
  }, []); // Avoid dependency cycle with handleMapUpdate

  // Compute marker view model for a station
  const computeMarkerViewModel = useCallback(
    (stationId: number, camera?: {tilt: number; zoom: number}): MarkerViewModel => {
      // Get core station information
      const isDeparture = stationId === departureStationId;
      const isArrival = stationId === arrivalStationId;
      const isListSelected = stationId === listSelectedStationId;
      
      // Find the station entry
      const entry = candidateStationsRef.current.find(e => e.stationId === stationId);
      const isVirtualCarStation = !!entry?.stationData?.properties?.isVirtualCarLocation;
      
      // Station data
      const stationData = entry?.stationData;
      const address = stationData?.properties?.Address || "No address available";
      const place = stationData?.properties?.Place || `Station ${stationId}`;
      
      // Single condition for station visibility:
      // Either is departure, arrival, list selected, or it's a virtual station
      const isVisible = isDeparture || isArrival || isListSelected || isVirtualCarStation;
      
      // Single condition for expansion:
      // Station is chosen for departure, arrival, or is the currently "list selected" station
      // Only expand if we're at a zoom level where markers should be expanded
      const cameraZoom = camera?.zoom || DEFAULT_ZOOM;
      const isExpanded = (isDeparture || isArrival || isListSelected) && 
                         cameraZoom >= MARKER_POST_MIN_ZOOM;
      
      // Compute post height based on camera
      const cameraTilt = camera?.tilt || 0;
      const newPostHeight = computePostHeight(35, cameraTilt, cameraZoom);
      
      // Determine marker style
      let style: MarkerViewModel["style"] = "normal";
      if (isVirtualCarStation) {
        style = isDeparture ? "qr" : "virtual";
      } else if (isDeparture || isArrival || isListSelected) {
        style = "selected";
      }
      
      // Pickup time info
      const showPickupMins = isDeparture && bookingStep >= 3;
      
      return {
        isVisible,
        isExpanded,
        style,
        isDeparture,
        isArrival,
        isListSelected,
        postHeight: newPostHeight,
        address,
        place,
        pickupMins: showPickupMins ? pickupMins : null,
        showPickupBtn: bookingStep === 2 && isDeparture
      };
    },
    [
      departureStationId,
      arrivalStationId,
      listSelectedStationId,
      bookingStep,
      pickupMins
      // computePostHeight is now a regular function, not a dependency
    ]
  );

  // Note: isForceVisible and isExpanded have been replaced with computeMarkerViewModel

  // Now uses stationSelectionManager instead of direct Redux access
  const handleStationClick = useCallback(
    (stationId: number) => {
      import("@/lib/stationSelectionManager").then(module => {
        const stationSelectionManager = module.default;
        const newSheetMode = stationSelectionManager.selectStation(stationId, false);
        // No need to show toast here as stationSelectionManager handles it
      });
    },
    [],
  )

  // Split out the helper functions for collapsed and expanded marker DOM

// Function to build the collapsed marker portion
function buildCollapsedMarkerDOM(
  station: StationFeature,
  markerPool: MarkerPool,
  onStationClick: (stationId: number) => void
) {
  // Create container with CSS class instead of inline styles
  const container = document.createElement("div");
  container.classList.add("marker-container");
  
  // Create collapsed wrapper with CSS class
  const collapsedWrapper = document.createElement("div");
  collapsedWrapper.classList.add("marker-collapsed-wrapper");
  
  // Grab a collapsed marker from the pool and add class
  const collapsedDiv = markerPool.getCollapsedMarker();
  collapsedDiv.classList.add("marker-collapsed");
  
  // Add click handler
  collapsedDiv.addEventListener("click", (ev) => {
    ev.stopPropagation();
    onStationClick(station.id);
  });

  // Simplified hover effects using CSS classes
  const handleMouseEnter = () => {
    if (!collapsedDiv.classList.contains("hover")) {
      collapsedDiv.classList.add("hover");
    }
  };
  
  const handleMouseLeave = () => {
    collapsedDiv.classList.remove("hover");
  };
  
  collapsedDiv.addEventListener("mouseenter", handleMouseEnter);
  collapsedDiv.addEventListener("mouseleave", handleMouseLeave);

  // Create post with CSS class
  const collapsedPost = document.createElement("div");
  collapsedPost.classList.add("marker-post");
  
  // Set initial height (will be updated later as needed)
  collapsedPost.style.height = "28px";

  // Assemble the DOM structure
  collapsedWrapper.appendChild(collapsedDiv);
  collapsedWrapper.appendChild(collapsedPost);
  container.appendChild(collapsedWrapper);

  return {
    container,
    collapsedWrapper,
    collapsedDiv,
    collapsedPost,
    eventHandlers: {
      collapsedMouseEnter: handleMouseEnter,
      collapsedMouseLeave: handleMouseLeave,
    }
  };
}

// Function to build the expanded marker portion on demand
function buildExpandedMarkerDOM(
  station: StationFeature,
  markerPool: MarkerPool
) {
  // For "scanned car" vs normal, you can branch here
  const isVirtual = station.properties?.isVirtualCarLocation === true;
  let expandedDiv: HTMLElement;

  if (isVirtual) {
    // Create custom expanded marker for scanned car
    expandedDiv = document.createElement("div");
    expandedDiv.classList.add("marker-expanded");
    
    // Get the car registration if available
    const registration = station.properties.registration || station.properties.plateNumber || '';
    
    // Create elements with proper structure
    const infoSection = document.createElement("div");
    infoSection.classList.add("expanded-info-section");
    infoSection.style.marginBottom = "5px";
    
    // Title element
    const titleElement = document.createElement("div");
    titleElement.textContent = "SCANNED CAR";
    titleElement.style.fontSize = "11px";
    titleElement.style.fontWeight = "500";
    titleElement.style.letterSpacing = "0.5px";
    titleElement.style.marginBottom = "2px";
    titleElement.style.color = "#E82127";
    titleElement.style.textTransform = "uppercase";
    
    // Place name element
    const placeElement = document.createElement("div");
    placeElement.textContent = (station.properties.Place || 'Electric Vehicle').replace(/\[.*\]/, '');
    placeElement.style.fontSize = "15px";
    placeElement.style.fontWeight = "400";
    placeElement.style.letterSpacing = "0.2px";
    placeElement.style.color = "#FFFFFF";
    placeElement.style.marginBottom = "3px";
    
    // Address element
    const addressElement = document.createElement("div");
    addressElement.textContent = station.properties.Address || 'Current location';
    addressElement.style.fontSize = "11px";
    addressElement.style.opacity = "0.8";
    addressElement.style.lineHeight = "1.3";
    addressElement.style.color = "#FFFFFF";
    
    // Add elements to info section
    infoSection.appendChild(titleElement);
    infoSection.appendChild(placeElement);
    infoSection.appendChild(addressElement);
    
    // Car plate container
    const plateContainer = document.createElement("div");
    plateContainer.style.margin = "8px 0";
    plateContainer.style.display = "flex";
    plateContainer.style.justifyContent = "center";
    plateContainer.style.alignItems = "center";
    
    // Create license plate div
    const licensePlate = document.createElement("div");
    licensePlate.innerHTML = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">
        <!-- Plate border -->
        <div style="position: absolute; inset: 0; border-radius: 0.75rem; border: 2px solid black; z-index: 2;"></div>
        
        <!-- Plate background -->
        <div style="width: 100%; height: 100%; border-radius: 0.75rem; background-color: #f3f4f6; padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: center; z-index: 1;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
            ${(registration || station.properties.Place || "").split('').map(char => `
              <span style="color: black; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 1.5rem; font-weight: bold; ${char === ' ' ? 'width: 0.5rem;' : ''}">${char !== ' ' ? char : ''}</span>
            `).join('')}
          </div>
        </div>
        
        <!-- Plate shadow -->
        <div style="position: absolute; bottom: -0.25rem; left: 0.25rem; right: 0.25rem; height: 0.5rem; background: black; opacity: 0.2; filter: blur(3px); border-radius: 9999px; z-index: 0;"></div>
      </div>
    `;
    plateContainer.appendChild(licensePlate);
    
    // Animation progress indicator
    const animProgress = document.createElement("div");
    animProgress.classList.add("marker-animation-progress");
    
    const spinner = document.createElement("div");
    spinner.classList.add("marker-animation-spinner");
    
    const scanText = document.createElement("span");
    scanText.classList.add("marker-animation-text");
    scanText.textContent = "SCANNING LOCATION";
    
    animProgress.appendChild(spinner);
    animProgress.appendChild(scanText);
    
    // Pickup button
    const pickupBtn = document.createElement("button");
    pickupBtn.classList.add("marker-pickup-btn");
    pickupBtn.textContent = "START DRIVING HERE";
    
    // Add all components to expanded div
    expandedDiv.appendChild(infoSection);
    expandedDiv.appendChild(plateContainer);
    expandedDiv.appendChild(animProgress);
    expandedDiv.appendChild(pickupBtn);
  } else {
    // Use pool for regular stations
    expandedDiv = markerPool.getExpandedMarker();
    expandedDiv.classList.add("marker-expanded");
  }

  // Create expanded wrapper with CSS class
  const expandedWrapper = document.createElement("div");
  expandedWrapper.classList.add("marker-expanded-wrapper");

  // Define handlers for expanded view hover effects
  const handleExpandedMouseEnter = () => {
    if (!expandedDiv.classList.contains("hover")) {
      expandedDiv.classList.add("hover");
    }
  };
  
  const handleExpandedMouseLeave = () => {
    expandedDiv.classList.remove("hover");
  };
  
  // Add hover effects to expanded view
  expandedDiv.addEventListener("mouseenter", handleExpandedMouseEnter);
  expandedDiv.addEventListener("mouseleave", handleExpandedMouseLeave);

  // Create post with CSS class
  const expandedPost = document.createElement("div");
  expandedPost.classList.add("marker-post");
  expandedPost.style.height = "28px";  // Initial height, will be updated later

  // Assemble the DOM structure
  expandedWrapper.appendChild(expandedDiv);
  expandedWrapper.appendChild(expandedPost);

  return {
    expandedWrapper,
    expandedDiv,
    expandedPost,
    pickupBtn: expandedDiv.querySelector<HTMLButtonElement>(".marker-pickup-btn"),
    animationProgress: expandedDiv.querySelector<HTMLDivElement>(".marker-animation-progress"),
    expandedInfoSection: expandedDiv.querySelector<HTMLDivElement>(".expanded-info-section"),
    eventHandlers: {
      expandedMouseEnter: handleExpandedMouseEnter,
      expandedMouseLeave: handleExpandedMouseLeave,
    }
  };
}

// Build marker container function - now builds only the collapsed portion initially
const buildMarkerContainer = useCallback(
  (station: StationFeature) => {
    // Set the station click handler in the marker pool
    markerPoolRef.current.setStationClickHandler((ev: Event) => {
      ev.stopPropagation();
      handleStationClick(station.id);
    });
    
    const isVirtualCarStation = station.properties.isVirtualCarLocation === true;
    
    if (process.env.NODE_ENV === "development") {
      console.log('[useMarkerOverlay] Building marker for station:', station.id, 'isVirtualCarStation:', isVirtualCarStation);
    }

    // Create collapsed marker DOM
    const collapsed = buildCollapsedMarkerDOM(station, markerPoolRef.current, handleStationClick);
    
    // Return just the collapsed portion initially
    return collapsed;
  },
  [handleStationClick],
)

  // Adjust post height based on tilt and zoom
  // Function to calculate post height based on tilt and zoom
  const computePostHeight = (baseHeight: number, tilt: number, zoom: number): number => {
    // First calculate tilt fraction (0-1)
    const tiltFraction = Math.min(Math.max(tilt / 45, 0), 1)
    
    // Calculate zoom fraction (0-1) based on thresholds
    let zoomFraction = 0
    if (zoom >= MARKER_POST_MIN_ZOOM) {
      zoomFraction = Math.min((zoom - MARKER_POST_MIN_ZOOM) / (MARKER_POST_MAX_ZOOM - MARKER_POST_MIN_ZOOM), 1)
    }
    
    // Combine both factors - post is only visible when both conditions are met
    // Multiply by 1.5 to increase the length of the vertical post
    return baseHeight * tiltFraction * zoomFraction * 1.5
  }

  // Create or update the route marker for DEPARTURE->ARRIVAL
const createOrUpdateRouteMarker = useCallback((camera?: {tilt: number, zoom: number}) => {
  if (!googleMap) return
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return

  const hasRoute = bookingRoute?.polyline && bookingRoute.duration
  const showMarker = bookingStep === 4 && arrivalStationId != null && hasRoute

  if (!showMarker) {
    // Fade out if not needed
    if (routeMarkerRef.current) {
      const content = routeMarkerRef.current.content as HTMLElement
      if (content) {
        content.style.transform = "scale(0)"
        content.style.opacity = "0"
        setTimeout(() => {
          if (routeMarkerRef.current) {
            routeMarkerRef.current.map = null
            routeMarkerRef.current = null
          }
        }, 300)
      } else {
        routeMarkerRef.current.map = null
        routeMarkerRef.current = null
      }
    }
    return
  }

  // Decode the polyline
  const path = decodePolyline(bookingRoute.polyline)
  if (path.length < 2) return

  // Compute route midpoint
  const midpoint = computeRouteMidpoint(path)
  const altitude = 15
  const driveMins = Math.ceil(bookingRoute.duration / 60)

  const { AdvancedMarkerElement } = window.google.maps.marker

  if (!routeMarkerRef.current) {
    // Create new route marker
    const container = document.createElement("div")
    container.style.cssText = `
      position: relative;
      transform: scale(0);
      opacity: 0;
      will-change: transform, opacity;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
    `

    const wrapper = document.createElement("div")
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    `

    const boxDiv = document.createElement("div")
    boxDiv.classList.add("route-box")
    boxDiv.style.cssText = `
      width: 120px;
      background: rgba(28, 28, 30, 0.85);
      backdrop-filter: blur(8px);
      color: #FFFFFF;
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      padding: 8px 12px;
      text-align: center;
      pointer-events: auto;
      font-size: 15px;
      font-weight: 500;
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      cursor: default;
      transition: transform 0.2s ease;
      letter-spacing: 0.2px;
    `
    boxDiv.innerHTML = `${driveMins} mins drive`

    const postDiv = document.createElement("div")
    postDiv.classList.add("route-post")
    postDiv.style.cssText = `
      width: 1px;
      height: 35px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.1));
      margin-top: 2px;
      pointer-events: none;
      will-change: height;
      transition: height 0.3s ease;
    `

    wrapper.appendChild(boxDiv)
    wrapper.appendChild(postDiv)
    container.appendChild(wrapper)

    const rMarker = new AdvancedMarkerElement({
      map: googleMap,
      position: {
        lat: midpoint.lat,
        lng: midpoint.lng,
        altitude,
      } as google.maps.LatLngAltitudeLiteral,
      collisionBehavior: "REQUIRED" as any, // stay on top
      gmpClickable: false,
      content: container,
    })

    routeMarkerRef.current = rMarker

    // Animate in
    requestAnimationFrame(() => {
      container.style.transform = "scale(1)"
      container.style.opacity = "1"
    })
  } else {
    // Update existing
    routeMarkerRef.current.position = { lat: midpoint.lat, lng: midpoint.lng, altitude }
    routeMarkerRef.current.collisionBehavior = "REQUIRED" as any
  }

  // Update text & post height
  const rm = routeMarkerRef.current!
  const c = rm.content as HTMLDivElement
  if (c) {
    const textDiv = c.querySelector<HTMLDivElement>(".route-box")
    if (textDiv) {
      textDiv.innerHTML = `${driveMins} mins drive`
    }
    const post = c.querySelector<HTMLDivElement>(".route-post")
    if (post && camera) {
      const newHeight = computePostHeight(28, camera.tilt, camera.zoom)
      post.style.height = `${newHeight}px`
    }
  }
}, [googleMap, bookingRoute, bookingStep, arrivalStationId, computePostHeight])

  // Build candidate station list once and populate spatial index
  const initializeCandidateStations = useCallback(() => {
    // Always rebuild (don't check !candidateStationsRef.current.length)
    // to ensure we capture any newly created virtual car stations
    const stationByObjectId = new Map<number, StationFeature>()
    
    // First collect all stations by ObjectId
    stations.forEach((st) => {
      const objId = st.properties.ObjectId
      if (typeof objId === "number") {
        stationByObjectId.set(objId, st)
      }
    })

    const candidateList: typeof candidateStationsRef.current = []
    
    // Clear spatial index before rebuilding
    spatialIndexRef.current.clear();
    
    // Process regular 3D building stations
    buildings3D.forEach((bld) => {
      const objId = bld.properties?.ObjectId
      if (!objId) return
      const station = stationByObjectId.get(objId)
      if (!station) return

      // Approx polygon center
      const coords = bld.geometry?.coordinates?.[0] as [number, number][] | undefined
      if (!coords || coords.length < 3) return

      let totalLat = 0
      let totalLng = 0
      coords.forEach(([lng, lat]) => {
        totalLat += lat
        totalLng += lng
      })
      const centerLat = totalLat / coords.length
      const centerLng = totalLng / coords.length

      const topHeight = bld.properties?.topHeight ?? 250
      const altitude = topHeight + 5

      candidateList.push({
        stationId: station.id,
        position: { lat: centerLat, lng: centerLng, altitude },
        stationData: station,
        marker: null,
      })
      
      // Add to spatial index for efficient lookups
      spatialIndexRef.current.addStation(centerLat, centerLng, station.id);
    })
    
    // Add virtual car stations that might not be in buildings3D
    // These are created when QR codes are scanned
    stations.forEach((station) => {
      // Skip stations that are already processed
      if (candidateList.some(c => c.stationId === station.id)) {
        return
      }
      
      // Check if this is a virtual car location (QR scanned car)
      if ((station.properties as any).isVirtualCarLocation === true) {
        if (process.env.NODE_ENV === "development") {
          console.log('[useMarkerOverlay] Found virtual car station to add:', station.id);
        }
        
        // Extract coordinates
        const [lng, lat] = station.geometry.coordinates;
        const altitude = 5; // Position at ground level like route markers
        
        candidateList.push({
          stationId: station.id,
          position: { lat, lng, altitude },
          stationData: station,
          marker: null,
        });
        
        // Add to spatial index
        spatialIndexRef.current.addStation(lat, lng, station.id);
      }
    });
    
    if (candidateList.length > 0) {
      // Check if we have virtual car stations
      const virtualStations = candidateList.filter(
        c => (c.stationData?.properties as any).isVirtualCarLocation === true
      );
      
      if (virtualStations.length > 0 && process.env.NODE_ENV === "development") {
        console.log('[useMarkerOverlay] Added virtual car stations:', virtualStations.length);
      }
      
      // Only replace the reference if we have stations to avoid clearing existing markers
      candidateStationsRef.current = candidateList;
    }
  }, [stations, buildings3D])

  // Create an AdvancedMarker for a station using the new ViewModel
  const createStationMarker = useCallback(
    (entry: (typeof candidateStationsRef.current)[number]) => {
      if (!googleMap) return;
      if (!window.google?.maps?.marker?.AdvancedMarkerElement) return;

      // If no refs yet, build only the "collapsed" portion:
      if (!entry.refs) {
        if (!entry.stationData) return;
        entry.refs = buildMarkerContainer(entry.stationData);
      }
      const { container } = entry.refs;
      if (!container) return;

      // Compute initial view model
      const viewModel = computeMarkerViewModel(entry.stationId);
      
      // Decide collisionBehavior:
      const isHighPriority = viewModel.isDeparture || viewModel.isArrival || viewModel.style === "qr" || viewModel.style === "virtual";
      const collisionBehavior = isHighPriority
        ? ("REQUIRED" as any)
        : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any);

      const { AdvancedMarkerElement } = window.google.maps.marker;
      entry.marker = new AdvancedMarkerElement({
        position: entry.position,
        collisionBehavior,
        gmpClickable: true,
        content: container,
        map: googleMap,
      });
      
      // Store the view model for diffing
      entry.markerState = viewModel;

      // Animate in
      requestAnimationFrame(() => {
        container.style.transform = "scale(1)";
        container.style.opacity = "1";
      });

      // If the marker should be expanded, build the expanded DOM on demand
      if (viewModel.isExpanded) {
        ensureExpandedDOM(entry);
        
        // Update UI to show expanded view
        if (entry.refs.expandedWrapper) {
          entry.refs.collapsedWrapper.style.opacity = "0";
          entry.refs.collapsedWrapper.style.transform = "scale(0.8)";
          entry.refs.expandedWrapper.style.display = "flex";
          entry.refs.expandedWrapper.style.opacity = "1";
          entry.refs.expandedWrapper.style.transform = "scale(1)";
        }
      }
    },
    [googleMap, buildMarkerContainer, computeMarkerViewModel, ensureExpandedDOM],
  )

  // Helper function to get marker style configuration based on view model
  const getMarkerStyleConfig = (viewModel: MarkerViewModel) => {
    // Base style configurations for different marker types
    const styleConfigs = {
      qr: {
        borderColor: "#10A37F", // Green
        textColor: "#10A37F",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "#10A37F",
        expandedGlowColor: "rgba(16, 163, 127, 0.6)",
        collapsedGlowColor: "rgba(16, 163, 127, 0.4)",
        titleText: "QR SCANNED VEHICLE"
      },
      virtual: {
        borderColor: "rgba(16, 163, 127, 0.7)", // Lighter green
        textColor: "#10A37F",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "rgba(16, 163, 127, 0.7)",
        expandedGlowColor: "rgba(16, 163, 127, 0.5)",
        collapsedGlowColor: "rgba(16, 163, 127, 0.3)",
        titleText: "SCANNED VEHICLE"
      },
      departure: {
        borderColor: "#3E6AE1", // Blue
        textColor: "#3E6AE1",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "#3E6AE1",
        expandedGlowColor: "rgba(62, 106, 225, 0.6)",
        collapsedGlowColor: "rgba(62, 106, 225, 0.4)",
        titleText: viewModel.pickupMins !== null ? "ESTIMATED PICKUP" : "PICKUP LOCATION"
      },
      arrival: {
        borderColor: "#E82127", // Red
        textColor: "#E82127",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "#E82127",
        expandedGlowColor: "rgba(232, 33, 39, 0.6)",
        collapsedGlowColor: "rgba(232, 33, 39, 0.4)",
        titleText: "DESTINATION"
      },
      listSelected: {
        borderColor: "rgba(220, 220, 220, 0.9)",
        textColor: "#FFFFFF",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "rgba(220, 220, 220, 0.9)",
        expandedGlowColor: "rgba(255, 255, 255, 0.4)",
        collapsedGlowColor: "rgba(220, 220, 220, 0.4)",
        titleText: "SELECTED LOCATION"
      },
      normal: {
        borderColor: "rgba(255, 255, 255, 0.15)",
        textColor: "#FFFFFF",
        markerBackground: "rgba(23, 23, 23, 0.95)",
        markerBorderColor: "rgba(255, 255, 255, 0.7)",
        expandedGlowColor: "rgba(255, 255, 255, 0.3)",
        collapsedGlowColor: "rgba(255, 255, 255, 0.1)",
        titleText: "PICKUP LOCATION"
      }
    };
    
    // Determine which style to use based on the view model
    if (viewModel.style === "qr") {
      return styleConfigs.qr;
    } else if (viewModel.style === "virtual") {
      return styleConfigs.virtual;
    } else if (viewModel.isDeparture) {
      return styleConfigs.departure;
    } else if (viewModel.isArrival) {
      return styleConfigs.arrival;
    } else if (viewModel.isListSelected) {
      return styleConfigs.listSelected;
    } else {
      return styleConfigs.normal;
    }
  };

  // Helper function to add PickupBtn event handlers
  const setupPickupBtnEventHandlers = useCallback((
    pickupBtn: HTMLButtonElement | null,
    stationId: number
  ) => {
    if (!pickupBtn) return;
    
    // Define handlers for button hover effects
    const handleBtnMouseEnter = () => {
      pickupBtn.style.background = "#3A3A3A"; // Slightly darker gray on hover
      pickupBtn.style.transform = "translateY(-1px)";
      pickupBtn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.15)";
      pickupBtn.style.letterSpacing = "0.6px"; // Subtle letter spacing change on hover
    };
    
    const handleBtnMouseLeave = () => {
      pickupBtn.style.background = "#4A4A4A"; // Gray
      pickupBtn.style.transform = "";
      pickupBtn.style.boxShadow = "";
      pickupBtn.style.letterSpacing = "0.5px";
    };
    
    // Add button hover effects
    pickupBtn.addEventListener("mouseenter", handleBtnMouseEnter);
    pickupBtn.addEventListener("mouseleave", handleBtnMouseLeave);
    
    // Add click handler for pickup button
    pickupBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault(); // Prevent any other click events from firing
      import("@/lib/stationSelectionManager").then(module => {
        const stationSelectionManager = module.default;
        if (stationSelectionManager.getCurrentStep() === 2) {
          stationSelectionManager.confirmStationSelection();
        }
      });
    });
  }, []);

  // Style configuration constants moved to module scope
  const MARKER_STYLE_CONFIGS = {
    qr: {
      borderColor: "#10A37F", // Green
      textColor: "#10A37F",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "#10A37F", 
      expandedGlowColor: "rgba(16, 163, 127, 0.6)",
      collapsedGlowColor: "rgba(16, 163, 127, 0.4)",
      titleText: "QR SCANNED VEHICLE",
      stateClass: "marker-qr"
    },
    virtual: {
      borderColor: "rgba(16, 163, 127, 0.7)", // Lighter green
      textColor: "#10A37F",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "rgba(16, 163, 127, 0.7)",
      expandedGlowColor: "rgba(16, 163, 127, 0.5)",
      collapsedGlowColor: "rgba(16, 163, 127, 0.3)",
      titleText: "SCANNED VEHICLE",
      stateClass: "marker-virtual"
    },
    departure: {
      borderColor: "#3E6AE1", // Blue
      textColor: "#3E6AE1",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "#3E6AE1",
      expandedGlowColor: "rgba(62, 106, 225, 0.6)",
      collapsedGlowColor: "rgba(62, 106, 225, 0.4)",
      titleText: "PICKUP LOCATION", // Will be overridden for pickupMins
      stateClass: "marker-departure"
    },
    arrival: {
      borderColor: "#E82127", // Red
      textColor: "#E82127",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "#E82127",
      expandedGlowColor: "rgba(232, 33, 39, 0.6)",
      collapsedGlowColor: "rgba(232, 33, 39, 0.4)",
      titleText: "DESTINATION",
      stateClass: "marker-arrival"
    },
    listSelected: {
      borderColor: "rgba(220, 220, 220, 0.9)",
      textColor: "#FFFFFF",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "rgba(220, 220, 220, 0.9)",
      expandedGlowColor: "rgba(255, 255, 255, 0.4)",
      collapsedGlowColor: "rgba(220, 220, 220, 0.4)",
      titleText: "SELECTED LOCATION",
      stateClass: "marker-selected"
    },
    normal: {
      borderColor: "rgba(255, 255, 255, 0.15)",
      textColor: "#FFFFFF",
      markerBackground: "rgba(23, 23, 23, 0.95)",
      markerBorderColor: "rgba(255, 255, 255, 0.7)",
      expandedGlowColor: "rgba(255, 255, 255, 0.3)",
      collapsedGlowColor: "rgba(255, 255, 255, 0.1)",
      titleText: "PICKUP LOCATION",
      stateClass: "marker-normal"
    }
  };

  // Create a view model cache using station ID and camera state as key
  const viewModelCacheRef = useRef<Map<string, MarkerViewModel>>(new Map());
  
  // Cache key helper
  const createViewModelCacheKey = (stationId: number, camera: {tilt: number; zoom: number}) => {
    // Round values to reduce cache misses on minor camera changes
    const roundedTilt = Math.round(camera.tilt * 2) / 2; // Round to nearest 0.5
    const roundedZoom = Math.round(camera.zoom * 10) / 10; // Round to nearest 0.1
    return `${stationId}_${roundedTilt}_${roundedZoom}`;
  };

  // Updated batchUpdateMarker to use CSS classes and implement better caching
  const batchUpdateMarker = useCallback((
    entry: (typeof candidateStationsRef.current)[number], 
    camera: {tilt: number, zoom: number},
    forceUpdate = false,
    cachedViewModel?: MarkerViewModel // Allow passing a pre-computed view model
  ) => {
    if (!entry.marker || !entry.refs || !entry.stationData) return;
    
    const station = entry.stationData;
    const { marker, refs } = entry;
    
    // Get view model - either from passed parameter or compute new one 
    let viewModel: MarkerViewModel;
    
    if (cachedViewModel) {
      // Use pre-computed view model if provided (from batched updates)
      viewModel = cachedViewModel;
    } else {
      // Check cache first
      const cacheKey = createViewModelCacheKey(station.id, camera);
      
      if (!forceUpdate && viewModelCacheRef.current.has(cacheKey)) {
        viewModel = viewModelCacheRef.current.get(cacheKey)!;
      } else {
        // Compute and cache the new view model
        viewModel = computeMarkerViewModel(station.id, camera);
        viewModelCacheRef.current.set(cacheKey, viewModel);
        
        // Prevent cache from growing too large
        if (viewModelCacheRef.current.size > 500) {
          const keys = Array.from(viewModelCacheRef.current.keys());
          // Remove oldest 100 entries
          const oldestKeys = keys.slice(0, 100);
          oldestKeys.forEach(key => viewModelCacheRef.current.delete(key));
        }
      }
    }
    
    // If it was collapsed and is now expanded, ensure expanded DOM exists
    if (viewModel.isExpanded && !entry.refs?.expandedWrapper) {
      ensureExpandedDOM(entry);
      
      // Setup pickup button handlers if they exist
      if (entry.refs?.pickupBtn) {
        setupPickupBtnEventHandlers(entry.refs.pickupBtn, station.id);
      }
    }
    
    // Show post only if it has sufficient height
    const showPosts = viewModel.postHeight > 4;
    
    // Compare with previous state to avoid unnecessary DOM updates
    const prevState = entry.markerState;
    if (!forceUpdate && prevState && 
        prevState.isExpanded === viewModel.isExpanded &&
        prevState.isVisible === viewModel.isVisible &&
        prevState.isDeparture === viewModel.isDeparture &&
        prevState.isArrival === viewModel.isArrival &&
        prevState.isListSelected === viewModel.isListSelected &&
        Math.abs(prevState.postHeight - viewModel.postHeight) < 0.5 &&
        prevState.showPickupBtn === viewModel.showPickupBtn &&
        prevState.pickupMins === viewModel.pickupMins &&
        prevState.style === viewModel.style) {
      // No significant changes - skip update
      return;
    }
    
    // Update state reference
    entry.markerState = viewModel;
    
    // Get marker style configuration
    const styleConfig = viewModel.isDeparture ? MARKER_STYLE_CONFIGS.departure :
                        viewModel.isArrival ? MARKER_STYLE_CONFIGS.arrival :
                        viewModel.isListSelected ? MARKER_STYLE_CONFIGS.listSelected :
                        viewModel.style === "qr" ? MARKER_STYLE_CONFIGS.qr :
                        viewModel.style === "virtual" ? MARKER_STYLE_CONFIGS.virtual :
                        MARKER_STYLE_CONFIGS.normal;
    
    // Decide collisionBehavior:
    const isHighPriority = viewModel.isDeparture || viewModel.isArrival || 
                          viewModel.style === "qr" || viewModel.style === "virtual";
    
    // Update marker collision behavior based on importance
    marker.collisionBehavior = isHighPriority 
      ? ("REQUIRED" as any) 
      : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any);
    
    if (marker.element) {
      marker.element.style.zIndex = isHighPriority ? "9999" : "1";
    }
    
    // Remove all state classes first
    const container = refs.container;
    const stateClasses = ['marker-normal', 'marker-selected', 'marker-departure', 'marker-arrival', 'marker-qr', 'marker-virtual'];
    stateClasses.forEach(cls => {
      container.classList.remove(cls);
    });
    
    // Add appropriate state class
    container.classList.add(styleConfig.stateClass);
    
    // Handle expanded/collapsed view toggling
    if (refs.expandedWrapper) {
      // Update visibility of expanded/collapsed views
      if (viewModel.isExpanded) {
        refs.collapsedWrapper.style.opacity = "0";
        refs.collapsedWrapper.style.transform = "scale(0.8)";
        refs.expandedWrapper.style.display = "flex";
        requestAnimationFrame(() => {
          if (refs.expandedWrapper) {
            refs.expandedWrapper.style.opacity = "1";
            refs.expandedWrapper.style.transform = "scale(1)";
          }
        });
      } else {
        refs.collapsedWrapper.style.opacity = "1";
        refs.collapsedWrapper.style.transform = "scale(1)";
        refs.expandedWrapper.style.opacity = "0";
        refs.expandedWrapper.style.transform = "scale(0.95)";
        setTimeout(() => {
          if (refs.expandedWrapper) {
            refs.expandedWrapper.style.display = "none";
          }
        }, 250);
      }
      
      // Update post heights for both views - one of the few remaining inline styles needed
      refs.collapsedPost.style.height = `${viewModel.postHeight}px`;
      refs.collapsedPost.style.opacity = showPosts ? "1" : "0";
      
      if (refs.expandedPost) {
        refs.expandedPost.style.height = `${viewModel.postHeight}px`;
        refs.expandedPost.style.opacity = showPosts ? "1" : "0";
      }
      
      // Check animation state from consolidated sources
      let isAnimatingThisStation = false;
      // Only check animation state if relevant (for performance)
      if ((viewModel.isDeparture || viewModel.style === "qr") && typeof window !== 'undefined') {
        // First check our local state
        isAnimatingThisStation = circlingAnimationActive && circlingTargetStation === station.id;
        
        // For departure stations, also consult the animation state manager directly
        if (viewModel.showPickupBtn) {
          try {
            const w = window as any;
            if (w.__animationStateManager) {
              const state = w.__animationStateManager.getState();
              isAnimatingThisStation = state.isAnimating && state.targetId === station.id;
            }
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error('Error checking animation state:', e);
            }
          }
        }
      }

      // Animation progress indicator - use classList for toggling visibility
      if (refs.animationProgress) {
        if (isAnimatingThisStation) {
          refs.animationProgress.style.display = "flex";
        } else {
          refs.animationProgress.style.display = "none";
        }
      }
      
      // Update pickup button visibility based on view model and animation state
      if (refs.pickupBtn) {
        if (viewModel.showPickupBtn && !isAnimatingThisStation) {
          refs.pickupBtn.style.display = "inline-block";
          
          // If we just completed animation, add a nice fade-in effect
          if (circlingTargetStation === station.id) {
            refs.pickupBtn.style.opacity = "0";
            refs.pickupBtn.style.transform = "translateY(5px)";
            
            // Store a reference to the button to use in the timeout
            const pickupBtn = refs.pickupBtn;
            
            // Slight delay for fade-in
            setTimeout(() => {
              // Check that the button still exists
              if (pickupBtn) {
                pickupBtn.style.opacity = "1";
                pickupBtn.style.transform = "translateY(0)";
              }
            }, 100);
          }
        } else {
          refs.pickupBtn.style.display = "none";
        }
      }
      
      // Update info section content
      if (refs.expandedInfoSection) {
        // Create DOM elements rather than setting innerHTML directly
        refs.expandedInfoSection.innerHTML = '';
        
        const titleElement = document.createElement('div');
        titleElement.style.fontSize = '11px';
        titleElement.style.fontWeight = '500';
        titleElement.style.letterSpacing = '0.5px';
        titleElement.style.marginBottom = '2px';
        titleElement.style.color = '#FFFFFF';
        titleElement.style.opacity = '0.7';
        titleElement.style.textTransform = 'uppercase';
        titleElement.style.fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
        titleElement.textContent = viewModel.isDeparture && viewModel.pickupMins !== null
          ? 'ESTIMATED PICKUP'
          : styleConfig.titleText;
        
        const valueElement = document.createElement('div');
        valueElement.style.fontSize = '15px';
        valueElement.style.fontWeight = '400';
        valueElement.style.letterSpacing = '0.2px';
        valueElement.style.color = '#FFFFFF';
        valueElement.style.marginBottom = '3px';
        valueElement.style.fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
        
        if (viewModel.isDeparture && viewModel.pickupMins !== null) {
          valueElement.textContent = `${viewModel.pickupMins} min`;
        } else {
          valueElement.textContent = viewModel.place;
        }
        
        const addressElement = document.createElement('div');
        addressElement.style.fontSize = '11px';
        addressElement.style.opacity = '0.8';
        addressElement.style.lineHeight = '1.3';
        addressElement.style.color = '#FFFFFF';
        addressElement.style.fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";
        addressElement.textContent = viewModel.address;
        
        refs.expandedInfoSection.appendChild(titleElement);
        refs.expandedInfoSection.appendChild(valueElement);
        refs.expandedInfoSection.appendChild(addressElement);
      }
    }
  }, [
    computeMarkerViewModel,
    circlingAnimationActive,
    circlingTargetStation,
    ensureExpandedDOM,
    setupPickupBtnEventHandlers
  ]);

  // Function to properly clean up a marker's DOM elements and event listeners
  const cleanupMarker = useCallback((entry: (typeof candidateStationsRef.current)[number]) => {
    if (!entry.marker || !entry.refs) return;
    
    const { marker, refs } = entry;
    
    // First fade out visually
    if (refs.container) {
      refs.container.style.transform = "scale(0)";
      refs.container.style.opacity = "0";
    }
    
    // Remove marker from map
    marker.map = null;
    
    // Clean up event listeners on collapsed and expanded views
    if (refs.collapsedDiv) {
      // Remove click listener for station selection
      refs.collapsedDiv.removeEventListener("click", (ev: Event) => {
        ev.stopPropagation();
        handleStationClick(entry.stationId);
      });
      
      // Remove hover effect listeners
      if (refs.eventHandlers) {
        refs.collapsedDiv.removeEventListener("mouseenter", refs.eventHandlers.collapsedMouseEnter);
        refs.collapsedDiv.removeEventListener("mouseleave", refs.eventHandlers.collapsedMouseLeave);
      }
      
      // Recycle the collapsed marker element
      markerPoolRef.current.recycleCollapsedMarker(refs.collapsedDiv);
    }
    
    // Clean up expanded view if it's not a virtual car station
    if (refs.expandedDiv && !entry.stationData?.properties.isVirtualCarLocation) {
      // Remove hover effect listeners - use type assertions for cleaner code
      if (refs.eventHandlers.expandedMouseEnter) {
        refs.expandedDiv.removeEventListener("mouseenter", refs.eventHandlers.expandedMouseEnter);
      }
      if (refs.eventHandlers.expandedMouseLeave) {
        refs.expandedDiv.removeEventListener("mouseleave", refs.eventHandlers.expandedMouseLeave);
      }
      
      // Clean up pickup button
      if (refs.pickupBtn) {
        // Remove all event listeners (click and hover effects)
        refs.pickupBtn.replaceWith(refs.pickupBtn.cloneNode(true));
      }
      
      // Recycle the expanded marker element
      markerPoolRef.current.recycleExpandedMarker(refs.expandedDiv);
    }
    
    // Clear the marker reference
    entry.marker = null;
    entry.refs = undefined;
  }, [handleStationClick]);

  // Unified map update handler that implements true batching
  const handleMapUpdate = useCallback(() => {
    if (!googleMap) return;
    
    // Get current camera state using individual methods
    const tilt = googleMap.getTilt() || 0;
    const zoom = googleMap.getZoom() || DEFAULT_ZOOM;
    
    // Notify callbacks if provided
    options?.onTiltChange?.(tilt);
    options?.onZoomChange?.(zoom);
    
    // Get bounds for visibility determination
    const bounds = googleMap.getBounds();
    if (!bounds) return;
    
    // Use spatial index for efficient lookup of potentially visible stations
    const visibleStationIds = spatialIndexRef.current.getVisibleStations(bounds);
    
    // Current camera info for view model
    const cameraInfo = { tilt, zoom };
    
    // Create pending updates array for batching DOM updates
    const pendingUpdates: {
      entry: typeof candidateStationsRef.current[number];
      viewModel: MarkerViewModel;
      forceUpdate: boolean;
    }[] = [];
    
    // PHASE 1: Compute all view models and collect changes (pure JS, no DOM)
    candidateStationsRef.current.forEach(entry => {
      const { stationId, marker } = entry;
      
      // Use cached view model if available, or compute a new one
      const cacheKey = createViewModelCacheKey(stationId, cameraInfo);
      let viewModel: MarkerViewModel;
      
      if (viewModelCacheRef.current.has(cacheKey)) {
        viewModel = viewModelCacheRef.current.get(cacheKey)!;
      } else {
        viewModel = computeMarkerViewModel(stationId, cameraInfo);
        viewModelCacheRef.current.set(cacheKey, viewModel);
      }
      
      // Combined visibility check - either the view model marks it as important,
      // or it's in the visible bounds (optimized via spatial index)
      const shouldBeVisible = viewModel.isVisible || visibleStationIds.includes(stationId);
      
      // Debug logging
      if ((viewModel.style === "qr" || viewModel.style === "virtual") && process.env.NODE_ENV === "development") {
        console.log('[useMarkerOverlay] Processing virtual car station:', stationId);
      }
      
      // First handle marker existence/visibility
      if (shouldBeVisible) {
        if (!marker) {
          // Create new marker if needed - can't batch this part
          createStationMarker(entry);
        } else if (!marker.map) {
          // Add to map if not already visible - just update map reference
          marker.map = googleMap;
        }
        
        // Add this marker to pending updates if it exists
        if (entry.marker) {
          // Force update for QR/virtual car stations for reliable visibility
          const forceUpdate = viewModel.style === "qr" || viewModel.style === "virtual";
          
          // Quick check if we actually need to update this marker
          const prevState = entry.markerState;
          const needsUpdate = forceUpdate || !prevState || 
                          prevState.isExpanded !== viewModel.isExpanded ||
                          prevState.isVisible !== viewModel.isVisible ||
                          prevState.isDeparture !== viewModel.isDeparture ||
                          prevState.isArrival !== viewModel.isArrival ||
                          prevState.isListSelected !== viewModel.isListSelected ||
                          Math.abs(prevState.postHeight - viewModel.postHeight) >= 0.5 ||
                          prevState.showPickupBtn !== viewModel.showPickupBtn ||
                          prevState.pickupMins !== viewModel.pickupMins ||
                          prevState.style !== viewModel.style;
          
          if (needsUpdate) {
            pendingUpdates.push({
              entry,
              viewModel,
              forceUpdate
            });
          }
        }
      } else if (marker && marker.map) {
        // If the marker is currently visible but shouldn't be, properly clean it up
        // This is more effective than just removing it from the map
        if (entry.refs && !viewModel.isVisible) {
          // Only recycle if this isn't a high-priority marker (departure, arrival, etc.)
          cleanupMarker(entry);
        } else {
          // For high-priority markers, just hide them without recycling
          marker.map = null;
        }
      }
    });
    
    // Update route marker with the same camera info
    createOrUpdateRouteMarker(cameraInfo);
    
    // PHASE 2: Apply all DOM updates in a single animation frame
    if (pendingUpdates.length > 0) {
      // Cancel any previous pending animation frame
      if (pendingAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pendingAnimationFrameRef.current);
      }
      
      // Queue a new animation frame for the DOM updates
      pendingAnimationFrameRef.current = requestAnimationFrame(() => {
        // Process all pending updates with the cached view models
        pendingUpdates.forEach(update => {
          const { entry, viewModel, forceUpdate } = update;
          batchUpdateMarker(entry, cameraInfo, forceUpdate, viewModel);
        });
        
        // Clear the pending animation frame reference
        pendingAnimationFrameRef.current = null;
      });
    }
  }, [
    googleMap, 
    createStationMarker, 
    batchUpdateMarker, 
    createOrUpdateRouteMarker, 
    computeMarkerViewModel, 
    cleanupMarker, 
    createViewModelCacheKey
  ]);
  
  // Debounced map update handler
  const debouncedMapUpdate = useMemo(() => {
    return debounce(() => {
      if (pendingAnimationFrameRef.current === null) {
        pendingAnimationFrameRef.current = requestAnimationFrame(() => {
          pendingAnimationFrameRef.current = null;
          handleMapUpdate();
        });
      }
    }, 120); // ~120ms, up from 16ms
  }, [handleMapUpdate]);

  // Create a ref outside the effect to track previous lengths
  const prevLengthsRef = useRef<{stations: number; buildings3D: number}>({
    stations: -1, 
    buildings3D: -1
  });
  
  // Initialize candidate stations only when stations or buildings3D change
  useEffect(() => {
    // Store current lengths to compare with previous values
    const currentStationsLength = stations.length;
    const currentBuildings3DLength = buildings3D.length;
    
    // Only reinitialize if the arrays have changed length
    if (prevLengthsRef.current.stations !== currentStationsLength ||
        prevLengthsRef.current.buildings3D !== currentBuildings3DLength) {
      
      // Update the stored lengths
      prevLengthsRef.current = {
        stations: currentStationsLength,
        buildings3D: currentBuildings3DLength
      };
      
      if (process.env.NODE_ENV === "development") {
        console.log('[useMarkerOverlay] Reinitializing candidate stations due to data change');
      }
      
      // Now reinitialize the stations
      initializeCandidateStations();
    }
  }, [stations, buildings3D, initializeCandidateStations]);

  // Add unified map listener for camera changes
  useEffect(() => {
    if (!googleMap) return;
    
    // Rely solely on 'idle' for marker updates
    const idleListener = googleMap.addListener("idle", debouncedMapUpdate);
  
    // Run initial marker update
    handleMapUpdate();
  
    return () => {
      google.maps.event.removeListener(idleListener);
    };
  }, [googleMap, handleMapUpdate, debouncedMapUpdate]);

  // Re-run styling whenever booking step, route, or list selection changes
  useEffect(() => {
    debouncedMapUpdate();
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    listSelectedStationId,
    dispatchRoute,
    bookingRoute,
    debouncedMapUpdate,
  ]);

  

  // Cleanup: fade out on unmount with proper recycling
  useEffect(() => {
    return () => {
      // Cancel any pending animation frames
      if (pendingAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pendingAnimationFrameRef.current);
        pendingAnimationFrameRef.current = null;
      }
      
      // Clean up all markers
      candidateStationsRef.current.forEach(cleanupMarker);

      // Clean up route marker
      if (routeMarkerRef.current) {
        const content = routeMarkerRef.current.content as HTMLElement;
        if (content) {
          content.style.transform = "scale(0)";
          content.style.opacity = "0";
        }
        
        setTimeout(() => {
          if (routeMarkerRef.current) {
            routeMarkerRef.current.map = null;
            routeMarkerRef.current = null;
          }
        }, 300);
      }
    };
  }, [cleanupMarker]);

  // For backwards compatibility, provide these methods
  // They now trigger the unified update cycle
  const updateMarkerTilt = useCallback((newTilt: number) => {
    options?.onTiltChange?.(newTilt);
    debouncedMapUpdate();
  }, [options, debouncedMapUpdate]);
  
  const updateMarkerZoom = useCallback((newZoom: number) => {
    options?.onZoomChange?.(newZoom);
    debouncedMapUpdate();
  }, [options, debouncedMapUpdate]);

  return {
    routeMarkerRef,
    updateMarkerTilt,
    updateMarkerZoom,
  };
}