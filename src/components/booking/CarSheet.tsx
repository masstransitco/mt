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

  const count = availableCars.length;
  // "4 cars available" or "1 car"
  const carsInfo = count === 1 ? "1 car available" : `${count} cars available`;

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
      /* Instead of passing `count` and `countLabel`,
         we'll just stick it in `subtitle` to avoid duplication. */
      subtitle={carsInfo}
      onDismiss={handleDismiss}
    >
      {/**
       * We add `overflow-x-auto` here so the user can
       * horizontally scroll if the CarGrid is laid out in a single row.
       */}
      <div className="px-4 py-2 overflow-x-auto">
        {/* 
          CarGrid might also need a horizontal layout if you want a
          row of cards. For example:
            .grid-flow-col .auto-cols-[250px] .gap-4
        */}
        <CarGrid className="grid grid-flow-col gap-4 auto-cols-[80%] pr-4" />
      </div>
    </Sheet>
  );
}
