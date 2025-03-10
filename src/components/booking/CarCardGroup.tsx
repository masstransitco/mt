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

// Fallback skeleton while the 3D viewer loads
const ViewerSkeleton = () => (
  <div className="relative w-full h-full bg-gray-900/30 rounded-lg overflow-hidden">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-900/30 via-gray-800/30 to-gray-900/30" />
  </div>
);

export interface CarGroup {
  model: string;
  cars: Car[];
}

interface CarCardGroupProps {
  group: CarGroup;
  isVisible?: boolean;
  rootRef?: React.RefObject<HTMLDivElement>;
  /** If true, we skip showing the "select car" dropdown, because there's only one scanned car. */
  isQrScanStation?: boolean;
}

// Dynamically load your Car3DViewer.
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

function CarCardGroup({
  group,
  isVisible = true,
  rootRef,
  isQrScanStation = false,
}: CarCardGroupProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  const [showOdometerPopup, setShowOdometerPopup] = useState(false);
  const [shouldRender3D, setShouldRender3D] = useState(false);

  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to load the 3D model only when visible
  useEffect(() => {
    if (!isVisible) {
      setShouldRender3D(false);
      return;
    }
    if (!cardRef.current) return;

    const options: IntersectionObserverInit = {
      threshold: 0.1,
      root: rootRef?.current ?? null,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
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

  // Cleanup popup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // If the user has selected any car in this group
  const isGroupSelected = useMemo(() => {
    return group.cars.some((c) => c.id === selectedCarId);
  }, [group.cars, selectedCarId]);

  // Decide which car is displayed
  const displayedCar = useMemo(() => {
    if (group.cars.length === 1) {
      return group.cars[0];
    }
    const foundSelected = group.cars.find((c) => c.id === selectedCarId);
    return foundSelected || group.cars[0];
  }, [group.cars, selectedCarId]);

  // Example battery logic
  const { batteryPercentage, batteryIconColor, BatteryIcon } = useMemo(() => {
    const rawBattery = displayedCar.electric_battery_percentage_left;
    const parsed = rawBattery != null ? Number(rawBattery) : NaN;
    const percentage =
      !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90;

    let Icon = BatteryFull;
    let color = "text-green-400";

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

    return {
      batteryPercentage: percentage,
      batteryIconColor: color,
      BatteryIcon: Icon,
    };
  }, [displayedCar]);

  // 3D model
  const modelUrl = displayedCar?.modelUrl || "/cars/defaultModel.glb";

  // Switch the selected car
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
    setShowOdometerPopup(false);
  };

  // Example odometer popup
  const handleOdometerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOdometerPopup((prev) => !prev);
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
      onClick={() => {
        if (!isGroupSelected) {
          dispatch(selectCar(displayedCar.id));
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isGroupSelected ? 1.0 : 0.98,
      }}
      transition={{ type: "tween", duration: 0.2, delay: 0.05 }}
      // Fixed height: h-40 -> you can pick something else
      // overflow-hidden -> ensures no content spills out
      className="
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
        h-40
      "
      style={{
        contain: "content",
      }}
    >
      {/* "Selected" badge if group is selected */}
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-blue-500/80 text-white text-xs backdrop-blur-sm">
            Selected
          </div>
        </div>
      )}

      {/* Row layout: left = 3D model, right = stats */}
      <div className="flex flex-row h-full">
        {/* Left: 3D viewer container, no aspect-video */}
        <div className="relative w-1/2 h-full overflow-hidden">
          {/* Optional dropdown if we have multiple cars & not in QR flow */}
          {(!isQrScanStation && group.cars.length > 1) && (
            <div
              className="absolute top-3 left-3 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                className="cursor-pointer bg-gray-800/80 border border-gray-700 rounded px-2 py-1 text-white text-xs backdrop-blur-sm"
                onChange={(e) => handleSelectCar(parseInt(e.target.value, 10))}
                value={displayedCar.id}
              >
                {group.cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Decide whether to render 3D or skeleton */}
          {shouldRender3D && isVisible ? (
            <Car3DViewer
              modelUrl={modelUrl}
              imageUrl={displayedCar?.image}
              interactive={isGroupSelected}
              height="100%"
              width="100%"
              isVisible={true}
            />
          ) : (
            <ViewerSkeleton />
          )}
        </div>

        {/* Right: Info panel */}
        <div className="w-1/2 h-full p-4 flex flex-col justify-between">
          {/* Top half: car name & battery stats */}
          <div>
            <div className="flex items-start justify-between">
              <p className="font-medium text-base leading-tight text-white">
                {displayedCar.model || "Unknown Model"}
              </p>
            </div>

            {/* Battery + range row */}
            <div className="flex items-center mt-2 gap-2">
              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-2 py-1">
                <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
                <span className="text-xs font-medium">
                  {batteryPercentage}%
                </span>
              </div>

              <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-2 py-1">
                <Gauge className="w-4 h-4 text-blue-400" />
                <span className="text-xs">
                  {(batteryPercentage * 3.2).toFixed(0)} km
                </span>
              </div>
            </div>

            {/* Example: Odometer info */}
            <div className="flex items-center mt-3 text-gray-400 text-xs relative">
              <Info
                className="w-4 h-4 mr-1 cursor-pointer hover:text-white transition-colors"
                onClick={handleOdometerClick}
              />
              <span>Year: {displayedCar.year || "2021"}</span>

              {showOdometerPopup && (
                <div className="absolute left-0 bottom-6 bg-gray-800 text-white text-xs px-3 py-2 rounded-md shadow-lg border border-gray-700 z-10">
                  Total distance: {displayedCar.odometer || "N/A"} km
                </div>
              )}
            </div>
          </div>

          {/* Bottom: extra info */}
          <div className="mt-4 text-xs text-gray-400">
            Last updated: {String(displayedCar.location_updated || "")}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardGroup);
