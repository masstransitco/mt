"use client";

import React, { memo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Gauge, Battery, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Info, Clock } from "lucide-react";
import type { Car } from "@/types/cars";
import { CarSeat } from "@/components/ui/icons/CarSeat";

// Fallback skeleton while the 3D viewer loads
const ViewerSkeleton = memo(() => (
  <div className="relative w-full h-full rounded-lg overflow-hidden bg-black/10 backdrop-blur-sm">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-black/5 via-black/10 to-black/5" />
  </div>
))
ViewerSkeleton.displayName = "ViewerSkeleton"

// Import the safe dynamic component instead
import { DynamicCar3DViewer } from "./CarComponents";

// Alias for backward compatibility
const Car3DViewer = DynamicCar3DViewer;

interface CarCardProps {
  car: Car;
  selected?: boolean;
  onClick?: () => void;
  isVisible?: boolean;
  isQrScanStation?: boolean;
  size?: "small" | "large";
  className?: string;
}

// Helper function to format "Last driven" time
const formatLastDriven = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return "Never driven";
  
  try {
    const lastUpdate = new Date(String(timestamp));
    // Check if date is valid
    if (isNaN(lastUpdate.getTime())) {
      return "Unknown";
    }

    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();

    // Calculate time units
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return "Just now";
    }
  } catch (error) {
    return "Unknown";
  }
};

function CarCardComponent({
  car,
  selected = false,
  onClick,
  isVisible = true,
  isQrScanStation = false,
  size = "large",
  className = "",
}: CarCardProps) {
  const [isInViewport, setIsInViewport] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  // Track whether the card is in the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
    }, { threshold: 0.3 });

    const element = document.getElementById(`car-${car.id}`);
    if (element) observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [car.id]);

  // Battery info calculation
  const { batteryPercentage, batteryIconColor, BatteryIcon } = (() => {
    const rawBattery = car.electric_battery_percentage_left;
    const parsed = rawBattery != null ? Number(rawBattery) : Number.NaN;
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90;
    let Icon = BatteryFull;
    let color = "text-green-500"; // Apple-style green
    if (percentage <= 9) {
      Icon = BatteryWarning;
      color = "text-red-500";
    } else if (percentage < 40) {
      Icon = BatteryLow;
      color = "text-orange-400";
    } else if (percentage < 80) {
      Icon = BatteryMedium;
      color = "text-lime-400";
    }
    return { batteryPercentage: percentage, batteryIconColor: color, BatteryIcon: Icon };
  })();

  // Handle info button click
  const handleInfoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card onClick
    setShowInfoPopup(prev => !prev);
    // Auto-close after 3 seconds
    if (!showInfoPopup) {
      setTimeout(() => setShowInfoPopup(false), 3000);
    }
  }, [showInfoPopup]);

  // Last driven text formatting
  const lastDrivenText = formatLastDriven(car.location_updated);

  // Calculate the content to display for scanned cars
  // For scanned cars, place more emphasis on the registration number
  const isScannedCar = isQrScanStation && car.registration;

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: selected ? 1.0 : 0.98,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick}
      id={`car-${car.id}`}
      className={`
        relative overflow-hidden rounded-xl bg-gradient-to-b from-[#1a1a1a]/95 to-[#1a1a1a]/80 text-white 
        border border-white/10 shadow-lg transition-all cursor-pointer 
        w-full backdrop-blur-sm
        ${selected ? "ring-1 ring-white/50" : ""}
        ${className}
      `}
      style={{ 
        contain: "content",
        minHeight: "200px",
        touchAction: "none" // Prevent touch events from passing through
      }}
    >
      <div className="flex flex-col h-full">
        <div className="relative w-full h-48 overflow-hidden flex-1" 
          style={{ touchAction: "none" }} 
          onClick={(e) => e.stopPropagation()} // Prevent click events from propagating to sheet
        >
            {/* Car model viewer - now full width */}
            {isInViewport && isVisible ? (
              <div 
                className="absolute inset-0 w-full h-full three-d-scene" 
                style={{ 
                  background: "transparent",
                  touchAction: "none"
                }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <Car3DViewer
                  modelUrl={car.modelUrl || "/cars/defaultModel.glb"}
                  interactive={selected}
                  height="100%"
                  width="100%"
                  isVisible={true}
                  backgroundColor="transparent"
                />
              </div>
            ) : (
              <ViewerSkeleton />
            )}
            
            {/* Registration now shown in the header bar */}
            
            {/* Header bar with model name and registration - spans full width */}
            <div className="absolute top-0 left-0 right-0 z-10 backdrop-blur-md bg-black/50 px-3 py-2 border-b border-white/10 shadow-lg flex items-center justify-between">
              <p className="font-medium text-sm leading-tight text-white">{car.model || "Unknown Model"}</p>
              {car.name && (
                <span className="text-xs text-white/70 font-medium rounded-full bg-white/10 px-2 py-0.5">
                  {car.name}
                </span>
              )}
              {car.registration && (
                <span className="text-xs bg-[#E82127] text-white font-medium rounded-full px-2 py-0.5 ml-1">
                  {car.registration}
                </span>
              )}
            </div>
            
            {/* Bottom pill indicators - positioned at bottom but above footer */}
            <div className="absolute bottom-1 left-0 right-0 z-10 px-3 flex items-center justify-center gap-3">
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-2 py-1 border border-white/20 shadow-lg">
                <BatteryIcon className={`w-3.5 h-3.5 ${batteryIconColor}`} />
                <span className="text-xs font-medium">{batteryPercentage}%</span>
              </div>
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-2 py-1 border border-white/20 shadow-lg">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs">{(batteryPercentage * 3.2).toFixed(0)} km</span>
              </div>
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-2 py-1 border border-white/20 shadow-lg">
                <CarSeat className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-xs">1+4</span>
              </div>
            </div>
          </div>

        {/* Footer Component - Overlaid at bottom of 3D scene */}
        <div className="absolute bottom-0 left-0 right-0 z-20 backdrop-blur-md bg-black/50 px-3 py-1.5 border-t border-white/10 shadow-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 relative">
            <div className="relative">
              <Clock
                className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-white transition-colors"
                onClick={handleInfoClick}
              />
              <AnimatePresence>
                {showInfoPopup && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="absolute left-0 bottom-5 bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-white/20 z-10 min-w-32 backdrop-blur-sm"
                  >
                    <div>Total distance: {car.odometer || "N/A"} km</div>
                    <div>Year: {car.year || "2021"}</div>
                    {car.registration && <div>Registration: {car.registration}</div>}
                    <div className="absolute -bottom-2 left-2 transform w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/80" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-gray-400">Last driven: {lastDrivenText}</span>
          </div>

          {/* Status indicator */}
          <div className={`text-xs font-medium ${isScannedCar ? "text-[#E82127] bg-[#E82127]/10" : "text-green-500 bg-green-500/10"} px-2 py-0.5 rounded-full`}>
            {isScannedCar ? "Scanned" : "Ready"}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardComponent);
