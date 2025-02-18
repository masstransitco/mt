import React from 'react';

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
  size = 'default' 
}: SideSheetProps) {
  return (
    <div
      className={`
        fixed inset-0 z-50 flex
        transition-opacity
        ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Backdrop (click anywhere in the dimmed area to close) */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Side panel */}
      <div
        className={`
          relative bg-card text-foreground h-full
          shadow-xl transform transition-transform duration-300 ease-out
          ${size === 'full' ? 'w-full' : 'w-72 max-w-full'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Content Area */}
        <div className="pt-10 h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}