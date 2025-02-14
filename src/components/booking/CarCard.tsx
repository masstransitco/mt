"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Check, Gauge } from "lucide-react";
import type { Car } from "@/types/cars";

// Dynamically load the 3D viewer for performance; also ensure Car3DViewer is memoized
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
      {/* "Selected" badge in top-right corner */}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white text-black text-sm">
            <Check size={14} />
            <span>Selected</span>
          </div>
        </div>
      )}

      {/* 3D Viewer container: fixed aspect ratio for uniform sizing */}
      <div className="relative w-full aspect-[3/2]">
        {isVisible && (
          <Car3DViewer
            modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
            imageUrl={car.image}
            // Only let the selected card be interactive
            interactive={selected}
            height="100%"
            width="100%"
            isVisible
          />
        )}
      </div>

      {/* Car details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          {/* Left side: Car name + Odometer */}
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {car.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {/* Odometer display (replacing battery info) */}
              <Gauge className="w-4 h-4" />
              <span>{car.odometer} km</span>
            </div>
          </div>

          {/* Right side: Model + Year */}
          <div className="text-right">
            {/* Replace price with the car.model */}
            <p className="font-bold text-foreground text-lg">{car.model}</p>
            {/* Replace "per day" with the car.year */}
            <p className="text-sm text-muted-foreground">{car.year}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardComponent);
