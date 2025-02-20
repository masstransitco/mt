"use client";

import React, { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Gauge, Battery } from "lucide-react";
import type { Car } from "@/types/cars";

// Dynamically load Car3DViewer component for each car
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-card animate-pulse rounded-2xl" />
  ),
});

interface CarCardGroupProps {
  cars: Car[];
  selectedCarId?: string;
  onSelectCar: (carId: string) => void;
  isVisible?: boolean;
}

function CarCardGroup({
  cars,
  selectedCarId,
  onSelectCar,
  isVisible = true,
}: CarCardGroupProps) {
  const [visibleCars, setVisibleCars] = useState<string[]>([]);

  // Detect which cars are in the viewport for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const newVisibleCars = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target.id);
        setVisibleCars(newVisibleCars);
      },
      { threshold: 0.5 } // Load when 50% of the card is visible
    );

    // Observe all cars in the group
    cars.forEach((car) => {
      const carElement = document.getElementById(car.id);
      if (carElement) observer.observe(carElement);
    });

    // Clean up observer on unmount
    return () => observer.disconnect();
  }, [cars]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cars.map((car) => {
        const isSelected = selectedCarId === car.id;

        // Check if the car model is visible in the viewport
        const isInViewport = visibleCars.includes(car.id);

        return (
          <motion.div
            key={car.id}
            initial={{ scale: 0.98 }}
            animate={{ scale: isSelected ? 1.0 : 0.98 }}
            transition={{ type: "tween", duration: 0.3 }}
            onClick={() => onSelectCar(car.id)}
            id={car.id} // Ensure the car has an id for observation
            className={`
              relative overflow-hidden rounded-2xl bg-card cursor-pointer
              transition-all duration-300
              border border-border/50
              hover:border-border
              ${isSelected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
            `}
          >
            {/* Selected badge */}
            {isSelected && (
              <div className="absolute top-3 right-3 z-10">
                <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
                  5-Seater
                </div>
              </div>
            )}

            {/* 3D Model */}
            <div className="relative w-full aspect-[3/2]">
              {isInViewport && isVisible && (
                <Car3DViewer
                  modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
                  imageUrl={car.image}
                  interactive={isSelected}
                  height="100%"
                  width="100%"
                  isVisible={isVisible}
                />
              )}
            </div>

            {/* Car details */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-col">
                  <p className="font-bold text-foreground text-lg">{car.model}</p>

                  {/* Battery with fallback */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Battery className="w-4 h-4" />
                    <span>{getBatteryPercentage(car)}%</span>
                  </div>

                  {/* Odometer */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Gauge className="w-4 h-4" />
                    <span>{car.odometer} km</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base text-foreground font-normal">{car.name}</p>
                  <p className="text-sm text-muted-foreground">{car.year}</p>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Function to get a valid battery percentage or fall back
function getBatteryPercentage(car: Car) {
  const rawBattery = car.electric_battery_percentage_left;
  const parsedBattery =
    typeof rawBattery === "number"
      ? rawBattery
      : rawBattery
      ? parseFloat(String(rawBattery))
      : NaN;

  return !isNaN(parsedBattery) && parsedBattery >= 1 && parsedBattery <= 100
    ? parsedBattery
    : 92;
}

export default memo(CarCardGroup);
