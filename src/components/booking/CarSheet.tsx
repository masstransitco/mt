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

  // Example: “1 car available” or “4 cars available”
  const count = availableCars.length;
  const carsSubtitle =
    count === 1 ? "1 car available" : `${count} cars available`;

  // Called when user swipes down or taps backdrop
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
      <div className="px-4 py-2">
        {/** 
         * The extra wrapper stops scroll events (wheel and touch) from bubbling 
         * up to the browser. This ensures that only the CarGrid's internal 
         * scrolling (e.g. horizontal swiping) is active.
         */}
        <div
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <CarGrid />
        </div>
      </div>
    </Sheet>
  );
}