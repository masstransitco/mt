"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { useAppSelector } from "@/store/store"
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

// Declare google as any to avoid TypeScript errors
declare var google: any

// Development-only logging helper
const devLog = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[useMarkerOverlay] ${message}`, ...args);
  }
}

// Create template for markers (singleton pattern)
const getMarkerTemplate = (() => {
  let cachedTemplate: HTMLTemplateElement | null = null;
  
  return () => {
    if (!cachedTemplate) {
      cachedTemplate = document.createElement('template');
      
      // Set the template content
      cachedTemplate.innerHTML = `
        <div class="marker-container">
          <!-- Collapsed view -->
          <div class="marker-wrapper collapsed">
            <div class="marker-collapsed"></div>
            <div class="marker-post"></div>
          </div>
          
          <!-- Expanded view -->
          <div class="marker-wrapper expanded">
            <div class="marker-expanded">
              <!-- Info section - simplified to avoid duplication with StationDetail -->
              <div class="expanded-info-section info-section">
                <div class="info-title"></div>
                <div class="info-value"></div>
              </div>
              
              <!-- Car plate indicator for virtual stations -->
              <div class="car-plate-container"></div>
              
            </div>
            <div class="marker-post"></div>
          </div>
        </div>
      `;
    }
    
    return cachedTemplate;
  };
})();

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

// CSS class map for marker states
const MARKER_STATE_CLASSES = {
  qr: "marker-qr",
  virtual: "marker-virtual",
  departure: "marker-departure",
  arrival: "marker-arrival",
  listSelected: "marker-selected",
  normal: "marker-normal"
};

interface UseMarkerOverlayOptions {
  onPickupClick?: (stationId: number) => void
}

export function useMarkerOverlay(googleMap: google.maps.Map | null, options?: UseMarkerOverlayOptions) {
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

  // Spatial index for efficient geographic lookups
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  
  // Station "candidates" with geometry + station ID
  const stationsRef = useRef<{
    [stationId: number]: {
      position: google.maps.LatLngAltitudeLiteral,
      stationData: StationFeature,
      marker: google.maps.marker.AdvancedMarkerElement | null,
      isVirtualCarLocation?: boolean
    }
  }>({})
  
  // Single route marker for the departure->arrival route
  const routeMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

  // For the departure station, show "Pickup in X minutes"
  const pickupMins = useMemo(() => {
    if (!dispatchRoute?.duration) return null
    const drivingMins = dispatchRoute.duration / 60
    return Math.ceil(drivingMins + 15)
  }, [dispatchRoute])
  
  // Handler for station clicks - uses stationSelectionManager
  const handleStationClick = useCallback((stationId: number) => {
    import("@/lib/stationSelectionManager").then(module => {
      const stationSelectionManager = module.default;
      stationSelectionManager.selectStation(stationId, false);
    });
  }, [])

  // Create a marker element with appropriate styling for a station
  const createMarkerElement = useCallback((station: StationFeature): HTMLElement => {
    // Optimization: For bookingStep 2 and 4, create simpler marker elements for better performance
    const isOptimizedStep = bookingStep === 2 || bookingStep === 4;
    const isImportantStation = station.id === departureStationId || 
                             station.id === arrivalStationId || 
                             station.id === listSelectedStationId;
                             
    // Clone from template
    const template = getMarkerTemplate();
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const container = clone.firstElementChild as HTMLElement;
    
    // Get elements to manipulate
    const collapsedWrapper = container.querySelector('.marker-wrapper.collapsed') as HTMLElement;
    const expandedWrapper = container.querySelector('.marker-wrapper.expanded') as HTMLElement;
    const expandedInfoSection = container.querySelector('.expanded-info-section') as HTMLElement;
    const carPlateContainer = container.querySelector('.car-plate-container') as HTMLElement;
    
    // Check if this is a virtual car location
    const isVirtual = station.properties?.isVirtualCarLocation === true;
    
    // Special handling for QR scanned car markers
    if (isVirtual) {
      // Ensure the car plate container is visible and styled properly
      if (carPlateContainer) {
        carPlateContainer.style.display = 'flex';
        carPlateContainer.style.justifyContent = 'center';
        carPlateContainer.style.width = '100%';
        carPlateContainer.style.margin = '6px 0';
      }
      
      // Give a bit more room in expanded mode for QR scanned cars
      if (expandedWrapper) {
        expandedWrapper.style.width = '100%';
      }
    } else if (carPlateContainer) {
      // Hide car plate container for non-virtual stations
      carPlateContainer.style.display = 'none';
    }
    
    // Initial container visibility - IMPORTANT: this makes markers visible
    container.classList.add('visible');
    
    // Set sizing properties to ensure the container doesn't use more space than needed
    container.style.width = 'max-content';
    container.style.minWidth = '110px';
    // Use a wider max-width for virtual car stations to accommodate the license plate
    container.style.maxWidth = isVirtual ? '200px' : '180px';
    container.style.height = 'max-content';
    
    // Apply compact styling to expanded markers
    const expandedMarker = expandedWrapper.querySelector('.marker-expanded') as HTMLElement;
    if (expandedMarker) {
      expandedMarker.style.padding = '8px 6px';
      // Reduce corner radius for selected markers to make them less rounded
      const isSelected = station.id === departureStationId || 
                        station.id === arrivalStationId || 
                        station.id === listSelectedStationId;
      expandedMarker.style.borderRadius = isSelected ? '6px' : '8px';
    }
    
    // Set fixed post heights
    const posts = container.querySelectorAll('.marker-post');
    posts.forEach(post => {
      const postElement = post as HTMLElement;
      postElement.style.height = '28px';
      postElement.style.opacity = '1';
    });
    
    // Setup click handler only when needed - optimization for performance
    const collapsedMarker = container.querySelector('.marker-collapsed') as HTMLElement;
    if (collapsedMarker && (!isOptimizedStep || isImportantStation)) {
      collapsedMarker.addEventListener('click', (ev) => {
        ev.stopPropagation();
        handleStationClick(station.id);
      });
    }
    
    // Setup info for expanded view
    if (isVirtual) {
      // Add virtual station indicator
      expandedInfoSection.innerHTML = '<div class="compact-virtual-indicator">Scanned Vehicle</div>';
      container.classList.add('virtual-car');
      
      // Get the car plate container that we'll populate with the license plate
      const carPlateContainer = container.querySelector('.car-plate-container') as HTMLElement;
      if (carPlateContainer) {
        // Extract car registration from station properties
        const plateNumber = station.properties.registration || station.properties.plateNumber || '';
        const vehicleModel = station.properties.Place ? 
                            station.properties.Place.split('[')[0].trim() : 
                            'Electric Vehicle';
        
        if (plateNumber) {
          // Create a simple license plate element - static HTML version of CarPlate component
          carPlateContainer.innerHTML = `
            <div class="car-plate">
              <div class="plate-title">${vehicleModel}</div>
              <div class="plate-number">${plateNumber}</div>
            </div>
          `;
          
          // Style the car plate
          const carPlate = carPlateContainer.querySelector('.car-plate') as HTMLElement;
          if (carPlate) {
            carPlate.style.marginTop = '8px';
            carPlate.style.backgroundColor = '#FFFFFF';
            carPlate.style.color = '#000000';
            carPlate.style.borderRadius = '8px';
            carPlate.style.border = '2px solid #000000';
            carPlate.style.padding = '4px 8px';
            carPlate.style.textAlign = 'center';
            carPlate.style.fontWeight = 'bold';
            carPlate.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            
            // Style the plate title
            const plateTitle = carPlate.querySelector('.plate-title') as HTMLElement;
            if (plateTitle) {
              plateTitle.style.fontSize = '10px';
              plateTitle.style.color = '#666666';
              plateTitle.style.marginBottom = '2px';
            }
            
            // Style the plate number
            const plateNumberEl = carPlate.querySelector('.plate-number') as HTMLElement;
            if (plateNumberEl) {
              plateNumberEl.style.fontSize = '16px';
              plateNumberEl.style.fontFamily = 'monospace';
              plateNumberEl.style.letterSpacing = '1px';
            }
          }
        }
      }
    } else if (expandedInfoSection) {
      // Set basic station info for non-virtual stations
      const titleEl = expandedInfoSection.querySelector('.info-title') as HTMLElement;
      const valueEl = expandedInfoSection.querySelector('.info-value') as HTMLElement;
      
      if (titleEl) {
        titleEl.textContent = station.id === departureStationId ? 'PICKUP' : 
                             station.id === arrivalStationId ? 'ARRIVAL' : 'SELECTED';
        titleEl.style.marginBottom = '2px';
        titleEl.style.fontSize = '12px';
        titleEl.style.fontWeight = 'bold';
      }
      
      if (valueEl) {
        valueEl.textContent = station.properties.Address || (station.properties.Place || 'Station').replace(/\[.*\]/, '');
        // Allow text to wrap for better display
        valueEl.style.overflow = 'hidden';
        valueEl.style.display = 'block';
        valueEl.style.wordWrap = 'break-word';
        valueEl.style.maxHeight = '3.6em'; // Limit to ~3 lines
        valueEl.style.lineHeight = '1.2em';
        valueEl.style.marginBottom = '0'; // Remove bottom margin
        // Adjust font size based on marker state - larger for selected markers
        valueEl.style.fontSize = (station.id === departureStationId || 
                                 station.id === arrivalStationId || 
                                 station.id === listSelectedStationId) ? '13px' : '11px';
        valueEl.style.padding = '0';
      }
    }
    
    // Determine marker state for styling
    let stateClass = MARKER_STATE_CLASSES.normal;
    
    if (isVirtual && station.id === departureStationId) {
      stateClass = MARKER_STATE_CLASSES.qr;
    } else if (isVirtual) {
      stateClass = MARKER_STATE_CLASSES.virtual;
    } else if (station.id === departureStationId) {
      stateClass = MARKER_STATE_CLASSES.departure;
    } else if (station.id === arrivalStationId) {
      stateClass = MARKER_STATE_CLASSES.arrival;
    } else if (station.id === listSelectedStationId) {
      stateClass = MARKER_STATE_CLASSES.listSelected;
    }
    
    // Apply state class
    container.classList.add(stateClass);
    
    // Determine if marker should be expanded
    const isExpanded = station.id === departureStationId || 
                      station.id === arrivalStationId || 
                      station.id === listSelectedStationId ||
                      (isVirtual && station.id === departureStationId); // Always expand QR scanned car markers
    
    // Set initial visibility states
    if (isExpanded) {
      collapsedWrapper.classList.remove('visible');
      expandedWrapper.classList.add('visible');
      expandedWrapper.style.display = 'flex';
      // Tighten spacing in expanded wrapper
      expandedWrapper.style.gap = '0';
      expandedWrapper.style.padding = '4px';
      // Add styles to expanded info section for tighter layout
      if (expandedInfoSection) {
        expandedInfoSection.style.marginBottom = '0';
        expandedInfoSection.style.paddingBottom = '0';
      }
    } else {
      collapsedWrapper.classList.add('visible');
      expandedWrapper.classList.remove('visible');
      expandedWrapper.style.display = 'none';
    }
    
    return container;
  }, [departureStationId, arrivalStationId, listSelectedStationId, bookingStep, handleStationClick]);

  // Create or update a station marker
  const createOrUpdateStationMarker = useCallback((
    station: StationFeature, 
    position: google.maps.LatLngAltitudeLiteral,
    forceContentUpdate: boolean = false
  ) => {
    if (!googleMap || !window.google?.maps?.marker?.AdvancedMarkerElement) return null;
    
    const { AdvancedMarkerElement } = window.google.maps.marker;
    const stationEntry = stationsRef.current[station.id];
    const isVirtual = station.properties?.isVirtualCarLocation === true;
    const isImportant = station.id === departureStationId || 
                         station.id === arrivalStationId || 
                         station.id === listSelectedStationId || 
                         isVirtual;
    
    // Determine collision behavior based on importance
    const collisionBehavior = isImportant
      ? "REQUIRED" as any
      : "OPTIONAL_AND_HIDES_LOWER_PRIORITY" as any;
    
    if (!stationEntry || !stationEntry.marker) {
      // Create new marker
      const markerElement = createMarkerElement(station);
      
      const marker = new AdvancedMarkerElement({
        position,
        collisionBehavior,
        gmpClickable: true,
        content: markerElement,
        map: googleMap,
      });
      
      // Store reference
      stationsRef.current[station.id] = {
        position,
        stationData: station,
        marker,
        isVirtualCarLocation: isVirtual
      };
      
      return marker;
    } else {
      // Update existing marker
      const marker = stationEntry.marker;
      
      // Update position if needed
      if (marker.position && 
          (marker.position.lat !== position.lat || 
           marker.position.lng !== position.lng || 
           ('altitude' in marker.position && 'altitude' in position && 
            marker.position.altitude !== position.altitude))) {
        marker.position = position;
      }
      
      // Update collision behavior if needed
      if (marker.collisionBehavior !== collisionBehavior) {
        marker.collisionBehavior = collisionBehavior;
      }
      
      // OPTIMIZATION: Only update content when:
      // 1. It's a new marker (not on map yet)
      // 2. Force content update is requested (for selection state changes)
      // 3. It's an important marker in optimized steps
      const needsContentUpdate = 
        // In any step, if this is the first time showing marker
        !marker.map || 
        // Force content update (for selection state changes)
        forceContentUpdate ||
        // In optimized steps, only update important stations when selection states change
        ((bookingStep !== 2 && bookingStep !== 4) && 
         (isImportant && 
          (station.id === departureStationId || 
           station.id === arrivalStationId || 
           station.id === listSelectedStationId)));
      
      if (needsContentUpdate) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[useMarkerOverlay] Updating content for station ${station.id} (important: ${isImportant}, force: ${forceContentUpdate})`);
        }
        // Update content if needed - create new element
        const markerElement = createMarkerElement(station);
        marker.content = markerElement;
      } else if (process.env.NODE_ENV === "development") {
        console.log(`[useMarkerOverlay] Skipping content update for station ${station.id} in step ${bookingStep}`);
      }
      
      // Ensure it's on the map
      if (!marker.map) {
        marker.map = googleMap;
      }
      
      return marker;
    }
  }, [googleMap, createMarkerElement, departureStationId, arrivalStationId, listSelectedStationId, bookingStep]);

  // Create or update the route marker
  const createOrUpdateRouteMarker = useCallback(() => {
    if (!googleMap || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

    // Adding debug log to track route marker updates
    const hasRoute = bookingRoute?.polyline && bookingRoute.duration;
    const showMarker = bookingStep === 4 && arrivalStationId != null && hasRoute;
    
    if (showMarker && process.env.NODE_ENV === "development") {
      console.log(`[useMarkerOverlay] Creating/updating route marker in step ${bookingStep}`);
    }

    // Remove marker if not needed
    if (!showMarker) {
      if (routeMarkerRef.current) {
        const content = routeMarkerRef.current.content as HTMLElement;
        // Use CSS transition for fade out
        if (content) {
          content.classList.remove('route-marker-container--visible');
          content.classList.add('route-marker-container--hidden');
          
          // Remove from map after transition
          setTimeout(() => {
            if (routeMarkerRef.current) {
              routeMarkerRef.current.map = null;
              routeMarkerRef.current = null;
            }
          }, 300);
        } else {
          routeMarkerRef.current.map = null;
          routeMarkerRef.current = null;
        }
      }
      return;
    }

    // Calculate route details
    const path = decodePolyline(bookingRoute.polyline);
    if (path.length < 2) return;

    const midpoint = computeRouteMidpoint(path);
    const altitude = 15;
    const driveMins = Math.ceil(bookingRoute.duration / 60);
    const { AdvancedMarkerElement } = window.google.maps.marker;

    if (!routeMarkerRef.current) {
      // Create new marker with CSS classes
      const container = document.createElement("div");
      container.classList.add('route-marker-container', 'route-marker-container--hidden');

      const wrapper = document.createElement("div");
      wrapper.classList.add('route-marker-wrapper');

      const boxDiv = document.createElement("div");
      boxDiv.classList.add("route-box");
      boxDiv.innerHTML = `${driveMins} mins drive`;

      const postDiv = document.createElement("div");
      postDiv.classList.add("route-post");
      postDiv.style.height = "28px";
      postDiv.style.opacity = "1";

      wrapper.appendChild(boxDiv);
      wrapper.appendChild(postDiv);
      container.appendChild(wrapper);

      const marker = new AdvancedMarkerElement({
        map: googleMap,
        position: {
          lat: midpoint.lat,
          lng: midpoint.lng,
          altitude,
        } as google.maps.LatLngAltitudeLiteral,
        collisionBehavior: "REQUIRED" as any,
        gmpClickable: false,
        content: container,
      });

      routeMarkerRef.current = marker;

      // Trigger CSS transition with a small delay
      setTimeout(() => {
        container.classList.remove('route-marker-container--hidden');
        container.classList.add('route-marker-container--visible');
      }, 10);
    } else {
      // Update existing
      routeMarkerRef.current.position = { 
        lat: midpoint.lat, 
        lng: midpoint.lng, 
        altitude 
      } as google.maps.LatLngAltitudeLiteral;
      
      // Update text
      const content = routeMarkerRef.current.content as HTMLDivElement;
      if (content) {
        const textDiv = content.querySelector(".route-box") as HTMLDivElement;
        if (textDiv) {
          textDiv.innerHTML = `${driveMins} mins drive`;
        }
      }
    }
  }, [googleMap, bookingRoute, bookingStep, arrivalStationId]);

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

  // Update visible markers based on map bounds and state
  const updateVisibleMarkers = useCallback((forceContentUpdate: boolean = false) => {
    if (!googleMap) return;
    
    // Get current bounds
    const bounds = googleMap.getBounds();
    if (!bounds) return;
    
    // Get stations in bounds
    const visibleStationIds = spatialIndexRef.current.getVisibleStations(bounds);
    
    // Track which stations to show/hide
    const stationsToShow = new Set<number>();
    
    // Important stations are always visible
    if (departureStationId) stationsToShow.add(departureStationId);
    if (arrivalStationId) stationsToShow.add(arrivalStationId);
    if (listSelectedStationId) stationsToShow.add(listSelectedStationId);
    
    // Performance optimization: In bookingStep 2 and 4, only show essential markers
    // to reduce DOM elements and improve performance
    if (bookingStep === 2) {
      // In step 2, only show the departure station marker
      // Skip adding other stations
    } else if (bookingStep === 4) {
      // In step 4, only show departure and arrival markers (route is already handled separately)
      // Skip adding other stations
    } else {
      // In steps 1 and 3, show all stations in view
      visibleStationIds.forEach(id => stationsToShow.add(id));
    }
    
    // Also add any virtual car stations (always visible)
    Object.entries(stationsRef.current).forEach(([id, data]) => {
      if (data.isVirtualCarLocation) {
        stationsToShow.add(Number(id));
      }
    });
    
    // Update each station
    let visibleMarkerCount = 0;
    Object.entries(stationsRef.current).forEach(([id, data]) => {
      const stationId = Number(id);
      const shouldBeVisible = stationsToShow.has(stationId);
      
      if (shouldBeVisible) {
        // Create or update marker - OPTIMIZATION:
        // Only force content update when selection states change, not on map movement
        if (data.stationData) {
          createOrUpdateStationMarker(data.stationData, data.position, forceContentUpdate);
          visibleMarkerCount++;
        }
      } else if (data.marker) {
        // Hide marker
        data.marker.map = null;
      }
    });
    
    if (process.env.NODE_ENV === "development") {
      // Only log in development for performance
      console.log(`[useMarkerOverlay] Step ${bookingStep}: Showing ${visibleMarkerCount} markers (of ${Object.keys(stationsRef.current).length} total), forceContentUpdate: ${forceContentUpdate}`);
    }
    
    // Update route marker
    createOrUpdateRouteMarker();
  }, [
    googleMap, 
    departureStationId, 
    arrivalStationId, 
    listSelectedStationId,
    bookingStep,
    createOrUpdateStationMarker, 
    createOrUpdateRouteMarker
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
      if (process.env.NODE_ENV === "development") {
        console.log(`[useMarkerOverlay] Attaching map idle listener in step ${bookingStep}`);
      }
      // OPTIMIZATION: Do not force content update on map movement
      idleListener = googleMap.addListener("idle", () => updateVisibleMarkers(false));
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[useMarkerOverlay] No idle listener needed in step ${bookingStep}`);
    }
    
    // Initial update - always needed
    updateVisibleMarkers(true);
    
    return () => {
      if (idleListener) {
        google.maps.event.removeListener(idleListener);
      }
    };
  }, [googleMap, updateVisibleMarkers, bookingStep]);

  // Update markers when state changes - with optimization to avoid forcing updates unnecessarily
  const prevDepartureStationIdRef = useRef<number | null>(departureStationId);
  const prevArrivalStationIdRef = useRef<number | null>(arrivalStationId);
  const prevListSelectedStationIdRef = useRef<number | null>(listSelectedStationId);
  const prevBookingStepRef = useRef<number>(bookingStep);
  
  useEffect(() => {
    // Only force content updates when selection states actually change
    const selectionStateChanged = 
      prevDepartureStationIdRef.current !== departureStationId ||
      prevArrivalStationIdRef.current !== arrivalStationId ||
      prevListSelectedStationIdRef.current !== listSelectedStationId ||
      prevBookingStepRef.current !== bookingStep;
    
    if (selectionStateChanged) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[useMarkerOverlay] Selection state changed, forcing content update`);
      }
      updateVisibleMarkers(true);
    } else {
      // Routes changed but not selection state, just update positions without forcing content rebuild
      if (process.env.NODE_ENV === "development") {
        console.log(`[useMarkerOverlay] Updating markers without forcing content update`);
      }
      updateVisibleMarkers(false);
    }
    
    // Update prev refs for next comparison
    prevDepartureStationIdRef.current = departureStationId;
    prevArrivalStationIdRef.current = arrivalStationId;
    prevListSelectedStationIdRef.current = listSelectedStationId;
    prevBookingStepRef.current = bookingStep;
  }, [
    bookingStep,
    departureStationId,
    arrivalStationId,
    listSelectedStationId,
    dispatchRoute?.polyline,
    bookingRoute?.polyline,
    updateVisibleMarkers,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove all markers from map
      Object.values(stationsRef.current).forEach(data => {
        if (data.marker) {
          data.marker.map = null;
        }
      });
      
      // Clear route marker
      if (routeMarkerRef.current) {
        routeMarkerRef.current.map = null;
        routeMarkerRef.current = null;
      }
    };
  }, []);

  return {
    routeMarkerRef,
  };
}