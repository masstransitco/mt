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
      title="Choose a car"
      count={cars.length}
      countLabel="cars available for dispatch"
    >
      <div className="px-0 py-2">
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
