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

  // 3) If no car selected, default to first
  useEffect(() => {
    if (!selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch]);

  // Group cars by model
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

  // Determine visibility based on some UI state
  const isVisible = viewState === "showCar";

  // 4) Toggle body scroll lock (example)
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isVisible]);

  // If you only want to show the grid when isVisible, short-circuit
  if (!isVisible) {
    return null;
  }

  return (
    <div className={`transition-all duration-300 ${className}`}>
      {/**
       * Parent container for horizontal swipe:
       * - overflow-x-auto for scrolling
       * - touch-pan-x & -webkit-overflow-scrolling:touch for mobile momentum scrolling
       */}
      <div
        className="
          overflow-x-auto
          touch-pan-x
          -webkit-overflow-scrolling:touch
        "
      >
        {/**
         * Inner flex container:
         * - flex-nowrap so items do not wrap
         * - w-max to expand the container's width based on content
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

      {/** Show fallback if no cars are available */}
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
