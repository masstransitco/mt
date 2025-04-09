// Animation state types
export type AnimationType = 'CAMERA_CIRCLING' | 'ROUTE_PREVIEW' | 'CURSOR_MOVEMENT';

// Animation state interface
interface AnimationState {
  isAnimating: boolean;
  type: AnimationType | null;
  targetId: number | null;
  startTime: number | null;
  expectedDuration: number | null;
  // Add new flags to track animation progress
  completionTimestamp: number | null;
  showButton: boolean;
}

// Create a singleton manager
class AnimationStateManager {
  private state: AnimationState = {
    isAnimating: false,
    type: null,
    targetId: null,
    startTime: null,
    expectedDuration: null,
    completionTimestamp: null,
    showButton: false
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
      expectedDuration: duration,
      completionTimestamp: null,
      showButton: false
    };
    
    // Safety timeout - ensure animation state is reset even if completion is never called
    this.safetyTimeoutId = window.setTimeout(() => {
      if (this.state.isAnimating && this.state.targetId === targetId) {
        console.warn(`[AnimationStateManager] Safety timeout triggered for ${type} animation of station ${targetId}`);
        // Force completion
        this.completeAnimation();
      }
    }, duration + 2000); // Add 2 second buffer for more reliability
    
    this.notifyListeners();
  }
  
  public completeAnimation(): void {
    if (this.safetyTimeoutId) {
      clearTimeout(this.safetyTimeoutId);
      this.safetyTimeoutId = null;
    }
    
    const prevState = this.state;
    const targetId = prevState.targetId; // Save targetId for transition
    
    console.log(`[AnimationStateManager] Completing animation:`, 
      prevState.type ? 
      `${prevState.type} for station ${targetId}` : 
      'No active animation');
    
    // First transition: stop animation but remember which station we were animating
    this.state = {
      isAnimating: false,
      type: null,
      targetId: targetId, // Keep targetId temporarily for transition
      startTime: null,
      expectedDuration: null,
      completionTimestamp: performance.now(),
      showButton: false // Still don't show button yet
    };
    
    // Notify listeners about animation completion
    this.notifyListeners();
    
    // Use requestAnimationFrame for better timing with rendering cycles
    // instead of setTimeout for smoother transitions
    let buttonShowRafId: number;
    
    const scheduleButtonShow = () => {
      if (this.state.targetId === targetId) { // Only proceed if we're still in transition for this station
        this.state = {
          ...this.state,
          showButton: true
        };
        console.log(`[AnimationStateManager] Showing button for station ${targetId}`);
        this.notifyListeners();
        
        // Final transition: reset all state after button has been shown for a while
        // Use requestAnimationFrame for better frame alignment
        let resetTimeoutId: number;
        const finalReset = () => {
          if (this.state.targetId === targetId) { // Only proceed if we haven't started a new animation
            this.state = {
              isAnimating: false,
              type: null,
              targetId: null,
              startTime: null,
              expectedDuration: null,
              completionTimestamp: null,
              showButton: false
            };
            console.log(`[AnimationStateManager] Reset completed for station ${targetId}`);
            this.notifyListeners();
          }
        };
        
        // Use a shorter timeout (2s instead of 3s) for better UX
        resetTimeoutId = window.setTimeout(finalReset, 2000);
        
        // Ensure cleanup if another animation starts before timeout completes
        const originalTargetId = targetId;
        const cleanupInterval = setInterval(() => {
          if (this.state.targetId !== originalTargetId) {
            clearTimeout(resetTimeoutId);
            clearInterval(cleanupInterval);
          }
        }, 100);
      }
    };
    
    // Use requestAnimationFrame for better sync with rendering
    buttonShowRafId = window.requestAnimationFrame(() => {
      setTimeout(scheduleButtonShow, 150); // Slightly shorter delay (150ms vs 200ms)
    });
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