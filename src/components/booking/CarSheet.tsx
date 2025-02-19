"use client";

import React from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import { toggleSheet } from "@/store/uiSlice";

// UI primitives
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

interface CarSheetyProps {
  /** Whether the sheet is shown or hidden */
  isOpen: boolean;
  /** Optional callback if parent wants to handle toggling logic */
  onToggle?: () => void;
}

export default function CarSheety({ isOpen, onToggle }: CarSheetyProps) {
  const dispatch = useAppDispatch();
  const availableCars = useAppSelector(selectAvailableForDispatch);

  // e.g. “1 car available” or “4 cars available”
  const count = availableCars.length;
  const carsSubtitle =
    count === 1 ? "1 car available" : `${count} cars available`;

  const handleDismiss = () => {
    if (onToggle) {
      onToggle();
    } else {
      dispatch(toggleSheet());
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onDismiss={handleDismiss}
      title="Dispatch a car"
      subtitle={carsSubtitle}
    >
      {/**
       * Sheet content area:
       * We use an extra .overflow-x-auto wrapper so CarGrid
       * can be scrolled horizontally if needed.
       */}
      <div className="px-4 py-2">
        <div className="overflow-x-auto">
          <CarGrid className="" />
        </div>
      </div>
    </Sheet>
  );
}
