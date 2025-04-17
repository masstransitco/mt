import { useState, useEffect } from 'react';
import animationStateManager, { AnimationType, AnimationRegistryEntry } from '@/lib/animationStateManager';

/**
 * A React hook for consuming animation state in components.
 * 
 * This hook provides a React-friendly interface to the animationStateManager singleton.
 * It manages subscriptions to animation state changes and provides helper methods
 * for common animation state queries.
 * 
 * Usage examples:
 * 
 * 1. Check if any animation is running:
 *    const { isAnimating } = useAnimationState();
 *    if (isAnimating()) { ... }
 * 
 * 2. Check if a specific type of animation is running:
 *    if (isAnimating('CAMERA_CIRCLING')) { ... }
 * 
 * 3. Check if UI should be blocked by high-priority animations:
 *    const { isUIBlocked } = useAnimationState();
 *    if (!isUIBlocked()) { triggerUserInteraction(); }
 * 
 * 4. Listen for specific animation types:
 *    const { useAnimationTypeListener } = useAnimationState();
 *    useAnimationTypeListener('CAMERA_CIRCLING', (animationEntry) => {
 *      console.log(`Camera animation progress: ${animationEntry.progress}`);
 *    });
 *
 * This hook is the preferred way for React components to interact with the
 * animation system rather than using animationStateManager directly.
 */
export function useAnimationState() {
  const [state, setState] = useState({
    isAnimating: animationStateManager.getState().isAnimating,
    activeAnimations: animationStateManager.getState().activeAnimations,
    highestPriorityAnimation: animationStateManager.getState().highestPriorityAnimation,
    showButton: animationStateManager.getState().showButton
  });
  
  useEffect(() => {
    // Subscribe to global animation state changes
    const unsubscribe = animationStateManager.subscribe((newState) => {
      setState({
        isAnimating: newState.isAnimating,
        activeAnimations: newState.activeAnimations,
        highestPriorityAnimation: newState.highestPriorityAnimation,
        showButton: newState.showButton
      });
    });
    
    return unsubscribe;
  }, []);
  
  // Hook for subscribing to specific animation types
  const useAnimationTypeListener = (type: AnimationType, callback: (entry: AnimationRegistryEntry) => void) => {
    useEffect(() => {
      const unsubscribe = animationStateManager.subscribeToType(type, callback);
      return unsubscribe;
    }, [callback]);
  };
  
  return {
    // Check if any animation is running, or a specific type
    isAnimating: (type?: AnimationType) => type 
      ? state.activeAnimations.some(a => a.type === type)
      : state.isAnimating,
      
    // All active animations
    activeAnimations: state.activeAnimations,
    
    // The highest priority animation currently running
    highestPriorityAnimation: state.highestPriorityAnimation,
    
    // Whether a button should be shown (for camera circling animations)
    showButton: state.showButton,
    
    // Check if UI should be blocked based on active animations
    isUIBlocked: () => animationStateManager.isUIBlocked(),
    
    // Helper for subscribing to specific animation types
    useAnimationTypeListener,
    
    // Get animations of a specific type
    getAnimationsOfType: (type: AnimationType) => 
      state.activeAnimations.filter(anim => anim.type === type)
  };
}