"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { selectViewState } from "@/store/uiSlice";
import CarCard from "./CarCard";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";

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

  // 2) Get the cars available for dispatch + which car is selected
  const availableCars = useAvailableCarsForDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const viewState = useAppSelector(selectViewState);

  // 3) If no car selected, default to first available
  useEffect(() => {
    if (!selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch]);

  // 4) Handler to select a car
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  // 5) Show/hide this component based on UI state
  const isVisible = viewState === "showCar";

  return (
    <div
      className={`transition-all duration-300 overflow-y-auto ${className}`}
      style={{
        display: isVisible ? "block" : "none",
        visibility: isVisible ? "visible" : "hidden",
        maxHeight: "80vh",
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {availableCars.map((car) => {
            const isSelected = car.id === selectedCarId;
            return (
              <motion.div
                key={car.id}
                layout
                // Subtle fade/scale animation when cards appear or disappear
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 0.35 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <CarCard
                  car={car}
                  selected={isSelected}
                  onClick={() => handleSelectCar(car.id)}
                  isVisible={isVisible}
                  // You can remove "size" entirely if you prefer
                  size="large"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Fallback when no cars match the criteria */}
      {availableCars.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center rounded-2xl bg-card mt-4"
        >
          <p className="text-muted-foreground">
            No vehicles found matching your criteria.
          </p>
        </motion.div>
      )}
    </div>
  );
}
