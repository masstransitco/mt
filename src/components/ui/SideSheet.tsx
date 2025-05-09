import React, { useEffect, useRef } from 'react';

interface SideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'default' | 'full';
}

export default function SideSheet({
  isOpen,
  onClose,
  children,
  size = 'full', // default to full screen
}: SideSheetProps) {
  // 1. Use an effect that locks/unlocks the body scroll
  useEffect(() => {
    if (isOpen) {
      // Lock the page scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Unlock
      document.body.style.overflow = '';
    }

    // On unmount or if isOpen toggles again, revert to normal
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div
      className={`
        fixed inset-0 z-[10000] flex
        transition-opacity
        ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Backdrop (click to close) */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Side panel (slides from the right) */}
      <div
        className={`
          absolute top-0 bottom-0 right-0
          bg-card text-foreground
          shadow-xl transform transition-transform duration-300 ease-out
          ${size === 'full' ? 'w-full' : 'w-[85vw]'}
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Content Area */}
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}