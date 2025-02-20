import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import dynamic from 'next/dynamic';
import TopSheet from "@/components/ui/TopSheet";

// Dynamic import for CarGrid with loading fallback
const CarGrid = dynamic(() => import("@/components/booking/CarGrid"), {
  loading: () => <div className="h-48 w-full animate-pulse bg-muted/50 rounded-lg"></div>,
  ssr: false
});

interface CarSheetProps {
  isOpen: boolean;
  onToggle?: () => void;
  className?: string;
}

export default function CarSheet({ isOpen, onToggle, className }: CarSheetProps) {
  // Avoid unnecessary renders by only subscribing when sheet is open
  const [carCount, setCarCount] = useState<number>(0);
  
  // Only select cars when the sheet is open
  useEffect(() => {
    if (isOpen) {
      const availableCars = useAppSelector(selectAvailableForDispatch);
      setCarCount(availableCars.length);
    }
  }, [isOpen]);
  
  // Memoize subtitle
  const carsSubtitle = useMemo(() => 
    carCount === 1 ? "1 car available" : `${carCount} cars available`,
    [carCount]
  );
  
  // Memoize handlers
  const handleDismiss = useCallback(() => {
    if (onToggle) {
      onToggle();
    }
  }, [onToggle]);
  
  // Use passive event listeners for better scrolling performance
  const preventPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);
  
  // Only render grid content when sheet is open
  const renderContent = isOpen && (
    <div 
      className="px-4 py-2"
      onWheel={preventPropagation} 
      onTouchMove={preventPropagation}
      style={{ overscrollBehavior: 'contain' }}
    >
      <CarGrid />
    </div>
  );
  
  return (
    <TopSheet
      isOpen={isOpen}
      onDismiss={handleDismiss}
      title="Dispatch a car"
      subtitle={carsSubtitle}
      className={className}
    >
      {renderContent}
    </TopSheet>
  );
}
