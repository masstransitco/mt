"use client";

import React from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import { toggleSheet } from "@/store/uiSlice";

// UI primitives
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

/**
 * Props for our CarSheety component:
 * - isOpen: controls whether the sheet is visible
 * - onToggle: optional callback if parent wants to handle toggle logic
 */
interface CarSheetyProps {
  /** Whether the sheet is shown or hidden */
  isOpen: boolean;
  /** Optional callback if parent wants to handle toggling logic */
  onToggle?: () => void;
}

export default function CarSheety({ isOpen, onToggle }: CarSheetyProps) {
  const dispatch = useAppDispatch();
  const availableCars = useAppSelector(selectAvailableForDispatch);

  // Number of available cars
  const count = availableCars.length;
  // e.g. “1 car” or “2 cars available”
  const countLabel = count === 1 ? "1 car" : `${count} cars available`;

  /**
   * If the user swipes down, clicks outside,
   * or triggers “onDismiss” on the Sheet component,
   * we either call the parent’s onToggle() or
   * fall back to dispatch(toggleSheet()) if onToggle isn’t provided.
   */
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
      title="Dispatch a car"
      count={count}
      countLabel={countLabel}
      onDismiss={handleDismiss}
    >
      {/* You can style this however you prefer */}
      <div className="px-4 py-2">
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
