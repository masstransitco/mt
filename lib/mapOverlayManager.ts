/**
 * Map Overlay System
 * Provides a unified interface for managing multiple overlay types
 * on a Google Map with proper initialization and disposal.
 */

/**
 * Types of overlays supported by the system
 */
export type OverlayType = 'marker' | 'three' | 'circle' | 'walking' | 'route';

/**
 * Base interface for all map overlays
 */
export interface MapOverlay {
  /**
   * Type identifier for this overlay
   */
  type: OverlayType;
  
  /**
   * Initialize the overlay with a map instance
   * @param map Google Maps map instance
   */
  initialize(map: google.maps.Map): void;
  
  /**
   * Update the overlay with new options
   * @param options Options specific to this overlay type
   */
  update(options: any): void;
  
  /**
   * Set the visibility of the overlay
   * @param visible Whether the overlay should be visible
   */
  setVisible(visible: boolean): void;
  
  /**
   * Clean up resources used by this overlay
   */
  dispose(): void;
}

/**
 * Central manager for all map overlays
 */
export class MapOverlayManager {
  /**
   * Map of overlay IDs to overlay instances
   */
  private overlays: Map<string, MapOverlay> = new Map();
  
  /**
   * Current Google Maps instance
   */
  private map: google.maps.Map | null = null;
  
  /**
   * Set the Google Maps instance
   * @param map Google Maps instance
   */
  setMap(map: google.maps.Map | null): void {
    if (this.map === map) return;
    
    this.map = map;
    
    // Reinitialize all overlays with the new map
    if (map) {
      this.overlays.forEach(overlay => overlay.initialize(map));
    }
  }
  
  /**
   * Register a new overlay
   * @param id Unique identifier for the overlay
   * @param overlay Overlay instance to register
   */
  register(id: string, overlay: MapOverlay): void {
    // Clean up existing overlay with the same ID if it exists
    if (this.overlays.has(id)) {
      this.overlays.get(id)?.dispose();
    }
    
    // Store the new overlay
    this.overlays.set(id, overlay);
    
    // Initialize if we have a map
    if (this.map) {
      overlay.initialize(this.map);
    }
  }
  
  /**
   * Get an overlay by ID with type casting
   * @param id Overlay ID
   * @returns The overlay instance or undefined if not found
   */
  getOverlay<T extends MapOverlay>(id: string): T | undefined {
    return this.overlays.get(id) as T;
  }
  
  /**
   * Update an overlay with new options
   * @param id Overlay ID
   * @param options Options specific to the overlay type
   */
  updateOverlay(id: string, options: any): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.update(options);
    } else {
      console.warn(`MapOverlayManager: Cannot update non-existent overlay with ID ${id}`);
    }
  }
  
  /**
   * Remove and dispose an overlay
   * @param id Overlay ID
   */
  removeOverlay(id: string): void {
    if (this.overlays.has(id)) {
      // Dispose the overlay
      this.overlays.get(id)?.dispose();
      // Remove from tracked overlays
      this.overlays.delete(id);
    }
  }
  
  /**
   * Set visibility for a specific overlay
   * @param id Overlay ID
   * @param visible Whether the overlay should be visible
   */
  setOverlayVisible(id: string, visible: boolean): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.setVisible(visible);
    }
  }
  
  /**
   * Set visibility for all overlays of a specific type
   * @param type Overlay type
   * @param visible Whether the overlays should be visible
   */
  setTypeVisible(type: OverlayType, visible: boolean): void {
    this.overlays.forEach(overlay => {
      if (overlay.type === type) {
        overlay.setVisible(visible);
      }
    });
  }
  
  /**
   * Clean up all overlays
   */
  disposeAll(): void {
    this.overlays.forEach(overlay => overlay.dispose());
    this.overlays.clear();
    this.map = null;
  }
  
  /**
   * Get all overlay IDs of a specific type
   * @param type Overlay type
   * @returns Array of overlay IDs
   */
  getOverlayIdsByType(type: OverlayType): string[] {
    const ids: string[] = [];
    this.overlays.forEach((overlay, id) => {
      if (overlay.type === type) {
        ids.push(id);
      }
    });
    return ids;
  }
}

/**
 * Singleton instance of the map overlay manager
 */
const mapOverlayManager = new MapOverlayManager();
export default mapOverlayManager;