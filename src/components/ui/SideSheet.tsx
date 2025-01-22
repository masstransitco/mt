import React from 'react';
import { X } from 'lucide-react';

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
      {/* Backdrop */}
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
        {/* Optional close button */}
        <button 
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" 
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Side-Sheet Content */}
        <div className="pt-10 h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
