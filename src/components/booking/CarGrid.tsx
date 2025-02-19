"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { selectViewState } from "@/store/uiSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup from "./CarCardGroup";

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = "" }: CarGridProps) {
  const dispatch = useAppDispatch();

  // 1) Ensure cars & dispatch locations are loaded
  useEffect(() => {
    dispatch(fetchCars());
    dispatch(fetchDispatchLocations());
  }, [dispatch]);

  // 2) Get available cars + selected car
  const availableCars = useAvailableCarsForDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const viewState = useAppSelector(selectViewState);

  // 3) If no car is selected, default to the first available
  useEffect(() => {
    if (!selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch]);

  // 4) Group cars by model
  const groupedByModel = Object.values(
    availableCars.reduce((acc, car) => {
      const model = car.model || "Unknown Model";
      if (!acc[model]) {
        acc[model] = { model, cars: [] };
      }
      acc[model].cars.push(car);
      return acc;
    }, {} as Record<string, { model: string; cars: typeof availableCars }>)
  );

  // 5) If using a UI state to conditionally show the grid
  const isVisible = viewState === "showCar";
  if (!isVisible) {
    return null;
  }

  return (
    <div className={`transition-all duration-300 ${className}`}>
      {/** 
       * Outer container for horizontal scrolling.
       * - "touch-pan-x" + "-webkit-overflow-scrolling:touch" → 
       *   smooth mobile swipes
       */}
      <div
        className="
          overflow-x-auto
          touch-pan-x
          -webkit-overflow-scrolling:touch
        "
      >
        {/**
         * Inner container: 
         * - "flex-nowrap w-max" so items line up horizontally
         * - "gap-3" for spacing
         */}
        <div className="flex flex-nowrap w-max gap-3 py-2">
          <AnimatePresence mode="popLayout">
            {groupedByModel.map((group) => (
              <motion.div
                key={group.model}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 0.975 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <CarCardGroup group={group} isVisible={isVisible} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/**
       * If no cars were found, show fallback message
       */}
      {groupedByModel.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center rounded-2xl bg-card mt-4 mx-4"
        >
          <p className="text-muted-foreground">No vehicles found.</p>
        </motion.div>
      )}
    </div>
  );
}