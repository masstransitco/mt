"use client";

import React from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

interface CarSheetProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function CarSheet({ isOpen, onToggle }: CarSheetProps) {
  // Get only the cars available for dispatch from Redux
  const availableCars = useAppSelector(selectAvailableForDispatch);

  // Calculate how many are available
  const count = availableCars.length;
  // Decide whether to use singular or plural
  const singularOrPlural = count === 1 ? "car" : "cars";
  // Construct the final label
  const countLabel = `${singularOrPlural} available for dispatch`;

  return (
    <Sheet
      isOpen={isOpen}
      onToggle={onToggle}
      // Keep the same title or customize if needed
      title="Choose a car"
      // Provide the count of *available* cars
      count={count}
      // Provide the dynamic label
      countLabel={countLabel}
    >
      <div className="px-0 py-2">
        {/* CarGrid will display only the available cars */}
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
