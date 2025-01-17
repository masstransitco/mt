import React, { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  minimizedHeight?: string;
  maximizedHeight?: string;
}

const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  subtitle,
  headerActions,
  minimizedHeight = 'h-20',
  maximizedHeight = 'h-[70vh]'
}: SheetProps) => {
  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-xl shadow-lg transition-all duration-300 ease-in-out',
        isOpen ? maximizedHeight : minimizedHeight,
        className
      )}
    >
      <div 
        className="p-4 border-b border-border cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {title && (
              <h2 className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {subtitle && isOpen && (
              <span className="text-sm text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isOpen && headerActions}
            {isOpen ? (
              <ChevronDown className="w-6 h-6 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="overflow-y-auto h-[calc(100%-4rem)]">
          {children}
        </div>
      )}
    </div>
  );
};

export default Sheet;
