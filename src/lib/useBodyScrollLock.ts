// useBodyScrollLock.ts
import { useEffect } from "react";

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;

    // Save original overflow
    const originalOverflow = document.body.style.overflow;
    
    // Lock scroll
    document.body.style.overflow = "hidden";

    return () => {
      // Restore original
      document.body.style.overflow = originalOverflow;
    };
  }, [lock]);
}
