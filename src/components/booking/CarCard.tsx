"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Battery, Gauge, Check } from "lucide-react";
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
  // We can unify to a fixed aspect ratio for consistent sizing
  // Starting scale: 0.98. If the card is selected, it scales to 1.0
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
        ${
          selected
            ? // White glow highlight
              "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white"
            : ""
        }
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
            isVisible={true}
          />
        )}
      </div>

      {/* Car details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-foreground text-base">
              {car.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Battery className="w-4 h-4" />
              <span>{car.type}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-foreground text-lg">${car.price}</p>
            <p className="text-sm text-muted-foreground">per day</p>
          </div>
        </div>

        {/* Optional feature details */}
        {car.features && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {car.features.range && (
              <div className="flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>{car.features.range} mi</span>
              </div>
            )}
            {car.features.charging && (
              <div className="flex items-center gap-1">
                <Battery className="w-3.5 h-3.5" />
                <span>{car.features.charging}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Wrap in React.memo for performance: re-render only if props change
export default memo(CarCardComponent);
