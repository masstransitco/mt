"use client"

import { useEffect, useRef, useCallback, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { useAppSelector, useAppDispatch, store } from "@/store/store"
import { selectStationsWithDistance, type StationFeature } from "@/store/stationsSlice"
import { selectStations3D } from "@/store/stations3DSlice"
import { DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, MARKER_POST_MAX_ZOOM } from "@/constants/map"
import { debounce } from "lodash"

import {
  selectBookingStep,
  selectDepartureStationId,
  selectArrivalStationId,
  advanceBookingStep,
  selectDepartureStation as doSelectDepartureStation,
  selectArrivalStation as doSelectArrivalStation,
  selectRoute as selectBookingRoute, // The route for DEPARTURE->ARRIVAL:
} from "@/store/bookingSlice"

// The route from dispatch hub -> departure station:
import { selectDispatchRoute } from "@/store/dispatchSlice"

// Import the list selected station
import { selectListSelectedStationId } from "@/store/userSlice"

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
    if (target.classList.contains('collapsed-view')) {
      target.style.transform = "scale(1.05)";
      target.style.borderColor = "rgba(255, 255, 255, 1)";
      target.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    }
  };
  private handleMarkerUnhover = (ev: Event) => {
    const target = ev.currentTarget as HTMLElement;
    if (target.classList.contains('collapsed-view')) {
      target.style.transform = "";
      target.style.borderColor = "rgba(255, 255, 255, 0.9)";
      target.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12), 0 0 1px rgba(255,255,255,0.05)";
    }
  };

  // Set the station click handler
  setStationClickHandler(handler: (ev: Event) => void): void {
    this.handleStationClick = handler;
  }

  recycleCollapsedMarker(element: HTMLElement): void {
    if (this.collapsedMarkers.length < this.maxPoolSize) {
      // 1) Remove any event listeners we attached earlier
      this.removeAllMarkerEventListeners(element);

      // 2) Reset relevant fields
      element.className = 'collapsed-view';
      element.innerHTML = ''; // Empty for solid circle
      element.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(23, 23, 23, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 0 1px rgba(255,255,255,0.05);
        pointer-events: auto;
        transform-origin: center;
        will-change: transform, background-color, box-shadow;
        transition: all 0.2s cubic-bezier(0.2, 0, 0.2, 1);
        border: 2px solid rgba(255, 255, 255, 0.9);
      `;

      // 3) Store the original node in the pool
      this.collapsedMarkers.push(element);
    }
  }

  recycleExpandedMarker(element: HTMLElement): void {
    if (this.expandedMarkers.length < this.maxPoolSize) {
      // 1) Remove any event listeners we attached earlier
      this.removeAllMarkerEventListeners(element);

      // 2) Reset relevant fields
      element.className = 'expanded-view';
      element.style.cssText = `
        width: 170px;
        background: rgba(23, 23, 23, 0.98);
        backdrop-filter: blur(12px);
        color: #FFFFFF;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        padding: 7px;
        cursor: pointer;
        pointer-events: auto;
        transform-origin: center;
        will-change: transform, border-color, box-shadow;
        transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `;

      // Reset inner HTML to original state
      element.innerHTML = `
        <div class="expanded-info-section" style="margin-bottom: 5px;"></div>
        
        <!-- Add animation progress indicator - Tesla style -->
        <div class="animation-progress" style="
          height: 22px;
          display: none;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
        ">
          <div style="
            width: 14px;
            height: 14px;
            border: 1.5px solid #3E6AE1;
            border-top-color: transparent;
            border-radius: 50%;
            animation: camera-spin 1s linear infinite;
          "></div>
          <span style="margin-left: 5px; font-size: 11px; color: #FFFFFF; font-weight: 400; letter-spacing: 0.5px; opacity: 0.9; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">SCANNING LOCATION</span>
        </div>
        
        <button class="pickup-btn" style="
          display: inline-block;
          width: 100%;
          padding: 7px 0;
          background: #4A4A4A;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 500;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        ">
          SELECT LOCATION
        </button>
        
        <style>
          @keyframes camera-spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;

      // 3) Store the original node in the pool
      this.expandedMarkers.push(element);
    }
  }

  // Create a fresh collapsed marker with consistent styling
  private createCollapsedMarker = (): HTMLElement => {
    const collapsedDiv = document.createElement("div");
    collapsedDiv.classList.add("collapsed-view");
    collapsedDiv.style.cssText = `
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(23, 23, 23, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 0 1px rgba(255,255,255,0.05);
    pointer-events: auto;
    transform-origin: center;
    will-change: transform, background-color, box-shadow;
    transition: all 0.2s cubic-bezier(0.2, 0, 0.2, 1);
    border: 2px solid rgba(255, 255, 255, 0.9);
  `;
    // Empty inner HTML - just a solid circle with border
    return collapsedDiv;
  }

  // Create a fresh expanded marker with proper structure but no event handlers
  private createExpandedMarker = (): HTMLElement => {
    const expandedDiv = document.createElement("div");
    expandedDiv.classList.add("expanded-view");
    expandedDiv.style.cssText = `
    width: 170px;
    background: rgba(23, 23, 23, 0.98);
    backdrop-filter: blur(12px);
    color: #FFFFFF;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    padding: 7px;
    cursor: pointer;
    pointer-events: auto;
    transform-origin: center;
    will-change: transform, border-color, box-shadow;
    transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
  `;
    expandedDiv.innerHTML = `
    <div class="expanded-info-section" style="margin-bottom: 5px;"></div>
    
    <!-- Add animation progress indicator - Tesla style -->
    <div class="animation-progress" style="
      height: 22px;
      display: none;
      align-items: center;
      justify-content: center;
      margin-bottom: 5px;
    ">
      <div style="
        width: 14px;
        height: 14px;
        border: 1.5px solid #3E6AE1;
        border-top-color: transparent;
        border-radius: 50%;
        animation: camera-spin 1s linear infinite;
      "></div>
      <span style="margin-left: 5px; font-size: 11px; color: #FFFFFF; font-weight: 400; letter-spacing: 0.5px; opacity: 0.9; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">SCANNING LOCATION</span>
    </div>
    
    <button class="pickup-btn" style="
      display: inline-block;
      width: 100%;
      padding: 7px 0;
      background: #4A4A4A;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 500;
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.25s ease;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    ">
      SELECT LOCATION
    </button>
    
    <style>
      @keyframes camera-spin {
        to { transform: rotate(360deg); }
      }
    </style>
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
      refs?: ReturnType<typeof buildMarkerContainer>
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

  // Build DOM for each station marker, hooking up events - optimized version with Apple-inspired aesthetics
const buildMarkerContainer = useCallback(
  (station: StationFeature) => {
    // Set the station click handler in the marker pool
    markerPoolRef.current.setStationClickHandler((ev: Event) => {
      ev.stopPropagation();
      handleStationClick(station.id);
    });
    
    const container = document.createElement("div")
    container.classList.add("marker-container")
    container.style.cssText = `
      position: relative;
      pointer-events: auto;
      transform-origin: center bottom;
      will-change: transform, opacity;
      transition: transform 0.25s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.2s ease;
      transform: scale(0);
      opacity: 1;
    `

    // Check if this is a virtual car station
    const isVirtualCarStation = station.properties.isVirtualCarLocation === true
    
    if (process.env.NODE_ENV === "development") {
      console.log('[useMarkerOverlay] Building marker for station:', station.id, 'isVirtualCarStation:', isVirtualCarStation)
      if (isVirtualCarStation) {
        console.log('[useMarkerOverlay] Virtual car details:', {
          registration: station.properties.registration,
          plateNumber: station.properties.plateNumber,
          place: station.properties.Place
        })
      }
    }

    // Collapsed marker
    const collapsedWrapper = document.createElement("div")
    collapsedWrapper.classList.add("collapsed-wrapper")
    collapsedWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
      will-change: opacity, transform;
      transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
    `

    // Use pool for collapsed marker
    const collapsedDiv = markerPoolRef.current.getCollapsedMarker()

    // Add marker event listeners
    // Marker click → station selection
    collapsedDiv.addEventListener("click", (ev) => {
      ev.stopPropagation()
      handleStationClick(station.id)
    })

    // Hover effect - Tesla-inspired clean and subtle
    const handleMouseEnter = () => {
      collapsedDiv.style.transform = "scale(1.05)"
      collapsedDiv.style.borderColor = "rgba(255, 255, 255, 1)"
      collapsedDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)"
    };
    const handleMouseLeave = () => {
      collapsedDiv.style.transform = ""
      collapsedDiv.style.borderColor = "rgba(255, 255, 255, 0.9)"
      collapsedDiv.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12), 0 0 1px rgba(255,255,255,0.05)"
    };
    
    collapsedDiv.addEventListener("mouseenter", handleMouseEnter);
    collapsedDiv.addEventListener("mouseleave", handleMouseLeave);

    const collapsedPost = document.createElement("div")
    collapsedPost.style.cssText = `
      width: 1px;
      height: 28px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.1));
      margin-top: 1px;
      pointer-events: none;
      will-change: height, opacity;
      transition: height 0.25s ease, opacity 0.25s ease;
    `
    collapsedWrapper.appendChild(collapsedDiv)
    collapsedWrapper.appendChild(collapsedPost)

    // Expanded marker
    const expandedWrapper = document.createElement("div")
    expandedWrapper.classList.add("expanded-wrapper")
    expandedWrapper.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      will-change: opacity, transform;
      transition: opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
    `

    // Create a custom expanded div for scanned car stations
    let expandedDiv: HTMLElement
    
    if (isVirtualCarStation) {
      // Create custom expanded marker for scanned car
      expandedDiv = document.createElement("div")
      expandedDiv.classList.add("expanded-view")
      expandedDiv.style.cssText = `
        width: 200px;
        background: rgba(16, 16, 16, 0.98);
        backdrop-filter: blur(12px);
        color: #FFFFFF;
        border: 2px solid #E82127;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15), 0 0 15px rgba(232, 33, 39, 0.3);
        padding: 8px;
        cursor: pointer;
        pointer-events: auto;
        transform-origin: center;
        will-change: transform, border-color, box-shadow;
        transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `
      
      // Get the car registration if available
      const registration = station.properties.registration || station.properties.plateNumber || '';
      
      expandedDiv.innerHTML = `
        <div class="expanded-info-section" style="margin-bottom: 5px;">
          <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 2px; color: #E82127; text-transform: uppercase;">
            SCANNED CAR
          </div>
          <div style="font-size: 15px; font-weight: 400; letter-spacing: 0.2px; color: #FFFFFF; margin-bottom: 3px;">
            ${(station.properties.Place || 'Electric Vehicle').replace(/\[.*\]/, '')} <!-- Remove brackets if they exist -->
          </div>
          <div style="font-size: 11px; opacity: 0.8; line-height: 1.3; color: #FFFFFF;">
            ${station.properties.Address || 'Current location'}
          </div>
        </div>
        
        <!-- Car Plate - similar to CarPlate.tsx - ALWAYS show for virtual car stations -->
        <div class="car-plate-container" style="
          margin: 8px 0;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          ">
            <!-- Plate border -->
            <div style="
              position: absolute;
              inset: 0;
              border-radius: 0.75rem;
              border: 2px solid black;
              z-index: 2;
            "></div>
            
            <!-- Plate background -->
            <div style="
              width: 100%;
              height: 100%;
              border-radius: 0.75rem;
              background-color: #f3f4f6;
              padding: 0.75rem 1.25rem;
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.25rem;
              ">
                ${(registration || station.properties.Place || "").split('').map(char => `
                  <span style="
                    color: black;
                    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 1.5rem;
                    font-weight: bold;
                    ${char === ' ' ? 'width: 0.5rem;' : ''}
                  ">${char !== ' ' ? char : ''}</span>
                `).join('')}
              </div>
            </div>
            
            <!-- Plate shadow -->
            <div style="
              position: absolute;
              bottom: -0.25rem;
              left: 0.25rem;
              right: 0.25rem;
              height: 0.5rem;
              background: black;
              opacity: 0.2;
              filter: blur(3px);
              border-radius: 9999px;
              z-index: 0;
            "></div>
          </div>
        </div>
        
        <!-- Animation progress indicator - Tesla style -->
        <div class="animation-progress" style="
          height: 22px;
          display: none;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
        ">
          <div style="
            width: 14px;
            height: 14px;
            border: 1.5px solid #10A37F;
            border-top-color: transparent;
            border-radius: 50%;
            animation: camera-spin 1s linear infinite;
          "></div>
          <span style="margin-left: 5px; font-size: 11px; color: #FFFFFF; font-weight: 400; letter-spacing: 0.5px; opacity: 0.9; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">SCANNING LOCATION</span>
        </div>
        
        <button class="pickup-btn" style="
          display: inline-block;
          width: 100%;
          padding: 8px 0;
          background: #4A4A4A;
          color: #FFFFFF;
          font-size: 12px;
          font-weight: 500;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.25s ease;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        ">
          START DRIVING HERE
        </button>
        
        <style>
          @keyframes camera-spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `
    } else {
      // Use pool for regular stations
      expandedDiv = markerPoolRef.current.getExpandedMarker()
    }

    // Define handlers for expanded view hover effects
    const handleExpandedMouseEnter = () => {
      expandedDiv.style.transform = "scale(1.01) translateY(-1px)"
      expandedDiv.style.borderColor = isVirtualCarStation ? "rgba(232, 33, 39, 1)" : "rgba(255, 255, 255, 0.18)"
      expandedDiv.style.boxShadow = isVirtualCarStation 
        ? "0 5px 12px rgba(0,0,0,0.18), 0 0 20px rgba(232, 33, 39, 0.4)" 
        : "0 5px 12px rgba(0,0,0,0.18)"
    };
    
    const handleExpandedMouseLeave = () => {
      expandedDiv.style.transform = ""
      expandedDiv.style.borderColor = isVirtualCarStation ? "#E82127" : "rgba(255, 255, 255, 0.12)"
      expandedDiv.style.boxShadow = isVirtualCarStation 
        ? "0 4px 10px rgba(0,0,0,0.15), 0 0 15px rgba(232, 33, 39, 0.3)" 
        : "0 4px 10px rgba(0,0,0,0.15)"
    };
    
    // Add hover effects to expanded view
    expandedDiv.addEventListener("mouseenter", handleExpandedMouseEnter);
    expandedDiv.addEventListener("mouseleave", handleExpandedMouseLeave);

    // "Pickup car here" button → only in step 2
    const pickupBtn = expandedDiv.querySelector<HTMLButtonElement>(".pickup-btn")
    if (pickupBtn) {
      // Set different text for virtual car stations
      if (isVirtualCarStation) {
        pickupBtn.textContent = "START DRIVING HERE"
      }
      
      // Define handlers for button hover effects
      const handleBtnMouseEnter = () => {
        pickupBtn.style.background = "#3A3A3A" // Slightly darker gray on hover
        pickupBtn.style.transform = "translateY(-1px)"
        pickupBtn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.15)"
        pickupBtn.style.letterSpacing = "0.6px" // Subtle letter spacing change on hover
      };
      
      const handleBtnMouseLeave = () => {
        pickupBtn.style.background = "#4A4A4A" // Gray
        pickupBtn.style.transform = ""
        pickupBtn.style.boxShadow = ""
        pickupBtn.style.letterSpacing = "0.5px"
      };
      
      // Add button hover effects
      pickupBtn.addEventListener("mouseenter", handleBtnMouseEnter);
      pickupBtn.addEventListener("mouseleave", handleBtnMouseLeave);
      
      // Add click handler for pickup button
      pickupBtn.addEventListener("click", (ev) => {
        ev.stopPropagation()
        import("@/lib/stationSelectionManager").then(module => {
          const stationSelectionManager = module.default;
          if (stationSelectionManager.getCurrentStep() === 2) {
            stationSelectionManager.confirmStationSelection();
            options?.onPickupClick?.(station.id) // keep for backwards compatibility
          }
        });
      });
    }

    const expandedPost = document.createElement("div")
    expandedPost.style.cssText = `
      width: 1px;
      height: 28px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(255,255,255,0.1));
      margin-top: 1px;
      pointer-events: none;
      will-change: height, opacity;
      transition: height 0.25s ease, opacity 0.25s ease;
    `
    expandedWrapper.appendChild(expandedDiv)
    expandedWrapper.appendChild(expandedPost)

    // Combine
    container.appendChild(collapsedWrapper)
    container.appendChild(expandedWrapper)

    return {
      container,
      collapsedWrapper,
      collapsedDiv,
      collapsedPost,
      expandedWrapper,
      expandedDiv,
      expandedPost,
      pickupBtn,
      animationProgress: expandedDiv.querySelector<HTMLDivElement>(".animation-progress"),
      expandedInfoSection: expandedDiv.querySelector<HTMLDivElement>(".expanded-info-section"),
      // Store event handlers for cleanup
      eventHandlers: {
        collapsedMouseEnter: handleMouseEnter,
        collapsedMouseLeave: handleMouseLeave,
        expandedMouseEnter: handleExpandedMouseEnter,
        expandedMouseLeave: handleExpandedMouseLeave,
      }
    }
  },
  [dispatch, handleStationClick, options],
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
      if (!googleMap) return
      if (!window.google?.maps?.marker?.AdvancedMarkerElement) return

      // Build DOM for marker if not built yet
      if (!entry.refs) {
        if (!entry.stationData) return
        entry.refs = buildMarkerContainer(entry.stationData)
      }
      const { container } = entry.refs || {}
      if (!container) return

      // Compute initial view model
      const viewModel = computeMarkerViewModel(entry.stationId);
      
      if (viewModel.style === "qr" || viewModel.style === "virtual") {
        console.log('[useMarkerOverlay] Creating marker for virtual car station:', entry.stationId);
      }

      const { AdvancedMarkerElement } = window.google.maps.marker
      entry.marker = new AdvancedMarkerElement({
        position: entry.position,
        // Use REQUIRED collision behavior for virtual/QR stations to ensure visibility
        collisionBehavior: (viewModel.style === "qr" || viewModel.style === "virtual") 
          ? "REQUIRED" as any 
          : "OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any,
        gmpClickable: true,
        content: container,
        map: googleMap,
      })
      ;(entry.marker as any)._refs = entry.refs
      ;(entry.marker as any)._stationData = entry.stationData

      // Store the view model for diffing
      entry.markerState = viewModel;

      // Animate in - use requestAnimationFrame for better performance
      // No delay for virtual car stations to ensure immediate visibility
      container.style.transitionDelay = (viewModel.style === "qr" || viewModel.style === "virtual") 
        ? "0ms" 
        : `${Math.random() * 150}ms`
      
      requestAnimationFrame(() => {
        container.style.transform = "scale(1)"
        
        // Set z-index higher for virtual car stations
        if ((viewModel.style === "qr" || viewModel.style === "virtual") && entry.marker && entry.marker.element) {
          entry.marker.element.style.zIndex = "10000"
        }
      })
      
      // Set initial state of expanded/collapsed view based on view model
      if (entry.refs) {
        const { collapsedWrapper, expandedWrapper } = entry.refs
        
        if (viewModel.isExpanded) {
          // Show expanded view
          collapsedWrapper.style.opacity = "0"
          collapsedWrapper.style.transform = "scale(0.8)"
          expandedWrapper.style.display = "flex"
          expandedWrapper.style.opacity = "1"
          expandedWrapper.style.transform = "scale(1)"
        } else {
          // Show collapsed view
          collapsedWrapper.style.opacity = "1"
          collapsedWrapper.style.transform = "scale(1)"
          expandedWrapper.style.opacity = "0"
          expandedWrapper.style.transform = "scale(0.95)"
          setTimeout(() => {
            expandedWrapper.style.display = "none"
          }, 250)
        }
      }
    },
    [googleMap, buildMarkerContainer, computeMarkerViewModel],
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

  // Batch update markers with the unified camera info using the ViewModel
  const batchUpdateMarker = useCallback((
    entry: (typeof candidateStationsRef.current)[number], 
    camera: {tilt: number, zoom: number},
    forceUpdate = false
  ) => {
    if (!entry.marker || !entry.refs || !entry.stationData) return;
    
    const station = entry.stationData;
    const { marker, refs } = entry;
    
    // Compute new view model with the current camera settings
    const viewModel = computeMarkerViewModel(station.id, camera);
    
    // Show post only if it has sufficient height
    const showPosts = viewModel.postHeight > 4 ? "1" : "0";
    
    // Compare with previous state
    const prevState = entry.markerState;
    if (!forceUpdate && prevState && 
        prevState.isExpanded === viewModel.isExpanded &&
        prevState.isVisible === viewModel.isVisible &&
        prevState.isDeparture === viewModel.isDeparture &&
        prevState.isArrival === viewModel.isArrival &&
        prevState.isListSelected === viewModel.isListSelected &&
        Math.abs(prevState.postHeight - viewModel.postHeight) < 0.5 &&
        prevState.showPickupBtn === viewModel.showPickupBtn &&
        prevState.pickupMins === viewModel.pickupMins) {
      // No significant changes - skip update
      return;
    }
    
    // Update state reference
    entry.markerState = viewModel;
    
    // Update marker collision behavior based on importance
    marker.collisionBehavior = viewModel.isVisible 
      ? ("REQUIRED" as any) 
      : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any);
    
    if (marker.element) {
      marker.element.style.zIndex = viewModel.isVisible ? "9999" : "1";
    }
    
    // Update visibility of expanded/collapsed views
    if (viewModel.isExpanded) {
      refs.collapsedWrapper.style.opacity = "0";
      refs.collapsedWrapper.style.transform = "scale(0.8)";
      refs.expandedWrapper.style.display = "flex";
      requestAnimationFrame(() => {
        refs.expandedWrapper.style.opacity = "1";
        refs.expandedWrapper.style.transform = "scale(1)";
      });
    } else {
      refs.collapsedWrapper.style.opacity = "1";
      refs.collapsedWrapper.style.transform = "scale(1)";
      refs.expandedWrapper.style.opacity = "0";
      refs.expandedWrapper.style.transform = "scale(0.95)";
      setTimeout(() => {
        refs.expandedWrapper.style.display = "none";
      }, 250);
    }
    
    // Update post heights for both views
    refs.collapsedPost.style.height = `${viewModel.postHeight}px`;
    refs.collapsedPost.style.opacity = showPosts;
    refs.expandedPost.style.height = `${viewModel.postHeight}px`;
    refs.expandedPost.style.opacity = showPosts;
    
    // Check animation state from a single source
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

    // Animation progress indicator
    if (refs.animationProgress) {
      refs.animationProgress.style.display = isAnimatingThisStation ? "flex" : "none";
    }
    
    // Update pickup button visibility based on view model and animation state
    if (refs.pickupBtn) {
      if (viewModel.showPickupBtn) {
        // Show button only if not animating
        refs.pickupBtn.style.display = isAnimatingThisStation ? "none" : "inline-block";
        
        // If we just completed animation, add a nice fade-in effect
        if (!isAnimatingThisStation && circlingTargetStation === station.id) {
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
              pickupBtn.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
            }
          }, 100);
        }
      } else {
        refs.pickupBtn.style.display = "none";
      }
    }
    
    // Get marker style configuration based on view model
    const styleConfig = getMarkerStyleConfig(viewModel);
    
    // Apply styles to collapsed marker
    refs.collapsedDiv.style.background = styleConfig.markerBackground;
    refs.collapsedDiv.style.borderColor = styleConfig.markerBorderColor;
    
    // Special styling for important stations
    if (viewModel.isDeparture || viewModel.isArrival || viewModel.isListSelected) {
      refs.collapsedDiv.style.transform = "scale(1.05)";
      refs.collapsedDiv.style.boxShadow = `0 1px 3px rgba(0,0,0,0.15), 0 0 6px ${styleConfig.collapsedGlowColor}`;
      refs.collapsedDiv.style.borderWidth = "2px";
    } else {
      refs.collapsedDiv.style.transform = "";
      refs.collapsedDiv.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12), 0 0 1px rgba(255,255,255,0.05)";
      refs.collapsedDiv.style.borderWidth = "1.5px";
    }
    
    // Apply styles to expanded marker
    refs.expandedDiv.style.borderColor = styleConfig.borderColor;
    if (viewModel.isDeparture || viewModel.isArrival || viewModel.isListSelected) {
      refs.expandedDiv.style.boxShadow = `0 8px 20px rgba(0,0,0,0.3), 0 0 20px ${styleConfig.expandedGlowColor}`;
      refs.expandedDiv.style.borderWidth = "2px";
    } else {
      refs.expandedDiv.style.boxShadow = "0 8px 16px rgba(0,0,0,0.25)";
      refs.expandedDiv.style.borderWidth = "1px";
    }
    
    // Update info section content
    if (!refs.expandedInfoSection) return;
    
    if (viewModel.isDeparture && viewModel.pickupMins !== null) {
      refs.expandedInfoSection.innerHTML = `
        <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 2px; color: #FFFFFF; opacity: 0.7; text-transform: uppercase; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${styleConfig.titleText}
        </div>
        <div style="font-size: 15px; font-weight: 400; letter-spacing: 0.2px; color: #FFFFFF; margin-bottom: 3px; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${viewModel.pickupMins} min
        </div>
        <div style="font-size: 11px; opacity: 0.8; line-height: 1.3; color: #FFFFFF; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${viewModel.address}
        </div>
      `;
    } else {
      refs.expandedInfoSection.innerHTML = `
        <div style="font-size: 11px; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 2px; color: #FFFFFF; opacity: 0.7; text-transform: uppercase; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${styleConfig.titleText}
        </div>
        <div style="font-size: 15px; font-weight: 400; letter-spacing: 0.2px; color: #FFFFFF; margin-bottom: 3px; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${viewModel.place}
        </div>
        <div style="font-size: 11px; opacity: 0.8; line-height: 1.3; color: #FFFFFF; font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;">
          ${viewModel.address}
        </div>
      `;
    }
  }, [
    computeMarkerViewModel,
    circlingAnimationActive,
    circlingTargetStation
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
      // Remove hover effect listeners
      if (refs.eventHandlers) {
        refs.expandedDiv.removeEventListener("mouseenter", refs.eventHandlers.expandedMouseEnter);
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

  // Unified map update handler that combines tilt, zoom, and bounds changes
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
    
    // Single unified pass: process all stations in one loop with view model-driven decisions
    candidateStationsRef.current.forEach(entry => {
      const { stationId, marker } = entry;
      
      // Always compute the view model first - single source of truth
      const viewModel = computeMarkerViewModel(stationId, cameraInfo);
      
      // Combined visibility check - either the view model marks it as important,
      // or it's in the visible bounds (optimized via spatial index)
      const shouldBeVisible = viewModel.isVisible || visibleStationIds.includes(stationId);
      
      if (viewModel.style === "qr" || viewModel.style === "virtual") {
        if (process.env.NODE_ENV === "development") {
          console.log('[useMarkerOverlay] Processing virtual car station:', stationId);
        }
      }
      
      // First handle marker existence/visibility
      if (shouldBeVisible) {
        if (!marker) {
          // Create new marker if needed
          createStationMarker(entry);
        } else if (!marker.map) {
          // Add to map if not already visible
          marker.map = googleMap;
        }
        
        // Now that we have a valid marker, update its styling
        if (entry.marker) {
          // Force update for QR/virtual car stations for reliable visibility
          const forceUpdate = viewModel.style === "qr" || viewModel.style === "virtual";
          batchUpdateMarker(entry, cameraInfo, forceUpdate);
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
    
  }, [googleMap, createStationMarker, batchUpdateMarker, createOrUpdateRouteMarker, computeMarkerViewModel, cleanupMarker]);
  
  // Debounced map update handler
  const debouncedMapUpdate = useMemo(() => {
    return debounce(() => {
      if (pendingAnimationFrameRef.current === null) {
        pendingAnimationFrameRef.current = requestAnimationFrame(() => {
          pendingAnimationFrameRef.current = null;
          handleMapUpdate();
        });
      }
    }, 16); // ~60fps
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