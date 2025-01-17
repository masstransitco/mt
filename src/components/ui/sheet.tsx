import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  count?: number;
  minimizedHeight?: string;
  maximizedHeight?: string;
}

const Sheet = ({
  isOpen,
  onToggle,
  children,
  className,
  title,
  count,
  minimizedHeight = 'h-32',
  maximizedHeight = 'h-[70vh]'
}: SheetProps) => {
  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out',
        isOpen ? 'h-[70vh]' : 'h-32',
        className
      )}
    >
      {isOpen ? (
        <>
          <div className="p-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{count} stations found</p>
            </div>
            <button className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground">
              Sort by
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100%-5rem)]">
            {children}
          </div>
        </>
      ) : (
        <div className="h-full flex flex-col">
          <div className="px-4 py-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          
          <div className="flex items-center justify-between px-4 pb-8">
            <div className="flex items-center gap-12">
              <button className="p-2 rounded-full hover:bg-muted/50">
                <ChevronLeft className="w-6 h-6 text-muted-foreground" />
              </button>
              <button className="p-2 rounded-full hover:bg-muted/50">
                <ChevronRight className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </button>
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-medium">
                4
              </div>
              <button className="p-2 rounded-full hover:bg-muted/50">
                <MoreHorizontal className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
            <div className="w-32 h-1 rounded-full bg-muted-foreground/25" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Sheet;
