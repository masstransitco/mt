"use client";

import React, { memo, useMemo, useState, useEffect } from "react";
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

// Dynamically load the Car3DViewer only when it's required (using lazy load)
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-200 animate-pulse rounded-2xl" />
  ),
});

/** A grouping of cars that share the same `model` */
interface CarGroup {
  model: string;
  cars: Car[];
}

interface CarCardGroupProps {
  group: CarGroup;
  isVisible?: boolean;
}

function CarCardGroup({ group, isVisible = true }: CarCardGroupProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  const [showOdometerPopup, setShowOdometerPopup] = useState(false);

  // Find the selected car, fallback to the first car in the group
  const selectedCar = useMemo(() => {
    return group.cars.find((c) => c.id === selectedCarId) || group.cars[0];
  }, [group.cars, selectedCarId]);

  const isGroupSelected = useMemo(() => {
    return group.cars.some((c) => c.id === selectedCarId);
  }, [group.cars, selectedCarId]);

  const modelUrl = selectedCar?.modelUrl || "/cars/defaultModel.glb";

  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
    setShowOdometerPopup(false);
  };

  // -----------------------------------------
  // 1) Battery fallback logic
  const rawBattery = selectedCar.electric_battery_percentage_left;
  const parsed = rawBattery != null ? parseFloat(String(rawBattery)) : NaN;
  const isValid = !isNaN(parsed) && parsed >= 1 && parsed <= 100;
  const batteryPercentage = isValid ? parsed : 92;

  // -----------------------------------------
  // 2) Battery icon + color logic
  let BatteryIcon = BatteryFull;
  let batteryIconColor = "text-green-500";
  if (batteryPercentage <= 9) {
    BatteryIcon = BatteryWarning;
    batteryIconColor = "text-red-500";
  } else if (batteryPercentage < 40) {
    BatteryIcon = BatteryLow;
    batteryIconColor = "text-orange-500";
  } else if (batteryPercentage < 80) {
    BatteryIcon = BatteryMedium;
    batteryIconColor = "text-lime-400";
  }

  // -----------------------------------------
  // 3) Format "location_updated" date
  const locationUpdated = selectedCar.location_updated;
  const formattedLastDriven = React.useMemo(() => {
    if (!locationUpdated) return "";
    const d = new Date(locationUpdated);
    if (isNaN(d.getTime())) return "";
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
  }, [locationUpdated]);

  // -----------------------------------------
  // 4) "Mileage remaining" calculation
  const mileageRemaining = (batteryPercentage * 3.51).toFixed(1);

  const handleCardClick = () => {
    if (!isGroupSelected) {
      dispatch(selectCar(selectedCar.id));
    }
  };

  return (
    <motion.div
      onClick={handleCardClick}
      initial={{ scale: 0.98 }}
      animate={{ scale: isGroupSelected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      className={`
        relative
        overflow-hidden
        rounded-md
        bg-neutral-300
        text-black
        border border-gray-400
        shadow-md
        transition-all
        duration-300
        cursor-pointer
        ${isGroupSelected ? "ring-2 ring-white" : ""}
      `}
      style={{ width: 260 }}
    >
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      {/* 3D Viewer Container - aspect ratio to keep it wide */}
      <div className="relative w-full aspect-[5/3]">
        {isVisible && (
          <Car3DViewer
            modelUrl={modelUrl}
            imageUrl={selectedCar?.image}
            interactive={isGroupSelected}
            height="100%"
            width="100%"
            isVisible
          />
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          {/* Car Model */}
          <p className="font-bold text-lg leading-tight">{selectedCar.model}</p>

          {/* Car Selector */}
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

        {/* Battery & Info Row */}
        <div className="flex items-center justify-between mt-1 relative">
          <div className="flex items-center gap-1">
            <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
            <span className="text-sm font-medium">{batteryPercentage}%</span>
          </div>

          <div
            className="flex items-center gap-1 text-sm text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <Info
              className="w-4 h-4 cursor-pointer"
              onClick={() => setShowOdometerPopup(!showOdometerPopup)}
            />
            {showOdometerPopup && (
              <div className="absolute top-5 right-0 bg-white text-black text-xs px-2 py-1 rounded shadow-md">
                Total distance driven: {selectedCar.odometer} km
              </div>
            )}
            <span>{selectedCar.year}</span>
          </div>
        </div>

        {/* Range / Mileage */}
        <div className="mt-2 flex items-center gap-2 text-gray-600">
          <Gauge className="w-4 h-4" />
          <span className="text-sm">{mileageRemaining} km</span>
        </div>
      </div>

      {/* Last Driven Info */}
      {formattedLastDriven && (
        <div className="bg-gray-200 text-gray-700 text-xs px-4 py-2">
          Last driven on {formattedLastDriven}
        </div>
      )}
    </motion.div>
  );
}

export default memo(CarCardGroup);

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}
