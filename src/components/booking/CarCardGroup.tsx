// src/components/booking/CarCardGroup.tsx
"use client";

import React, { memo, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";
import { Battery, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import Car3DViewer from "./Car3DViewer";
import type { Car } from "@/types/cars";

/** A grouping of cars that share the same `model` */
interface CarGroup {
  model: string;
  cars: Car[];
}

interface CarCardGroupProps {
  group: CarGroup;
  isVisible?: boolean;
}

function CarCardGroup({ group, isVisible = true }: CarCardGroupProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // For our group, see if the "selectedCar" is within it
  const selectedCar = useMemo(() => {
    const found = group.cars.find((c) => c.id === selectedCarId);
    return found || group.cars[0]; // fallback if none selected
  }, [group.cars, selectedCarId]);

  // We treat the group as "selected" if any car in it is selected
  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId);

  // If multiple cars share the same model, they can also share the same GLB,
  // but if you prefer, you can trust the selectedCar's modelUrl:
  const modelUrl = selectedCar.modelUrl || "/cars/defaultModel.glb";

  // Handler to pick a different car from the same group
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  return (
    <motion.div
      initial={{ scale: 0.98 }}
      animate={{ scale: isGroupSelected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card 
        transition-all duration-300 border border-border/50
        ${isGroupSelected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
      `}
      style={{ width: 300 }} // fix a card width as you like
    >
      {/* Badge (e.g., "5-seater") if you want to show it on selection */}
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      {/* 3D Viewer */}
      <div className="relative w-full aspect-[3/2]">
        {isVisible && (
          <Car3DViewer
            modelUrl={modelUrl}
            imageUrl={selectedCar.image}
            interactive={isGroupSelected}
            height="100%"
            width="100%"
            isVisible
          />
        )}
      </div>

      {/* Car Details (common for the group, with a dropdown to pick the registration) */}
      <div className="p-4">
        {/* Model name (bold) */}
        <p className="font-bold text-foreground text-lg mb-1">{selectedCar.model}</p>

        {/* A simple dropdown for the group's cars by registration name */}
        <select
          className="mb-2 cursor-pointer bg-card border text-foreground"
          onChange={(e) => handleSelectCar(parseInt(e.target.value, 10))}
          value={selectedCar.id}
        >
          {group.cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Battery (if available) */}
        {typeof selectedCar.electric_battery_percentage_left === "number" && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
            <Battery className="w-4 h-4" />
            <span>{selectedCar.electric_battery_percentage_left}%</span>
          </div>
        )}

        {/* Odometer */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
          <Gauge className="w-4 h-4" />
          <span>{selectedCar.odometer} km</span>
        </div>

        {/* Year, or other details */}
        <div className="text-sm text-muted-foreground">{selectedCar.year}</div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardGroup);
