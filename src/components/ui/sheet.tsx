import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal } from 'lucide-react';
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
  minimizedHeight = 'h-24', // Increased height for navigation controls
  maximizedHeight = 'h-[70vh]'
}: SheetProps) => {
  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-[var(--radius)] shadow-2xl transition-all duration-300 ease-in-out',
        isOpen ? maximizedHeight : minimizedHeight,
        className
      )}
    >
      {isOpen ? (
        <>
          <div 
            className="bottom-sheet-header"
            onClick={onToggle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {title && (
                  <h2 className="text-lg font-semibold text-foreground">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <span className="text-sm text-muted-foreground">
                    {subtitle}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {headerActions}
              </div>
            </div>
          </div>
          <div className="overflow-y-auto h-[calc(100%-4rem)]">
            {children}
          </div>
        </>
      ) : (
        // Minimized state with navigation controls
        <div className="h-full flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <ChevronLeft className="w-6 h-6 text-muted-foreground cursor-pointer" />
            <ChevronRight className="w-6 h-6 text-muted-foreground cursor-pointer" />
            <div className="flex items-center gap-4">
              <Plus className="w-10 h-10 p-2 rounded-full bg-muted text-muted-foreground cursor-pointer" />
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white">
                4
              </div>
              <MoreHorizontal className="w-6 h-6 text-muted-foreground cursor-pointer" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sheet;
