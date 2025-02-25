"use client";
import React, { Suspense, useCallback, useState, useEffect } from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import dynamic from 'next/dynamic';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

// Dynamic import with loading state
const CarGrid = dynamic(
  () => import("@/components/booking/CarGrid"),
  { 
    ssr: false,
    loading: () => <GridSkeleton />
  }
);

interface CarSheetProps {
  isOpen: boolean;
  onToggle?: () => void;
  className?: string;
}

export default function CarSheet({ isOpen, onToggle, className }: CarSheetProps) {
  const [isContentVisible, setIsContentVisible] = useState(false);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  
  // Handle visibility with proper timing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isOpen) {
      timer = setTimeout(() => {
        setIsContentVisible(true);
      }, 300); // Wait for dialog animation
    } else {
      setIsContentVisible(false);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    onToggle?.();
  }, [onToggle]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent 
        className={`w-[80vw] max-w-none rounded-lg ${className}`} 
        onEscapeKeyDown={handleDismiss}
        onInteractOutside={handleDismiss}
      >
        <DialogHeader>
          <DialogTitle>Dispatch a car</DialogTitle>
          <DialogDescription>
            {availableCars.length} available
          </DialogDescription>
        </DialogHeader>
        
        <div 
          className="min-h-[30vh] max-h-[85vh] overflow-y-auto px-4 pb-safe"
          style={{
            overscrollBehavior: 'contain',
          }}
        >
          <Suspense fallback={<GridSkeleton />}>
            {isContentVisible && (
              <CarGrid 
                isVisible={isContentVisible}
                className="pb-4" 
              />
            )}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const GridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
    {[...Array(4)].map((_, i) => (
      <div 
        key={i} 
        className="relative h-48 bg-neutral-200 rounded-lg overflow-hidden"
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200" />
      </div>
    ))}
  </div>
);
