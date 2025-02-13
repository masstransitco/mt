"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// import { Filter } from "lucide-react"; // We'll comment out the filter usage

import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";
import { selectAllCars, fetchCars } from "@/store/carSlice";
import { selectViewState } from "@/store/uiSlice";

import CarCard from "./CarCard"; // The CarCard component

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = "" }: CarGridProps) {
  const dispatch = useAppDispatch();

  // We fetch cars from Redux store (carSlice)
  const allCars = useAppSelector(selectAllCars);

  // Which car is currently selected? (userSlice)
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // UI: which screen are we on? (uiSlice)
  const viewState = useAppSelector(selectViewState);

  // We'll keep these states in case we add them back later
  const [filterType, setFilterType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // On mount, fetch cars if needed
  useEffect(() => {
    dispatch(fetchCars());
  }, [dispatch]);

  // Log the fetched cars on mount or whenever they change
  useEffect(() => {
    if (allCars.length > 0) {
      console.log("[CarGrid] Fetched cars:", allCars);
    }
  }, [allCars]);

  // If no car is selected, default to the first available car
  useEffect(() => {
    if (!selectedCarId && allCars.length > 0) {
      console.log("[CarGrid] No car selected yet. Defaulting to first car:", allCars[0]);
      dispatch(selectCar(allCars[0].id));
    }
  }, [allCars, dispatch, selectedCarId]);

  // Log whenever the selectedCarId changes
  useEffect(() => {
    if (selectedCarId) {
      console.log("[CarGrid] selectedCarId changed to:", selectedCarId);
    } else {
      console.log("[CarGrid] selectedCarId is null (no car selected)");
    }
  }, [selectedCarId]);

  // Filter logic for the car list
  const { selectedCar, otherCars } = useMemo(() => {
    const carData = allCars;

    const filtered =
      filterType === "all"
        ? carData
        : carData.filter((car) => car.type.toLowerCase() === filterType.toLowerCase());

    return {
      selectedCar: filtered.find((car) => car.id === selectedCarId),
      otherCars: filtered.filter((car) => car.id !== selectedCarId),
    };
  }, [allCars, filterType, selectedCarId]);

  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  // Hide/show this grid based on `viewState`
  const isVisible = viewState === "showCar";

  return (
    <div
      className={`space-y-6 ${className} transition-all duration-300`}
      style={{
        display: isVisible ? "block" : "none",
        visibility: isVisible ? "visible" : "hidden",
      }}
    >
      {/* (Header with filters commented out) */}

      {/* Car grid with selected car on top */}
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

        {/* If no cars found (filtered out) */}
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
