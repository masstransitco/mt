"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Gauge, Battery } from "lucide-react";
import type { Car } from "@/types/cars";

const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-card animate-pulse rounded-2xl" />
  ),
});

interface CarCardProps {
  car: Car;
  selected: boolean;
  onClick: () => void;
  isVisible?: boolean;
  size?: "small" | "large";
}

function CarCardComponent({
  car,
  selected,
  onClick,
  isVisible = true,
  size = "large",
}: CarCardProps) {
  // Debug log to see exactly what the raw battery value is
  console.log("Battery raw:", car.electric_battery_percentage_left);

  // Convert to number
  const parsedBattery = Number(car.electric_battery_percentage_left);

  // Check if it's finite and within 1-100 range
  const isValidBatteryValue =
    Number.isFinite(parsedBattery) && parsedBattery >= 1 && parsedBattery <= 100;

  // If invalid, fallback to 92
  const batteryPercentage = isValidBatteryValue ? parsedBattery : 92;

  return (
    <motion.div
      initial={{ scale: 0.98 }}
      animate={{ scale: selected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl bg-card cursor-pointer
        transition-all duration-300
        border border-border/50
        hover:border-border
        ${selected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
      `}
    >
      {/* "Selected" badge in top-right corner, here replaced with "5-Seater" */}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      {/* 3D Viewer container */}
      <div className="relative w-full aspect-[3/2]">
        {isVisible && (
          <Car3DViewer
            modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
            imageUrl={car.image}
            interactive={selected}
            height="100%"
            width="100%"
            isVisible
          />
        )}
      </div>

      {/* Car details */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Left side */}
          <div className="flex flex-col">
            <p className="font-bold text-foreground text-lg">{car.model}</p>

            {/* Battery with fallback */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Battery className="w-4 h-4" />
              <span>{batteryPercentage}%</span>
            </div>

            {/* Odometer */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Gauge className="w-4 h-4" />
              <span>{car.odometer} km</span>
            </div>
          </div>

          {/* Right side */}
          <div className="text-right">
            <p className="text-base text-foreground font-normal">{car.name}</p>
            <p className="text-sm text-muted-foreground">{car.year}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardComponent);
