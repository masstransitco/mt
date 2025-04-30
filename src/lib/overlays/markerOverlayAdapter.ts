import { MapOverlay } from '@/lib/mapOverlayManager';
import type { StationFeature } from '@/store/stationsSlice';

/**
 * Interface for marker overlay configuration
 */
export interface MarkerOptions {
  /**
   * Callback when a marker is clicked
   */
  onPickupClick?: (stationId: number) => void;
  
  /**
   * Whether to show markers in expanded form
   */
  expandedView?: boolean;
  
  /**
   * Filter for which markers should be shown
   */
  filter?: (station: StationFeature) => boolean;
  
  /**
   * Only show important markers (departure, arrival, selected)
   */
  showOnlyImportant?: boolean;
}

/**
 * Interface for marker data
 */
interface MarkerData {
  position: google.maps.LatLngAltitudeLiteral;
  stationData: StationFeature;
  marker: google.maps.marker.AdvancedMarkerElement | null;
  isVirtualCarLocation?: boolean;
  lastUpdated?: number;
}

/**
 * Create a marker overlay adapter that implements the MapOverlay interface
 * @param options Options for the marker overlay
 * @returns MapOverlay implementation for markers
 */
export function createMarkerOverlay(options: MarkerOptions): MapOverlay {
  // Private state for the marker overlay
  let markersRef: Record<string, MarkerData> = {};
  let mapInstance: google.maps.Map | null = null;
  let spatialIndex: any = null; // We'll use a spatial index for performance
  let importantStationIds = new Set<number>();
  let customOptions = { ...options };
  let isVisible = true;
  
  // Event listeners for markers
  const markerEventListeners = new Map<number, (() => void)[]>();
  
  /**
   * CSS class map for marker states
   */
  const MARKER_STATE_CLASSES = {
    qr: "marker-qr",
    virtual: "marker-virtual",
    departure: "marker-departure",
    arrival: "marker-arrival",
    listSelected: "marker-selected",
    normal: "marker-normal"
  };
  
  /**
   * Marker state configuration
   */
  interface MarkerStateConfig {
    state: MarkerState;
    isExpanded: boolean;
    isVirtual: boolean;
    isImportant: boolean;
  }
  
  /**
   * Type for marker state to improve type safety
   */
  type MarkerState = "normal" | "departure" | "arrival" | "listSelected" | "qr" | "virtual";
  
  /**
   * Clean up event listeners for a station
   */
  function cleanupMarkerListeners(stationId: number): void {
    const listeners = markerEventListeners.get(stationId) || [];
    listeners.forEach(cleanup => cleanup());
    markerEventListeners.delete(stationId);
  }
  
  /**
   * Toggle marker expansion state
   */
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
  
  /**
   * Apply marker classes based on marker state
   */
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
  
  /**
   * Update marker content based on station and state
   */
  function updateMarkerContent(
    container: HTMLElement,
    station: StationFeature,
    stateConfig: MarkerStateConfig,
    departureStationId: number | null,
    arrivalStationId: number | null
  ): void {
    // Implementation details would go here - simplified for now
    console.log('Updating marker content for station:', station.id);
  }
  
  /**
   * The MapOverlay implementation
   */
  return {
    type: 'marker',
    
    initialize(map: google.maps.Map) {
      console.log('[MarkerOverlayAdapter] Initializing with map');
      mapInstance = map;
      
      // Implementation would initialize the spatial index and event listeners
      
      // Try to load any stations that might already be in the ref
      if (Object.keys(markersRef).length > 0) {
        // Re-add markers that already exist to this map
        Object.values(markersRef).forEach(markerData => {
          if (markerData.marker) {
            markerData.marker.map = map;
          }
        });
      }
    },
    
    update(newOptions: MarkerOptions) {
      console.log('[MarkerOverlayAdapter] Updating with new options');
      
      // Update options
      customOptions = {
        ...customOptions,
        ...newOptions
      };
      
      // Update important station IDs if needed
      // Would typically be extracted from Redux state
      
      // Update existing markers based on new options
      if (mapInstance) {
        // Implementation would update markers based on new options
      }
    },
    
    setVisible(visible: boolean) {
      console.log(`[MarkerOverlayAdapter] Setting visibility: ${visible}`);
      isVisible = visible;
      
      // Toggle visibility of all markers
      Object.values(markersRef).forEach(marker => {
        if (marker.marker) {
          marker.marker.map = visible ? mapInstance : null;
        }
      });
    },
    
    dispose() {
      console.log('[MarkerOverlayAdapter] Disposing');
      
      // Clean up all markers
      Object.entries(markersRef).forEach(([id, data]) => {
        if (data.marker) {
          data.marker.map = null;
          cleanupMarkerListeners(Number(id));
        }
      });
      
      // Reset refs
      markersRef = {};
      mapInstance = null;
      spatialIndex = null;
      importantStationIds.clear();
    }
  };
}