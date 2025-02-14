"use client";

import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";
import { fetchCars } from "@/store/carSlice";
import { selectViewState } from "@/store/uiSlice";
import CarCard from "./CarCard";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import { fetchDispatchLocations } from "@/store/dispatchSlice";

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = "" }: CarGridProps) {
  const dispatch = useAppDispatch();

  // Ensure both cars and dispatch locations are loaded:
  useEffect(() => {
    dispatch(fetchCars());
    dispatch(fetchDispatchLocations());
  }, [dispatch]);

  // Use the custom hook which filters cars based on dispatch locations.
  const availableCars = useAvailableCarsForDispatch();

  // Which car is currently selected? (from userSlice)
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // UI: which screen are we on? (from uiSlice)
  const viewState = useAppSelector(selectViewState);

  // Log available cars when they change
  useEffect(() => {
    if (availableCars.length > 0) {
      console.log("[CarGrid] Available cars for dispatch:", availableCars);
    }
  }, [availableCars]);

  // If no car is selected, default to the first available car
  useEffect(() => {
    if (!selectedCarId && availableCars.length > 0) {
      console.log("[CarGrid] No car selected yet. Defaulting to first car:", availableCars[0]);
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, dispatch, selectedCarId]);

  // Log whenever the selectedCarId changes
  useEffect(() => {
    if (selectedCarId) {
      console.log("[CarGrid] selectedCarId changed to:", selectedCarId);
    } else {
      console.log("[CarGrid] selectedCarId is null (no car selected)");
    }
  }, [selectedCarId]);

  // Separate the selected car from the rest of the available cars
  const { selectedCar, otherCars } = useMemo(() => {
    return {
      selectedCar: availableCars.find((car) => car.id === selectedCarId),
      otherCars: availableCars.filter((car) => car.id !== selectedCarId),
    };
  }, [availableCars, selectedCarId]);

  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  // Hide/show this grid based on the current view state
  const isVisible = viewState === "showCar";

  return (
    <div
      className={`space-y-6 ${className} transition-all duration-300`}
      style={{
        display: isVisible ? "block" : "none",
        visibility: isVisible ? "visible" : "hidden",
      }}
    >
      <div className="space-y-6">
        {/* Selected Car */}
        {selectedCar && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CarCard
              car={selectedCar}
              selected={true}
              onClick={() => {}}
              isVisible={isVisible}
              size="large"
            />
          </motion.div>
        )}

        {/* Other Cars Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {otherCars.map((car) => (
              <motion.div
                key={car.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <CarCard
                  car={car}
                  selected={false}
                  onClick={() => handleSelectCar(car.id)}
                  isVisible={isVisible}
                  size="small"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Fallback when no cars match the criteria */}
        {!selectedCar && otherCars.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center rounded-2xl bg-card"
          >
            <p className="text-muted-foreground">
              No vehicles found matching your criteria.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
