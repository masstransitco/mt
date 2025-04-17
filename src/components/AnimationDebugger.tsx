import { useAnimationState } from '@/hooks/useAnimationState';
import { AnimationPriority } from '@/lib/animationStateManager';

/**
 * Animation debugger component that shows all active animations
 * Only displayed in development environment
 */
export function AnimationDebugger() {
  const { activeAnimations, isUIBlocked } = useAnimationState();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  // Get priority level as string for display
  const getPriorityName = (priority: AnimationPriority): string => {
    switch (priority) {
      case AnimationPriority.LOW:
        return 'Low';
      case AnimationPriority.MEDIUM:
        return 'Medium';
      case AnimationPriority.HIGH:
        return 'High';
      case AnimationPriority.CRITICAL:
        return 'Critical';
      default:
        return `Unknown (${priority})`;
    }
  };
  
  return (
    <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs max-w-xs overflow-auto max-h-40 z-50">
      <div>UI Blocked: {isUIBlocked() ? 'Yes' : 'No'}</div>
      <div>Active animations: {activeAnimations.length}</div>
      {activeAnimations.map(anim => (
        <div key={anim.id} className="mt-1 border-t border-gray-700 pt-1">
          <div>Type: {anim.type}</div>
          <div>Target: {anim.targetId || 'none'}</div>
          <div>Progress: {Math.round(anim.progress * 100)}%</div>
          <div>Priority: {getPriorityName(anim.priority)}</div>
          <div>Blocking: {anim.isBlocking ? 'Yes' : 'No'}</div>
          <div>Interruptible: {anim.canInterrupt ? 'Yes' : 'No'}</div>
        </div>
      ))}
    </div>
  );
}