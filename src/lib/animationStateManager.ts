// Animation state types
export type AnimationType = 
  | 'CAMERA_CIRCLING' 
  | 'ROUTE_PREVIEW' 
  | 'MARKER_ANIMATION' 
  | 'SHEET_TRANSITION' 
  | 'THREE_MODEL_ANIMATION' 
  | 'WALKING_ROUTE_ANIMATION' 
  | 'CURSOR_MOVEMENT'
  | 'ROUTE_ANIMATION'
  | 'CURSOR_BREATHING';

// Priority level for animations (higher numbers = higher priority)
export enum AnimationPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20
}

// Animation registry entry for tracking all running animations
export interface AnimationRegistryEntry {
  id: string;
  type: AnimationType;
  priority: AnimationPriority;
  targetId: number | string | null;
  startTime: number;
  expectedDuration: number;
  progress: number;
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
  canInterrupt: boolean;
  isBlocking: boolean; // Whether this animation blocks other UI interactions
}

// Animation utility types
export interface AnimationPosition {
  lat: number;
  lng: number;
}

export interface CameraPosition {
  center: AnimationPosition;
  zoom: number;
  tilt: number;
  heading: number;
}

// Animation state interface
interface AnimationState {
  isAnimating: boolean;
  activeAnimations: AnimationRegistryEntry[];
  highestPriorityAnimation: AnimationRegistryEntry | null;
  completionTimestamp: number | null;
  showButton: boolean;
}

// Create a singleton manager
class AnimationStateManager {
  private state: AnimationState = {
    isAnimating: false,
    activeAnimations: [],
    highestPriorityAnimation: null,
    completionTimestamp: null,
    showButton: false
  };
  
  private listeners: Set<(state: AnimationState) => void> = new Set();
  private typeListeners: Map<AnimationType, Set<(entry: AnimationRegistryEntry) => void>> = new Map();
  private safetyTimeoutIds: Map<string, number> = new Map();
  private animationFrames: Map<string, number> = new Map();
  
  // Constants for determining if positions are roughly equal
  private EPSILON = {
    latLng: 0.00005, // ~5 meters
    zoom: 0.01,
    heading: 0.5,
    tilt: 0.5,
  };
  
  private static instance: AnimationStateManager;
  
  private constructor() {
    // Setup animation frame loop for progress tracking
    if (typeof window !== 'undefined') {
      this.startAnimationLoop();
    }
  }
  
  public static getInstance(): AnimationStateManager {
    if (!AnimationStateManager.instance) {
      AnimationStateManager.instance = new AnimationStateManager();
    }
    return AnimationStateManager.instance;
  }
  
  /**
   * Animation loop for tracking progress of all active animations
   */
  private startAnimationLoop(): void {
    const updateAnimations = () => {
      const now = performance.now();
      let stateChanged = false;
      
      // Update progress for all active animations
      this.state.activeAnimations.forEach((animation) => {
        const elapsed = now - animation.startTime;
        
        // Handle infinite animations differently
        if (animation.expectedDuration === Infinity) {
          // For infinite animations, we just call the progress callback
          // with the elapsed time (in seconds) as the parameter
          animation.onProgress?.(elapsed / 1000);
          
          // Notify type-specific listeners
          this.notifyTypeListeners(animation.type, animation);
          
          // Mark as changed to notify listeners
          stateChanged = true;
        } else {
          // Normal finite animation logic
          const newProgress = Math.min(1, elapsed / animation.expectedDuration);
          
          // Use a smaller threshold for smoother animations, especially for THREE.js
          if (Math.abs(newProgress - animation.progress) > 0.001) {
            animation.progress = newProgress;
            stateChanged = true;
            
            // Call progress callback if provided
            animation.onProgress?.(newProgress);
            
            // Notify type-specific listeners
            this.notifyTypeListeners(animation.type, animation);
            
            // Check if animation completed naturally
            if (newProgress >= 1) {
              this.completeAnimation(animation.id);
            }
          }
        }
      });
      
      // Notify global listeners if any animations updated
      if (stateChanged) {
        this.notifyListeners();
      }
      
      // Continue loop if we have active animations
      if (this.state.activeAnimations.length > 0) {
        requestAnimationFrame(updateAnimations);
      }
    };
    
    requestAnimationFrame(updateAnimations);
  }

  /**
   * Register a new animation
   * @param options Animation configuration
   * @returns Animation ID that can be used to reference this animation
   */
  public startAnimation(options: {
    type: AnimationType;
    targetId?: number | string | null;
    duration: number;
    priority?: AnimationPriority;
    onComplete?: () => void;
    onProgress?: (progress: number) => void;
    canInterrupt?: boolean;
    isBlocking?: boolean;
    id?: string;
  }): string {
    const {
      type,
      targetId = null,
      duration,
      priority = AnimationPriority.MEDIUM,
      onComplete,
      onProgress,
      canInterrupt = true,
      isBlocking = false,
      id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } = options;
    
    // Check for existing animations of same type that should be interrupted
    this.state.activeAnimations
      .filter(anim => anim.type === type && anim.canInterrupt)
      .forEach(anim => this.cancelAnimation(anim.id));
    
    // Clear any existing timeout for this ID
    if (this.safetyTimeoutIds.has(id)) {
      clearTimeout(this.safetyTimeoutIds.get(id)!);
      this.safetyTimeoutIds.delete(id);
    }
    
    console.log(`[AnimationStateManager] Starting ${type} animation${targetId ? ` for target ${targetId}` : ''}, duration: ${duration}ms`);
    
    // Create the new animation entry
    const newAnimation: AnimationRegistryEntry = {
      id,
      type,
      priority,
      targetId,
      startTime: performance.now(),
      expectedDuration: duration,
      progress: 0,
      onComplete,
      onProgress,
      canInterrupt,
      isBlocking
    };
    
    // Add to active animations
    this.state.activeAnimations = [...this.state.activeAnimations, newAnimation];
    
    // Update highest priority animation
    this.updateHighestPriorityAnimation();
    
    // Set overall animation state
    this.state.isAnimating = this.state.activeAnimations.length > 0;
    this.state.showButton = false;
    this.state.completionTimestamp = null;
    
    // Safety timeout - ensure animation state is reset even if completion is never called
    // Only set for non-infinite animations
    if (duration !== Infinity) {
      this.safetyTimeoutIds.set(id, window.setTimeout(() => {
        console.warn(`[AnimationStateManager] Safety timeout triggered for ${type} animation ${id}`);
        this.completeAnimation(id);
      }, duration + 2000)); // Add 2 second buffer for more reliability
    }
    
    // Ensure animation loop is running
    if (this.state.activeAnimations.length === 1) {
      this.startAnimationLoop();
    }
    
    this.notifyListeners();
    
    return id;
  }
  
  /**
   * Cancel an animation without calling its completion handler
   */
  public cancelAnimation(id: string): void {
    const animation = this.state.activeAnimations.find(a => a.id === id);
    if (!animation) return;
    
    console.log(`[AnimationStateManager] Cancelling animation: ${animation.type} (${id})`);
    
    // Clear safety timeout
    if (this.safetyTimeoutIds.has(id)) {
      clearTimeout(this.safetyTimeoutIds.get(id)!);
      this.safetyTimeoutIds.delete(id);
    }
    
    // Remove from active animations
    this.state.activeAnimations = this.state.activeAnimations.filter(a => a.id !== id);
    
    // Update highest priority animation
    this.updateHighestPriorityAnimation();
    
    // Update global animation state
    this.state.isAnimating = this.state.activeAnimations.length > 0;
    
    this.notifyListeners();
  }
  
  /**
   * Complete an animation and call its completion handler
   */
  public completeAnimation(id: string): void {
    const animation = this.state.activeAnimations.find(a => a.id === id);
    if (!animation) {
      console.warn(`[AnimationStateManager] Tried to complete non-existent animation: ${id}`);
      return;
    }
    
    // Clear safety timeout
    if (this.safetyTimeoutIds.has(id)) {
      clearTimeout(this.safetyTimeoutIds.get(id)!);
      this.safetyTimeoutIds.delete(id);
    }
    
    // Clear any animation frames
    if (this.animationFrames.has(id)) {
      cancelAnimationFrame(this.animationFrames.get(id)!);
      this.animationFrames.delete(id);
    }
    
    console.log(`[AnimationStateManager] Completing animation: ${animation.type} (${id})`);
    
    // Call completion handler if provided
    animation.onComplete?.();
    
    // Special handling for camera circling - needs button transition
    if (animation.type === 'CAMERA_CIRCLING' && animation.targetId !== null) {
      this.handleCameraCircleCompletion(animation.targetId);
    }
    
    // Remove from active animations
    this.state.activeAnimations = this.state.activeAnimations.filter(a => a.id !== id);
    
    // Update highest priority animation
    this.updateHighestPriorityAnimation();
    
    // Update global animation state
    this.state.isAnimating = this.state.activeAnimations.length > 0;
    this.state.completionTimestamp = performance.now();
    
    // Notify type-specific listeners about completion
    this.notifyTypeListeners(animation.type, {
      ...animation,
      progress: 1
    });
    
    this.notifyListeners();
  }
  
  /**
   * Special handler for camera circling completion that manages button display
   */
  private handleCameraCircleCompletion(targetId: number | string): void {
    // Set appropriate state for button display
    this.state.showButton = false; // We'll show it after a brief delay
    
    // Use requestAnimationFrame for better timing with rendering cycles
    const scheduleButtonShow = () => {
      console.log(`[AnimationStateManager] Showing button for target ${targetId}`);
      this.state.showButton = true;
      this.notifyListeners();
      
      // Final transition: reset button after it has been shown for a while
      const finalReset = () => {
        // Only reset if no new animations have started
        if (this.state.activeAnimations.length === 0) {
          this.state.showButton = false;
          console.log(`[AnimationStateManager] Reset completed for target ${targetId}`);
          this.notifyListeners();
        }
      };
      
      // Use a shorter timeout (2s instead of 3s) for better UX
      setTimeout(finalReset, 2000);
    };
    
    // Use requestAnimationFrame for better sync with rendering
    requestAnimationFrame(() => {
      setTimeout(scheduleButtonShow, 150); // Slightly shorter delay for better response
    });
  }
  
  /**
   * Update the highest priority animation based on current active animations
   */
  private updateHighestPriorityAnimation(): void {
    if (this.state.activeAnimations.length === 0) {
      this.state.highestPriorityAnimation = null;
      return;
    }
    
    // Find the animation with the highest priority
    this.state.highestPriorityAnimation = this.state.activeAnimations.reduce(
      (highest, current) => {
        if (!highest || current.priority > highest.priority) {
          return current;
        }
        return highest;
      }, 
      null as AnimationRegistryEntry | null
    );
  }
  
  /**
   * Subscribe to animation type-specific events
   */
  public subscribeToType(
    type: AnimationType,
    listener: (entry: AnimationRegistryEntry) => void
  ): () => void {
    if (!this.typeListeners.has(type)) {
      this.typeListeners.set(type, new Set());
    }
    
    this.typeListeners.get(type)!.add(listener);
    
    return () => {
      const listeners = this.typeListeners.get(type);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.typeListeners.delete(type);
        }
      }
    };
  }
  
  /**
   * Notify type-specific listeners
   */
  private notifyTypeListeners(type: AnimationType, entry: AnimationRegistryEntry): void {
    const listeners = this.typeListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(entry));
    }
  }
  
  /**
   * Check if any animations of a specific type are active
   */
  public isAnimatingType(type: AnimationType): boolean {
    return this.state.activeAnimations.some(anim => anim.type === type);
  }
  
  /**
   * Get all active animations of a specific type
   */
  public getAnimationsOfType(type: AnimationType): AnimationRegistryEntry[] {
    return this.state.activeAnimations.filter(anim => anim.type === type);
  }
  
  /**
   * Check if the UI should be blocked based on active animations
   */
  public isUIBlocked(): boolean {
    return this.state.activeAnimations.some(anim => anim.isBlocking);
  }
  
  /**
   * Get current animation state
   */
  public getState(): AnimationState {
    return {...this.state};
  }
  
  /**
   * Get a specific animation by ID
   */
  public getAnimationById(id: string): AnimationRegistryEntry | null {
    return this.state.activeAnimations.find(anim => anim.id === id) || null;
  }
  
  /**
   * Subscribe to global animation state changes
   */
  public subscribe(listener: (state: AnimationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all global listeners of state change
   */
  private notifyListeners(): void {
    const currentState = {...this.state};
    this.listeners.forEach(listener => listener(currentState));
  }
  
  // ----- Shared Animation Utility Methods -----
  
  /**
   * Linear interpolation between two numbers
   */
  public lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  /**
   * Linear interpolation between two lat/lng positions
   */
  public lerpLatLng(
    from: AnimationPosition,
    to: AnimationPosition,
    t: number
  ): AnimationPosition {
    return {
      lat: this.lerp(from.lat, to.lat, t),
      lng: this.lerp(from.lng, to.lng, t),
    };
  }
  
  /**
   * Interpolate between two camera positions
   */
  public lerpCamera(
    from: CameraPosition,
    to: CameraPosition,
    t: number
  ): CameraPosition {
    return {
      center: this.lerpLatLng(from.center, to.center, t),
      zoom: this.lerp(from.zoom, to.zoom, t),
      heading: this.lerp(from.heading, to.heading, t),
      tilt: this.lerp(from.tilt, to.tilt, t),
    };
  }
  
  /**
   * Check if two positions are roughly equal
   */
  public isLatLngEqual(a: AnimationPosition, b: AnimationPosition): boolean {
    return (
      Math.abs(a.lat - b.lat) < this.EPSILON.latLng && 
      Math.abs(a.lng - b.lng) < this.EPSILON.latLng
    );
  }
  
  /**
   * Check if two numbers are roughly equal
   */
  public isRoughlyEqual(a: number, b: number, epsilon: number): boolean {
    return Math.abs(a - b) < epsilon;
  }
  
  /**
   * Check if two camera positions are roughly equal
   */
  public isCameraEqual(a: CameraPosition, b: CameraPosition): boolean {
    return (
      this.isLatLngEqual(a.center, b.center) &&
      this.isRoughlyEqual(a.zoom, b.zoom, this.EPSILON.zoom) &&
      this.isRoughlyEqual(a.heading, b.heading, this.EPSILON.heading) &&
      this.isRoughlyEqual(a.tilt, b.tilt, this.EPSILON.tilt)
    );
  }
}

const animationStateManager = AnimationStateManager.getInstance();

// Add a global reference for direct access in emergency cases
if (typeof window !== 'undefined') {
  (window as any).__animationStateManager = animationStateManager;
}

export default animationStateManager;