"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "react-hot-toast"
import { useAppSelector, useAppDispatch, store } from "@/store/store"
import { selectStationsWithDistance, type StationFeature } from "@/store/stationsSlice"
import { selectStations3D } from "@/store/stations3DSlice"
import { DEFAULT_ZOOM, MARKER_POST_MIN_ZOOM, MARKER_POST_MAX_ZOOM } from "@/constants/map"
import { debounce, throttle } from "lodash"

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

  recycleCollapsedMarker(element: HTMLElement): void {
    if (this.collapsedMarkers.length < this.maxPoolSize) {
      // Reset any state or classes
      element.className = 'collapsed-view';
      element.textContent = "⚑";
      // Clear any event listeners
      const newElement = element.cloneNode(true) as HTMLElement;
      this.collapsedMarkers.push(newElement);
    }
  }

  recycleExpandedMarker(element: HTMLElement): void {
    if (this.expandedMarkers.length < this.maxPoolSize) {
      // Reset any state or classes
      element.className = 'expanded-view';
      // Clear any event listeners
      const newElement = element.cloneNode(true) as HTMLElement;
      this.expandedMarkers.push(newElement);
    }
  }

  private createCollapsedMarker(): HTMLElement {
    const collapsedDiv = document.createElement("div");
    collapsedDiv.classList.add("collapsed-view");
    collapsedDiv.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1C1C1E, #2C2C2E);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #F2F2F7;
      font-size: 14px;
      border: 1.5px solid #505156;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: auto;
      transform-origin: center;
      will-change: transform, border-color, box-shadow;
      transition: transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    `;
    collapsedDiv.textContent = "⚑";
    return collapsedDiv;
  }

  private createExpandedMarker(): HTMLElement {
    const expandedDiv = document.createElement("div");
    expandedDiv.classList.add("expanded-view");
    expandedDiv.style.cssText = `
      width: 180px;
      background: linear-gradient(145deg, #1C1C1E, #2C2C2E);
      color: #F2F2F7;
      border: 1.5px solid #505156;
      border-radius: 10px;
      box-shadow: 0 6px 12px rgba(0,0,0,0.45);
      padding: 10px;
      cursor: pointer;
      pointer-events: auto;
      transform-origin: center;
      will-change: transform, border-color, box-shadow;
      transition: transform 0.18s ease, border-color 0.2s ease, box-shadow 0.25s ease;
    `;
    expandedDiv.innerHTML = `
      <div class="expanded-info-section" style="margin-bottom: 6px;"></div>
      <button class="pickup-btn" style="
        display: inline-block;
        padding: 6px 10px;
        background: #10A37F;
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 600;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.18s ease-in-out;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        width: 100%;
        letter-spacing: 0.2px;
        min-height: 30px;
      ">
        Pickup car here
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

// Marker states for virtual DOM comparison
interface MarkerState {
  expanded: boolean;
  visible: boolean;
  isForceVisible: boolean;
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

  // Keep track of current tilt and zoom
  const tiltRef = useRef(0)
  const zoomRef = useRef(DEFAULT_ZOOM)

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
      markerState?: MarkerState // Track virtual state for diffing
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

  // Memoize station states to reduce re-renders
  const stationStates = useMemo(() => {
    const result = new Map<number, {
      isForceVisible: boolean;
      isExpanded: boolean;
      isDeparture: boolean;
      isArrival: boolean;
      isListSelected: boolean;
    }>();
    
    stations.forEach(station => {
      const stationId = station.id;
      const isDeparture = stationId === departureStationId;
      const isArrival = stationId === arrivalStationId;
      const isListSelected = stationId === listSelectedStationId;
      
      result.set(stationId, {
        isForceVisible: isDeparture || isArrival || isListSelected,
        isExpanded: (bookingStep < 3) ? isDeparture : (isDeparture || isArrival),
        isDeparture,
        isArrival,
        isListSelected
      });
    });
    
    return result;
  }, [stations, bookingStep, departureStationId, arrivalStationId, listSelectedStationId]);

  // Decide if a station marker is forced visible (departure, arrival, or list selected)
  const isForceVisible = useCallback(
    (stationId: number): boolean => {
      const state = stationStates.get(stationId);
      return state?.isForceVisible || false;
    },
    [stationStates],
  )

  // Which station(s) are expanded?
  // - Step < 3: only departure station is expanded (once chosen).
  // - Step >= 3: expand both departure and arrival (if chosen).
  const isExpanded = useCallback(
    (stationId: number): boolean => {
      const state = stationStates.get(stationId);
      return state?.isExpanded || false;
    },
    [stationStates],
  )

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

  // Build DOM for each station marker, hooking up events - optimized version
  const buildMarkerContainer = useCallback(
    (station: StationFeature) => {
      const container = document.createElement("div")
      container.classList.add("marker-container")
      container.style.cssText = `
        position: relative;
        pointer-events: auto;
        transform-origin: center bottom;
        will-change: transform, opacity;
        transition: transform 0.28s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.25s ease;
        transform: scale(0);
        opacity: 1;
      `

      // Collapsed marker
      const collapsedWrapper = document.createElement("div")
      collapsedWrapper.classList.add("collapsed-wrapper")
      collapsedWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        will-change: opacity, transform;
        transition: opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `

      // Use pool for collapsed marker
      const collapsedDiv = markerPoolRef.current.getCollapsedMarker()

      // Marker click → station selection
      collapsedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation()
        handleStationClick(station.id)
      })

      // Hover effect
      collapsedDiv.addEventListener("mouseenter", () => {
        collapsedDiv.style.transform = "scale(1.1)"
        collapsedDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.6)"
      })
      collapsedDiv.addEventListener("mouseleave", () => {
        collapsedDiv.style.transform = ""
        collapsedDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)"
      })

      const collapsedPost = document.createElement("div")
      collapsedPost.style.cssText = `
        width: 2.5px;
        height: 35px;
        background: linear-gradient(to bottom, rgba(170,170,170,0.9), rgba(170,170,170,0.2));
        margin-top: 2px;
        pointer-events: none;
        will-change: height, opacity;
        transition: height 0.3s ease, opacity 0.3s ease;
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
        transition: opacity 0.25s ease-out, transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
      `

      // Use pool for expanded marker
      const expandedDiv = markerPoolRef.current.getExpandedMarker()

      // Hover effect
      expandedDiv.addEventListener("mouseenter", () => {
        expandedDiv.style.transform = "scale(1.015)"
        expandedDiv.style.boxShadow = "0 8px 20px rgba(0,0,0,0.55)"
      })
      expandedDiv.addEventListener("mouseleave", () => {
        expandedDiv.style.transform = ""
        expandedDiv.style.boxShadow = "0 6px 12px rgba(0,0,0,0.45)"
      })

      // "Pickup car here" button → only in step 2
      const pickupBtn = expandedDiv.querySelector<HTMLButtonElement>(".pickup-btn")
      if (pickupBtn) {
        pickupBtn.addEventListener("mouseenter", () => {
          pickupBtn.style.background = "#0D8C6D"
          pickupBtn.style.transform = "translateY(-1px)"
          pickupBtn.style.boxShadow = "0 3px 6px rgba(0,0,0,0.35)"
        })
        pickupBtn.addEventListener("mouseleave", () => {
          pickupBtn.style.background = "#10A37F"
          pickupBtn.style.transform = ""
          pickupBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)"
        })
        pickupBtn.addEventListener("click", (ev) => {
          ev.stopPropagation()
          import("@/lib/stationSelectionManager").then(module => {
            const stationSelectionManager = module.default;
            if (stationSelectionManager.getCurrentStep() === 2) {
              stationSelectionManager.confirmStationSelection();
              options?.onPickupClick?.(station.id) // keep for backwards compatibility
            }
          });
        })
      }

      // Clicking the expanded area also selects the station
      expandedDiv.addEventListener("click", (ev) => {
        ev.stopPropagation()
        handleStationClick(station.id)
      })

      const expandedPost = document.createElement("div")
      expandedPost.style.cssText = `
        width: 2.5px;
        height: 35px;
        background: linear-gradient(to bottom, rgba(170,170,170,0.9), rgba(170,170,170,0.2));
        margin-top: 2px;
        pointer-events: none;
        will-change: height, opacity;
        transition: height 0.3s ease, opacity 0.3s ease;
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
        expandedInfoSection: expandedDiv.querySelector<HTMLDivElement>(".expanded-info-section"),
      }
    },
    [dispatch, handleStationClick, options],
  )

  // Adjust post height based on tilt and zoom
  const computePostHeight = useCallback((baseHeight: number, tilt: number, zoom: number) => {
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
  }, [])

  // Create or update the route marker for DEPARTURE->ARRIVAL
  const createOrUpdateRouteMarker = useCallback(() => {
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
  width: 110px;
  background: linear-gradient(145deg, #1C1C1E, #2C2C2E);
  color: #FFFFFF;
  border: 1.5px solid #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.45);
  padding: 6px;
  text-align: center;
  pointer-events: auto;
  font-size: 14px;
  font-weight: 600;
  cursor: default;
  transition: transform 0.2s ease;
  letter-spacing: 0.2px;
`
      boxDiv.innerHTML = `${driveMins} mins drive`

      const postDiv = document.createElement("div")
      postDiv.classList.add("route-post")
      postDiv.style.cssText = `
        width: 2.5px;
        height: 35px;
        background: linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.2));
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
      if (post) {
        const newHeight = computePostHeight(28, tiltRef.current, zoomRef.current)
        post.style.height = `${newHeight}px`
      }
    }
  }, [googleMap, bookingRoute, bookingStep, arrivalStationId, computePostHeight])

  // Build candidate station list once and populate spatial index
  const initializeCandidateStations = useCallback(() => {
    if (!candidateStationsRef.current.length) {
      const stationByObjectId = new Map<number, StationFeature>()
      stations.forEach((st) => {
        const objId = st.properties.ObjectId
        if (typeof objId === "number") {
          stationByObjectId.set(objId, st)
        }
      })

      const candidateList: typeof candidateStationsRef.current = []
      
      // Clear spatial index before rebuilding
      spatialIndexRef.current.clear();
      
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

      candidateStationsRef.current = candidateList
    }
  }, [stations, buildings3D])

  // Create an AdvancedMarker for a station - now with state tracking
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

      const { AdvancedMarkerElement } = window.google.maps.marker
      entry.marker = new AdvancedMarkerElement({
        position: entry.position,
        collisionBehavior: "OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any,
        gmpClickable: true,
        content: container,
        map: googleMap,
      })
      ;(entry.marker as any)._refs = entry.refs
      ;(entry.marker as any)._stationData = entry.stationData

      // Initialize marker state for diffing
      const isDeparture = entry.stationId === departureStationId;
      const isArrival = entry.stationId === arrivalStationId;
      const isListSelected = entry.stationId === listSelectedStationId;
      
      entry.markerState = {
        expanded: false,
        visible: true,
        isForceVisible: isDeparture || isArrival || isListSelected,
        isDeparture,
        isArrival,
        isListSelected,
        postHeight: 0,
        address: entry.stationData?.properties.Address || "",
        place: entry.stationData?.properties.Place || "",
        pickupMins: null,
        showPickupBtn: bookingStep === 2
      };

      // Animate in - use requestAnimationFrame for better performance
      container.style.transitionDelay = `${Math.random() * 150}ms` // Reduced from 300ms
      requestAnimationFrame(() => {
        container.style.transform = "scale(1)"
      })
    },
    [googleMap, buildMarkerContainer, departureStationId, arrivalStationId, listSelectedStationId, bookingStep],
  )

  // Batch update markers - new implementation that uses virtual DOM pattern
  const batchUpdateMarker = useCallback((entry: (typeof candidateStationsRef.current)[number], forceUpdate = false) => {
    if (!entry.marker || !entry.refs || !entry.stationData) return;
    
    const station = entry.stationData;
    const { marker, refs } = entry;
    
    // Calculate new state
    const isDeparture = station.id === departureStationId;
    const isArrival = station.id === arrivalStationId;
    const isListSelected = station.id === listSelectedStationId;
    const forceVis = isForceVisible(station.id);
    const currentTilt = tiltRef.current;
    const currentZoom = zoomRef.current;
    const expanded = isExpanded(station.id) && currentZoom >= MARKER_POST_MIN_ZOOM;
    const newPostHeight = computePostHeight(35, currentTilt, currentZoom);
    const showPosts = newPostHeight > 4 ? "1" : "0";
    
    // New marker state
    const newState: MarkerState = {
      expanded,
      visible: true,
      isForceVisible: forceVis,
      isDeparture,
      isArrival,
      isListSelected,
      postHeight: newPostHeight,
      address: station.properties.Address || "No address available",
      place: station.properties.Place || `Station ${station.id}`,
      pickupMins: isDeparture ? pickupMins : null,
      showPickupBtn: bookingStep === 2
    };
    
    // Compare with previous state
    const prevState = entry.markerState;
    if (!forceUpdate && prevState && 
        prevState.expanded === newState.expanded &&
        prevState.isForceVisible === newState.isForceVisible &&
        prevState.isDeparture === newState.isDeparture &&
        prevState.isArrival === newState.isArrival &&
        prevState.isListSelected === newState.isListSelected &&
        Math.abs(prevState.postHeight - newState.postHeight) < 0.5 &&
        prevState.showPickupBtn === newState.showPickupBtn &&
        prevState.pickupMins === newState.pickupMins) {
      // No significant changes - skip update
      return;
    }
    
    // Update state reference
    entry.markerState = newState;
    
    // Update marker collision behavior based on importance
    marker.collisionBehavior = forceVis ? ("REQUIRED" as any) : ("OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any);
    
    if (marker.element) {
      marker.element.style.zIndex = forceVis ? "9999" : "1";
    }
    
    // Update visibility of expanded/collapsed views
    if (expanded) {
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
    refs.collapsedPost.style.height = `${newPostHeight}px`;
    refs.collapsedPost.style.opacity = showPosts;
    refs.expandedPost.style.height = `${newPostHeight}px`;
    refs.expandedPost.style.opacity = showPosts;
    
    // Update pickup button visibility
    if (refs.pickupBtn) {
      refs.pickupBtn.style.display = bookingStep === 2 ? "inline-block" : "none";
    }
    
    // Update styling for selected stations
    const borderColor = isDeparture ? "#10A37F" : isArrival ? "#276EF1" : isListSelected ? "#FFFFFF" : "#505156";
    
    // Collapsed style with special handling for selected stations
    refs.collapsedDiv.style.borderColor = borderColor;
    
    // Special styling for important stations
    if (isDeparture || isArrival || isListSelected) {
      const glowColor = isDeparture 
        ? "rgba(16, 163, 127, 0.5)" 
        : isArrival 
          ? "rgba(39, 110, 241, 0.5)" 
          : "rgba(255, 255, 255, 0.7)";
      
      const borderWidth = currentZoom < MARKER_POST_MIN_ZOOM ? "3px" : "1.5px";
      refs.collapsedDiv.style.borderWidth = borderWidth;
      refs.collapsedDiv.style.boxShadow = `0 2px 8px rgba(0,0,0,0.5), 0 0 12px ${glowColor}`;
      
      if (isListSelected && !isDeparture && !isArrival) {
        refs.collapsedDiv.style.border = `2px solid #FFFFFF`;
      }
    } else {
      refs.collapsedDiv.style.borderWidth = "1.5px";
      refs.collapsedDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
    }
    
    // Expanded style updates
    refs.expandedDiv.style.borderColor = borderColor;
    if (isDeparture || isArrival || isListSelected) {
      const glowColor = isDeparture 
        ? "rgba(16, 163, 127, 0.5)" 
        : isArrival 
          ? "rgba(39, 110, 241, 0.5)" 
          : "rgba(255, 255, 255, 0.7)";
      refs.expandedDiv.style.boxShadow = `0 8px 16px rgba(0,0,0,0.5), 0 0 16px ${glowColor}`;
      
      if (isListSelected && !isDeparture && !isArrival) {
        refs.expandedDiv.style.border = `2px solid #FFFFFF`;
      }
    } else {
      refs.expandedDiv.style.boxShadow = "0 8px 16px rgba(0,0,0,0.5)";
    }
    
    // Update info section content
    if (!refs.expandedInfoSection) return;
    
    if (isDeparture && bookingStep >= 3 && pickupMins !== null) {
      refs.expandedInfoSection.innerHTML = `
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 3px; color: #10A37F; letter-spacing: 0.1px;">
          Pickup in ${pickupMins} minutes
        </div>
        <div style="font-size: 13px; opacity: 0.85; line-height: 1.3;">
          ${station.properties.Address || "No address available"}
        </div>
      `;
    } else {
      const placeName = station.properties.Place || `Station ${station.id}`;
      const address = station.properties.Address || "No address available";
      const titleColor = isDeparture ? "#10A37F" : isArrival ? "#276EF1" : "#F2F2F7";
      refs.expandedInfoSection.innerHTML = `
        <div style="font-size: 15px; font-weight: 600; margin-bottom: 3px; color: ${titleColor}; letter-spacing: 0.1px;">
          ${placeName}
        </div>
        <div style="font-size: 13px; opacity: 0.85; line-height: 1.3;">
          ${address}
        </div>
      `;
    }
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    pickupMins,
    isForceVisible,
    isExpanded,
    computePostHeight,
    listSelectedStationId
  ]);

  // Batch update function to be used with requestAnimationFrame
  const performBatchedMarkerUpdates = useCallback(() => {
    pendingAnimationFrameRef.current = null;
    
    // First pass: update all visible markers
    candidateStationsRef.current.forEach(entry => {
      if (entry.marker && entry.marker.map) {
        batchUpdateMarker(entry);
      }
    });
    
    // Update route marker
    createOrUpdateRouteMarker();
  }, [batchUpdateMarker, createOrUpdateRouteMarker]);

  // Debounced trigger for marker updates
  const debouncedRefreshMarkers = useMemo(() => {
    return debounce(() => {
      if (pendingAnimationFrameRef.current === null) {
        pendingAnimationFrameRef.current = requestAnimationFrame(performBatchedMarkerUpdates);
      }
    }, 16); // ~60fps
  }, [performBatchedMarkerUpdates]);

  // The function that handles map bounds changes (which markers to add/remove)
  const handleMapBoundsChange = useCallback(() => {
    if (!googleMap) return;
    const bounds = googleMap.getBounds();
    if (!bounds) return;
    
    // Use spatial index for efficient lookup of potentially visible stations
    const visibleStationIds = spatialIndexRef.current.getVisibleStations(bounds);
    
    candidateStationsRef.current.forEach((entry) => {
      const { stationId, position, marker } = entry;
      
      // Always show important stations regardless of bounds
      if (isForceVisible(stationId)) {
        if (!marker) {
          createStationMarker(entry);
        } else if (!marker.map) {
          marker.map = googleMap;
        }
        return;
      }
      
      // Is the station visible according to spatial index?
      const isVisible = visibleStationIds.includes(stationId);
      
      if (isVisible) {
        if (!marker) {
          createStationMarker(entry);
        } else if (!marker.map) {
          marker.map = googleMap;
        }
      } else {
        // Out of view → remove
        if (marker?.map) {
          marker.map = null;
        }
      }
    });
    
    // Schedule a batched update of marker styles
    debouncedRefreshMarkers();
  }, [googleMap, isForceVisible, createStationMarker, debouncedRefreshMarkers]);

  // Tilt change → schedule marker updates
  const updateMarkerTilt = useCallback(
    (newTilt: number) => {
      tiltRef.current = newTilt;
      options?.onTiltChange?.(newTilt);
      debouncedRefreshMarkers();
    },
    [options, debouncedRefreshMarkers],
  );
  
  // Zoom change → schedule marker updates
  const updateMarkerZoom = useCallback(
    (newZoom: number) => {
      zoomRef.current = newZoom;
      options?.onZoomChange?.(newZoom);
      debouncedRefreshMarkers();
    },
    [options, debouncedRefreshMarkers],
  );

  // Initialize candidate stations only once
  useEffect(() => {
    initializeCandidateStations();
  }, [initializeCandidateStations]);

  // Add map bounds listener with the current handleMapBoundsChange
  useEffect(() => {
    if (!googleMap) return;
    
    // Throttle the bounds change handler for better performance
    const throttledHandler = throttle(() => {
      handleMapBoundsChange();
    }, 100);
    
    const listener = googleMap.addListener("idle", throttledHandler);
    
    // Initial update
    handleMapBoundsChange();
    
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [googleMap, handleMapBoundsChange]);

  // Re-run styling whenever booking step, route, or list selection changes
  useEffect(() => {
    debouncedRefreshMarkers();
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    listSelectedStationId,
    dispatchRoute,
    bookingRoute,
    debouncedRefreshMarkers,
  ]);

  // Cleanup: fade out on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending animation frames
      if (pendingAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pendingAnimationFrameRef.current);
        pendingAnimationFrameRef.current = null;
      }
      
      candidateStationsRef.current.forEach((entry) => {
        if (entry.marker) {
          const refs = (entry.marker as any)._refs;
          if (refs?.container) {
            refs.container.style.transform = "scale(0)";
            refs.container.style.opacity = "0";
          }
        }
      });

      if (routeMarkerRef.current) {
        const content = routeMarkerRef.current.content as HTMLElement;
        if (content) {
          content.style.transform = "scale(0)";
          content.style.opacity = "0";
        }
      }

      setTimeout(() => {
        candidateStationsRef.current.forEach((entry) => {
          if (entry.marker) {
            entry.marker.map = null;
            entry.marker = null;
          }
        });
        if (routeMarkerRef.current) {
          routeMarkerRef.current.map = null;
          routeMarkerRef.current = null;
        }
      }, 300);
    };
  }, []);

  return {
    routeMarkerRef,
    updateMarkerTilt,
    updateMarkerZoom,
  };
}