// Camera state types
import { throttle } from 'lodash';

interface CameraState {
  tilt: number;
  zoom: number;
  heading: number;
  center: google.maps.LatLngLiteral | null;
  lastUpdated: number;
}

// Create a singleton manager
class CameraStateManager {
  private state: CameraState = {
    tilt: 0,
    zoom: 13,
    heading: 0,
    center: null,
    lastUpdated: 0
  };
  
  private listeners: Set<(state: CameraState) => void> = new Set();
  private static instance: CameraStateManager;
  
  // Create throttled version of notifyListeners
  private notifyListenersThrottled = throttle(() => {
    const currentState = {...this.state};
    this.listeners.forEach(listener => listener(currentState));
  }, 100); // Call listeners at most once every 100ms
  
  private constructor() {}
  
  public static getInstance(): CameraStateManager {
    if (!CameraStateManager.instance) {
      CameraStateManager.instance = new CameraStateManager();
    }
    return CameraStateManager.instance;
  }
  
  public updateCameraState(camera: Partial<CameraState>): void {
    const now = performance.now();
    
    // Special handling for center property to preserve it when not explicitly provided
    // This ensures the center position is maintained when other camera properties change
    if (!camera.center && this.state.center) {
      camera.center = this.state.center;
    }
    
    // Check if state has changed significantly to avoid unnecessary updates
    if (this.hasSignificantChange(camera)) {
      // Merge changes into current state
      this.state = {
        ...this.state,
        ...camera,
        lastUpdated: now
      };
      
      // Use the throttled notification method
      this.notifyListenersThrottled();
    }
  }
  
  private hasSignificantChange(camera: Partial<CameraState>): boolean {
    return (
      !this.state.center ||
      !camera.center ||
      Math.abs((camera.zoom ?? 0) - (this.state.zoom ?? 0)) >= 0.01 ||
      Math.abs((camera.tilt ?? 0) - (this.state.tilt ?? 0)) >= 0.5 ||
      Math.abs((camera.heading ?? 0) - (this.state.heading ?? 0)) >= 0.5 ||
      !this.state.center?.lat ||
      !camera.center?.lat ||
      Math.abs((camera.center?.lat ?? 0) - (this.state.center?.lat ?? 0)) >= 0.0001 ||
      Math.abs((camera.center?.lng ?? 0) - (this.state.center?.lng ?? 0)) >= 0.0001
    );
  }
  
  public getCameraState(): CameraState {
    return {...this.state};
  }
  
  public subscribe(listener: (state: CameraState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const cameraStateManager = CameraStateManager.getInstance();

// Add a global reference for direct access in emergency cases
if (typeof window !== 'undefined') {
  (window as any).__cameraStateManager = cameraStateManager;
}

export default cameraStateManager;