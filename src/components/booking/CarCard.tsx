"use client";

import React, { memo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";

import { Battery, Gauge, Check } from "lucide-react";
import type { Car } from "@/types/cars";

// Dynamically load the 3D viewer for performance
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
  const isSmall = size === "small";

  return (
    <motion.div
      whileHover={{ y: isSmall ? -2 : -5 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card
        transition-all duration-300 w-full cursor-pointer
        ${
          selected
            ? "border-2 border-blue-500 shadow-lg"
            : "border border-border/50 hover:border-border"
        }
      `}
      onClick={onClick}
    >
      {/* Selected Label */}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500 text-white text-sm">
            <Check size={14} />
            <span>Selected</span>
          </div>
        </div>
      )}

      {/* Car visualization container */}
      <div
        className={`
          relative w-full transition-all duration-300
          ${selected ? "aspect-[5/2]" : "aspect-[3/2]"}
        `}
      >
        {isVisible && (
          <>
            {/* Always render the 3D Viewer for every card */}
            <div className="absolute inset-0 transition-opacity duration-300">
              <Car3DViewer
                modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
                imageUrl={car.image}
                interactive={selected} 
                height="100%"
                width="100%"
                isVisible={isVisible}
              />
            </div>
          </>
        )}
      </div>

      {/* Car details */}
      <div className={`p-${isSmall ? "3" : "4"}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3
              className={`font-semibold text-foreground ${
                isSmall ? "text-sm" : "text-base"
              }`}
            >
              {car.name}
            </h3>
            <div
              className={`flex items-center gap-1 ${
                isSmall ? "text-xs" : "text-sm"
              } text-muted-foreground`}
            >
              <Battery className={`${isSmall ? "w-3 h-3" : "w-4 h-4"}`} />
              <span>{car.type}</span>
            </div>
          </div>
          <div className="text-right">
            <p
              className={`font-bold text-foreground ${
                isSmall ? "text-base" : "text-lg"
              }`}
            >
              ${car.price}
            </p>
            <p
              className={`${isSmall ? "text-xs" : "text-sm"} text-muted-foreground`}
            >
              per day
            </p>
          </div>
        </div>

        {!isSmall && car.features && (
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

export default memo(CarCardComponent);
