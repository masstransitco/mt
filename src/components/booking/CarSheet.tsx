'use client';

import React from 'react';
import { useAppSelector } from '@/store/store';
import { selectAllCars } from '@/store/carSlice';
import { selectSelectedCarId } from '@/store/userSlice';
import Sheet from '@/components/ui/sheet';
import CarGrid from '@/components/booking/CarGrid';

interface CarSheetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function CarSheet({ isOpen, onToggle }: CarSheetProps) {
  // Always call hooks unconditionally
  const cars = useAppSelector(selectAllCars);
  const selectedCarId = useAppSelector(selectSelectedCarId);

  return (
    <Sheet
      isOpen={isOpen}
      onToggle={onToggle}
      title="Available Cars"
      count={cars.length}
    >
      <div className="px-4 py-2">
        {selectedCarId ? (
          <p className="text-sm text-muted-foreground mb-4">
            Selected car #{selectedCarId}. Select a charging station to continue.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            Select a car to begin booking.
          </p>
        )}
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
