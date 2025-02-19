"use client";

import React, { useEffect } from "react";
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

  // 1) Lock the entire page’s scroll when CarSheet is open
  useEffect(() => {
    if (isOpen) {
      // Disable all browser scrolling
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable browser scrolling
      document.body.style.overflow = "auto";
    }

    // Cleanup if unmounted
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  return (
    <Sheet
      isOpen={isOpen}
      onDismiss={handleDismiss}
      title="Dispatch a car"
      subtitle={carsSubtitle}
      // 2) (Optional) pass className to remove vertical overflow styling
      className="overflow-hidden" 
    >
      {/**
       * 3) Remove extra vertical or horizontal scrolling from the parent
       *    so the only place to scroll is inside the child (CarGrid).
       *    We'll just keep this wrapper minimal:
       */}
      <div className="px-4 py-2 overflow-hidden">
        <CarGrid />
      </div>
    </Sheet>
  );
}
