"use client";

import React from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

interface CarSheetProps {
  isOpen: boolean;
  // Remove onToggle here, since Sheet no longer uses it
  // onToggle?: () => void;  // <-- Delete this
}

export default function CarSheet({ isOpen }: CarSheetProps) {
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
      // Remove onToggle from the Sheet usage
      title="Choose a car"
      count={count}
      countLabel={countLabel}
    >
      <div className="px-0 py-2">
        {/* CarGrid will display only the available cars */}
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
