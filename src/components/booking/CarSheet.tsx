// src/components/booking/CarSheet.tsx
import React from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

interface CarSheetProps {
  isOpen: boolean;
  onToggle?: () => void;
}

export default function CarSheet({ isOpen, onToggle }: CarSheetProps) {
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const count = availableCars.length;
  const carsSubtitle = count === 1 ? "1 car available" : `${count} cars available`;

  const handleDismiss = () => {
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <Sheet isOpen={isOpen} onDismiss={handleDismiss} title="Dispatch a car" subtitle={carsSubtitle}>
      <div className="px-4 py-2">
        <div onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
          <CarGrid />
        </div>
      </div>
    </Sheet>
  );
}
