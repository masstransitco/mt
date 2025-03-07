"use client";

import React, { memo, useMemo, useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";

import {
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Gauge,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Car } from "@/types/cars";

// Lazy-load Car3DViewer
const Car3DViewer = dynamic(() => import("./Car3DViewer").then(mod => mod.default), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

/** A group of cars (all with the same model). */
export interface CarGroup {
  model: string;
  cars: Car[];
}

interface CarCardGroupProps {
  group: CarGroup;
  /** If the entire grid (or parent) is visible or not. */
  isVisible?: boolean;
  /**
   * Optionally pass a ref to a scrollable container
   * if you want IntersectionObserver to detect horizontal scrolling.
   */
  rootRef?: React.RefObject<HTMLDivElement>;
}

/** Fallback skeleton while the 3D viewer loads. */
const ViewerSkeleton = () => (
  <div className="relative w-full h-full bg-gray-900/30 rounded-lg overflow-hidden">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-900/30 via-gray-800/30 to-gray-900/30" />
  </div>
);

function CarCardGroup({ group, isVisible = true, rootRef }: CarCardGroupProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  const [showOdometerPopup, setShowOdometerPopup] = useState(false);
  const [shouldRender3D, setShouldRender3D] = useState(false);

  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // IntersectionObserver: load 3D only if card is visible in the scroll container
  useEffect(() => {
    // If the parent/entire grid is hidden, or we have no container ref, bail out
    if (!isVisible) {
      setShouldRender3D(false);
      return;
    }
    if (!cardRef.current) return;

    const options: IntersectionObserverInit = {
      threshold: 0.1,
      // If you have a custom scroll container, use it as the root
      // Otherwise omit 'root' to use the browser viewport
      root: rootRef?.current ?? null,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setShouldRender3D(true);
        }
      });
    }, options);

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootRef]);

  // Decide which car is selected in this group (or default to the first one)
  const selectedCar = useMemo(() => {
    return group.cars.find((c) => c.id === selectedCarId) || group.cars[0];
  }, [group.cars, selectedCarId]);

  // If the user has selected any car in this group
  const isGroupSelected = useMemo(() => {
    return group.cars.some((c) => c.id === selectedCarId);
  }, [group.cars, selectedCarId]);

  // 3D model URL
  const modelUrl = selectedCar?.modelUrl || "/cars/defaultModel.glb";

  // Battery calculations
  const { batteryPercentage, BatteryIcon, batteryIconColor } = useMemo(() => {
    const rawBattery = selectedCar.electric_battery_percentage_left;
    const parsed = rawBattery != null ? Number(rawBattery) : NaN;
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 92;

    let Icon = BatteryFull;
    let color = "text-green-500";

    if (percentage <= 9) {
      Icon = BatteryWarning;
      color = "text-red-500";
    } else if (percentage < 40) {
      Icon = BatteryLow;
      color = "text-orange-500";
    } else if (percentage < 80) {
      Icon = BatteryMedium;
      color = "text-lime-400";
    }

    return { batteryPercentage: percentage, BatteryIcon: Icon, batteryIconColor: color };
  }, [selectedCar.electric_battery_percentage_left]);

  // Format date/time
  const formattedLastDriven = useMemo(() => {
    const locationUpdated = selectedCar.location_updated;
    if (!locationUpdated) return "";
    const d = new Date(locationUpdated);
    if (Number.isNaN(d.getTime())) return "";

    const day = d.getDate();
    const suffix = getDaySuffix(day);
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const month = monthNames[d.getMonth()] || "";
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const isPM = hours >= 12;
    const hours12 = hours % 12 || 12;
    const ampm = isPM ? "pm" : "am";
    const minutesStr = String(minutes).padStart(2, "0");

    return `${day}${suffix} ${month} ${hours12}:${minutesStr}${ampm}`;
  }, [selectedCar.location_updated]);

  // Handlers
  const handleCardClick = () => {
    if (!isGroupSelected) {
      dispatch(selectCar(selectedCar.id));
    }
  };

  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
    setShowOdometerPopup(false);
  };

  const handleOdometerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOdometerPopup(prev => !prev);
    // Reset auto-hide timer
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = setTimeout(() => {
      setShowOdometerPopup(false);
    }, 3000);
  };

  return (
    <motion.div
      ref={cardRef}
      onClick={handleCardClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: isGroupSelected ? 1.0 : 0.98 
      }}
      transition={{ 
        type: "tween", 
        duration: 0.2,
        delay: 0.05
      }}
      className={`
        relative
        overflow-hidden
        rounded-lg
        bg-gray-900/50
        text-white
        border border-gray-800
        backdrop-blur-sm
        shadow-md
        transition-colors
        cursor-pointer
        mb-4
        w-full
        ${isGroupSelected ? "ring-1 ring-blue-500" : ""}
      `}
      style={{
        contain: "content",
        willChange: isGroupSelected ? "transform" : "auto",
      }}
    >
      {/* Badge if user selected a car from this group */}
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-blue-500/80 text-white text-xs backdrop-blur-sm">
            Selected
          </div>
        </div>
      )}

      {/* Make card layout always horizontal */}
      <div className="flex flex-row">
        {/* 3D Viewer Container - fixed width ratio */}
        <div className="relative w-1/2 aspect-video">
          {shouldRender3D && isVisible ? (
            <Car3DViewer
              modelUrl={modelUrl}
              imageUrl={selectedCar?.image}
              interactive={isGroupSelected}
              height="100%"
              width="100%"
              isVisible={true}
            />
          ) : (
            <ViewerSkeleton />
          )}
        </div>

        {/* Content - fixed to right side */}
        <div className="p-4 w-1/2 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <p className="font-medium text-lg leading-tight text-white">{selectedCar.model}</p>
              <div
                className="flex flex-col items-end relative"
                onClick={(e) => e.stopPropagation()}
              >
                <select
                  className="mb-1 cursor-pointer bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                  onChange={(e) => handleSelectCar(parseInt(e.target.value, 10))}
                  value={selectedCar.id}
                >
                  {group.cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center mt-3">
              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-2 py-1">
                <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
                <span className="text-xs font-medium">{batteryPercentage}%</span>
              </div>
              
              <div className="ml-2 flex items-center gap-1 bg-gray-800/70 rounded-full px-2 py-1">
                <Gauge className="w-4 h-4 text-blue-400" />
                <span className="text-xs">{(batteryPercentage * 3.51).toFixed(0)} km</span>
              </div>
            </div>
            
            <div className="flex items-center mt-3 text-gray-400 text-xs">
              <Info 
                className="w-4 h-4 mr-1 cursor-pointer hover:text-white transition-colors" 
                onClick={handleOdometerClick} 
              />
              <span>Year: {selectedCar.year}</span>
              
              {showOdometerPopup && (
                <div className="absolute left-4 bottom-16 bg-gray-800 text-white text-xs px-3 py-2 rounded-md shadow-lg border border-gray-700 z-10">
                  Total distance: {selectedCar.odometer} km
                </div>
              )}
            </div>
          </div>

          {formattedLastDriven && (
            <div className="mt-3 text-gray-400 text-xs">
              Last driven: {formattedLastDriven}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export default memo(CarCardGroup, (prev, next) => {
  return (
    prev.isVisible === next.isVisible &&
    prev.group.model === next.group.model &&
    prev.group.cars.length === next.group.cars.length
  );
});
