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
  <div className="relative w-full h-full bg-neutral-200 rounded-t-md overflow-hidden">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-300 to-neutral-200" />
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
      initial={{ scale: 0.98 }}
      animate={{ scale: isGroupSelected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={`
        relative
        overflow-hidden
        rounded-md
        bg-neutral-300
        text-black
        border border-gray-400
        shadow-md
        transition-colors
        cursor-pointer
        ${isGroupSelected ? "ring-2 ring-white" : ""}
      `}
      style={{
        width: 260,
        contain: "content",
        willChange: isGroupSelected ? "transform" : "auto",
      }}
    >
      {/* Badge if user selected a car from this group */}
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      {/* 3D Viewer Container */}
      <div className="relative w-full aspect-[5/3]">
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

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <p className="font-bold text-lg leading-tight">{selectedCar.model}</p>
          <div
            className="flex flex-col items-end relative"
            onClick={(e) => e.stopPropagation()}
          >
            <select
              className="mb-1 cursor-pointer bg-neutral-200 border border-gray-300 rounded px-1 text-black text-sm"
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

        <div className="flex items-center justify-between mt-1 relative">
          <div className="flex items-center gap-1">
            <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
            <span className="text-sm font-medium">{batteryPercentage}%</span>
          </div>

          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Info className="w-4 h-4 cursor-pointer" onClick={handleOdometerClick} />
            {showOdometerPopup && (
              <div className="absolute top-5 right-0 bg-white text-black text-xs px-2 py-1 rounded shadow-md">
                Total distance driven: {selectedCar.odometer} km
              </div>
            )}
            <span>{selectedCar.year}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-gray-600">
          <Gauge className="w-4 h-4" />
          <span className="text-sm">{(batteryPercentage * 3.51).toFixed(1)} km</span>
        </div>
      </div>

      {formattedLastDriven && (
        <div className="bg-gray-200 text-gray-700 text-xs px-4 py-2">
          Last driven on {formattedLastDriven}
        </div>
      )}
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