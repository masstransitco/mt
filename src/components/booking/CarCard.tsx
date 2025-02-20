"use client";

import React, { memo, useState, useEffect } from "react";
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
  const [isInViewport, setIsInViewport] = useState(false);

  // Detect when the component is in the viewport (for lazy loading of 3D model)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0.5 }
    );

    const element = document.getElementById(car.id);
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [car.id]);

  // Debug logs to track battery value processing
  console.log("Battery raw:", car.electric_battery_percentage_left);
  
  const rawBattery = car.electric_battery_percentage_left;
  const parsedBattery = typeof rawBattery === 'number' ? rawBattery : 
                        (rawBattery ? parseFloat(String(rawBattery)) : NaN);
  
  console.log("Parsed battery:", parsedBattery);
  
  const isValidBatteryValue = 
    !isNaN(parsedBattery) && parsedBattery >= 1 && parsedBattery <= 100;
  
  console.log("Is valid battery:", isValidBatteryValue);
  
  const batteryPercentage = isValidBatteryValue ? parsedBattery : 92;
  console.log("Final battery percentage:", batteryPercentage);

  return (
    <motion.div
      initial={{ scale: 0.98 }}
      animate={{ scale: selected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      onClick={onClick}
      id={car.id} // Ensure the car has an id for observation
      className={`
        relative overflow-hidden rounded-2xl bg-card cursor-pointer
        transition-all duration-300
        border border-border/50
        hover:border-border
        ${selected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
      `}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      <div className="relative w-full aspect-[3/2]">
        {/* Lazy-load Car3DViewer when in the viewport */}
        {isInViewport && isVisible && (
          <Car3DViewer
            modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
            imageUrl={car.image}
            interactive={selected}
            height="100%"
            width="100%"
            isVisible={isVisible}
          />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
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
