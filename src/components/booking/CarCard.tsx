"use client";

import React, { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Gauge, Battery, Info } from "lucide-react";
import type { Car } from "@/types/cars";
import { CarSeat } from "@/components/ui/icons/CarSeat";

// Lazy load the 3D viewer component
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-card animate-pulse rounded-2xl" />,
});

interface CarCardProps {
  car: Car;
  selected: boolean;
  onClick: () => void;
  isVisible?: boolean;
  size?: "small" | "large";
}

// Helper function to format "Last driven" time
const formatLastDriven = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return "Unknown";
  
  const lastDriven = new Date(timestamp);
  // Check if the date is valid
  if (isNaN(lastDriven.getTime())) return "Unknown";
  
  const now = new Date();
  const diffMs = now.getTime() - lastDriven.getTime();
  
  // Convert to days, hours, minutes
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days} ${days === 1 ? 'day' : 'days'}, ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}, ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
};

function CarCardComponent({
  car,
  selected,
  onClick,
  isVisible = true,
  size = "large",
}: CarCardProps) {
  const [isInViewport, setIsInViewport] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Track whether the card is in the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
    }, { threshold: 0.5 });

    const element = document.getElementById(String(car.id));
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [car.id]);

  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card onClick
    setShowInfo(!showInfo);
  };

  return (
    <motion.div
      initial={{ scale: 0.98 }}
      animate={{ scale: selected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      onClick={onClick}
      id={String(car.id)}
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

      <div className="relative w-full aspect-[16/5]">
        {isInViewport && isVisible ? (
          <Car3DViewer
            modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
            imageUrl={car.image}
            interactive={selected}
            height="100%"
            width="100%"
            isVisible={isVisible}
          />
        ) : (
          <img
            src={car.image}
            alt={car.model}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="p-4 pb-12"> {/* Added padding bottom to make room for the footer */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-col">
            <p className="font-bold text-foreground text-lg">{car.model}</p>
            <div className="mt-2 space-y-1">
              {/* Battery */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Battery className="w-4 h-4" />
                <span>{car.electric_battery_percentage_left}%</span>
              </div>
              
              {/* Odometer */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Gauge className="w-4 h-4" />
                <span>{car.odometer} km</span>
              </div>
              
              {/* Car Seat - New */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <CarSeat className="w-4 h-4 text-orange-600/70" fill="currentColor" />
                <span>1+4 seats</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-base text-foreground font-normal">{car.name}</p>
          </div>
        </div>
        
        {/* Info dialog that appears when info button is clicked */}
        {showInfo && (
          <div className="mt-2 p-3 bg-muted/20 rounded-lg border border-border/50 text-sm">
            <p className="text-muted-foreground mb-1">Total Distance: {car.odometer} km</p>
            <p className="text-muted-foreground">Year: {car.year}</p>
          </div>
        )}
      </div>
      
      {/* New Footer Component */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-card/80 backdrop-blur-sm border-t border-border/20 px-4 flex items-center justify-between">
        <button 
          onClick={toggleInfo} 
          className="p-1 rounded-full hover:bg-muted/30 transition-colors"
        >
          <Info className="w-4 h-4 text-muted-foreground" />
        </button>
        <p className="text-xs text-muted-foreground">
          Last driven: {formatLastDriven(car.location_updated)}
        </p>
      </div>
    </motion.div>
  );
}

export default memo(CarCardComponent);
