import React, { ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  count?: number;
}

const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  count
}: SheetProps) => {
  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out',
        isOpen ? 'h-[70vh]' : 'h-[25vh]',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div 
          className="flex items-center justify-between p-4 border-b border-border/20"
          onClick={onToggle}
        >
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{count} stations found</p>
          </div>
          <div className="flex gap-4 items-center">
            <button className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              Sort by
            </button>
            {isOpen ? (
              <ChevronDown className="w-6 h-6 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
};

export default Sheet;
