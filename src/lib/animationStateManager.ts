// Animation state types
export type AnimationType = 'CAMERA_CIRCLING' | 'ROUTE_PREVIEW' | 'CURSOR_MOVEMENT';

// Animation state interface
interface AnimationState {
  isAnimating: boolean;
  type: AnimationType | null;
  targetId: number | null;
  startTime: number | null;
  expectedDuration: number | null;
}

// Create a singleton manager
class AnimationStateManager {
  private state: AnimationState = {
    isAnimating: false,
    type: null,
    targetId: null,
    startTime: null,
    expectedDuration: null
  };
  
  private listeners: Set<(state: AnimationState) => void> = new Set();
  private safetyTimeoutId: number | null = null;
  
  private static instance: AnimationStateManager;
  
  private constructor() {}
  
  public static getInstance(): AnimationStateManager {
    if (!AnimationStateManager.instance) {
      AnimationStateManager.instance = new AnimationStateManager();
    }
    return AnimationStateManager.instance;
  }
  
  public startAnimation(type: AnimationType, targetId: number, duration: number): void {
    // Clear any existing timeout
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
    
    console.log(`[AnimationStateManager] Starting ${type} animation for station ${targetId}, duration: ${duration}ms`);
    
    this.state = {
      isAnimating: true,
      type,
      targetId,
      startTime: performance.now(),
      expectedDuration: duration
    };
    
    // Safety timeout - ensure animation state is reset even if completion is never called
    this.safetyTimeoutId = window.setTimeout(() => {
      if (this.state.isAnimating && this.state.targetId === targetId) {
        console.warn(`[AnimationStateManager] Safety timeout triggered for ${type} animation of station ${targetId}`);
        this.completeAnimation();
      }
    }, duration + 1000); // Add 1 second buffer
    
    this.notifyListeners();
  }
  
  public completeAnimation(): void {
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
    
    const prevState = this.state;
    console.log(`[AnimationStateManager] Completing animation:`, 
      prevState.type ? 
      `${prevState.type} for station ${prevState.targetId}` : 
      'No active animation');
    
    this.state = {
      isAnimating: false,
      type: null,
      targetId: null,
      startTime: null,
      expectedDuration: null
    };
    
    this.notifyListeners();
  }
  
  public getState(): AnimationState {
    return {...this.state};
  }
  
  public subscribe(listener: (state: AnimationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    const currentState = {...this.state};
    this.listeners.forEach(listener => listener(currentState));
  }
}

const animationStateManager = AnimationStateManager.getInstance();

// Add a global reference for direct access in emergency cases
if (typeof window !== 'undefined') {
  (window as any).__animationStateManager = animationStateManager;
}

export default animationStateManager;