"use client";

import React from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import Sheet from "@/components/ui/sheet";
import CarGrid from "@/components/booking/CarGrid";

// Optionally use Redux for minimization if desired
import { selectIsSheetMinimized, toggleSheet } from "@/store/uiSlice";

interface CarSheetProps {
  /** If true, sheet is open. If false, sheet is hidden. */
  isOpen: boolean;
  /** Optional callback if the user swipes/presses to dismiss. */
  onClose?: () => void;
}

export default function CarSheet({ isOpen, onClose }: CarSheetProps) {
  const dispatch = useAppDispatch();
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const count = availableCars.length;
  const singularOrPlural = count === 1 ? "car" : "cars";
  const countLabel = `${singularOrPlural} available for dispatch`;

  return (
    <Sheet
      isOpen={isOpen}
      title="Choose a car"
      count={count}
      countLabel={countLabel}
      /**
       * If the user drags down or clicks outside,
       * call our onClose or default to dispatch(toggleSheet())
       */
      onDismiss={() => {
        if (onClose) onClose();
        else dispatch(toggleSheet()); 
      }}
    >
      <div className="px-0 py-2">
        <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
      </div>
    </Sheet>
  );
}
