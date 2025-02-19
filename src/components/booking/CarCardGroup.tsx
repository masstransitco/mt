"use client";

import React, { memo, useMemo, useState } from "react";
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
import Car3DViewer from "./Car3DViewer";
import type { Car } from "@/types/cars";

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

  // Local state to show/hide the odometer popup
  const [showOdometerPopup, setShowOdometerPopup] = useState(false);

  // Find whichever car is selected in this group (or fallback to first)
  const selectedCar = useMemo(() => {
    const found = group.cars.find((c) => c.id === selectedCarId);
    return found || group.cars[0];
  }, [group.cars, selectedCarId]);

  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId);
  const modelUrl = selectedCar?.modelUrl || "/cars/defaultModel.glb";

  // When a user picks a different car in the dropdown
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
    setShowOdometerPopup(false); // close popup when switching cars
  };

  // --- 1) Battery icon logic & color ---
  const batteryPercentage = selectedCar.electric_battery_percentage_left ?? null;
  let BatteryIcon = BatteryFull; // default
  let batteryIconColor = "text-green-500"; // default green
  if (typeof batteryPercentage === "number") {
    if (batteryPercentage <= 9) {
      BatteryIcon = BatteryWarning;
      batteryIconColor = "text-red-500";
    } else if (batteryPercentage < 40) {
      BatteryIcon = BatteryLow;
      batteryIconColor = "text-orange-500";
    } else if (batteryPercentage < 80) {
      BatteryIcon = BatteryMedium;
      batteryIconColor = "text-lime-400";
    } else {
      BatteryIcon = BatteryFull;
      batteryIconColor = "text-green-500";
    }
  }

  // --- 2) Format "location_updated" date ---
  const locationUpdated = selectedCar.location_updated;
  const formattedLastDriven = useMemo(() => {
    if (!locationUpdated) return "";
    const d = new Date(locationUpdated);
    if (isNaN(d.getTime())) return "";

    const day = d.getDate();
    const suffix = getDaySuffix(day);
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = monthNames[d.getMonth()] || "";
    // For hours/minutes + am/pm
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const isPM = hours >= 12;
    let hours12 = hours % 12 || 12;
    const ampm = isPM ? "pm" : "am";
    // Zero-pad minutes
    const minutesStr = String(minutes).padStart(2, "0");

    // Example: "13th February 9:13pm"
    return `${day}${suffix} ${month} ${hours12}:${minutesStr}${ampm}`;
  }, [locationUpdated]);

  // --- 3) Compute "Mileage Remaining" from battery x 3.51 ---
  // e.g. 50% => 50 * 3.51 = 175.5 km
  const mileageRemaining =
    typeof batteryPercentage === "number" ? (batteryPercentage * 3.51).toFixed(1) : "0";

  return (
    <motion.div
      initial={{ scale: 0.98 }}
      animate={{ scale: isGroupSelected ? 1.0 : 0.98 }}
      transition={{ type: "tween", duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card 
        transition-all duration-300 border border-border/50
        ${isGroupSelected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
      `}
      style={{ width: 320 }}
    >
      {/* "5-Seater" badge if group is selected */}
      {isGroupSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="px-2 py-1 rounded-full bg-white text-black text-sm">
            5-Seater
          </div>
        </div>
      )}

      {/* 3D Viewer */}
      <div className="relative w-full aspect-[3/2]">
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

      {/* Car Details */}
      <div className="p-4">

        {/* 
          Top row: left side = Model Name
                    right side = Dropdown 
        */}
        <div className="flex items-start justify-between">
          {/* Left side: Model */}
          <p className="font-bold text-foreground text-lg">{selectedCar.model}</p>

          {/* Right side: Car Name Dropdown */}
          <div className="flex flex-col items-end relative">
            <select
              className="mb-1 cursor-pointer bg-card border text-foreground text-sm"
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

        {/* 
          2nd row: battery & year & info icon 
          We'll place them in a single row aligned to the right
        */}
        <div className="flex items-center justify-end gap-2 mt-1 relative">
          {/* Battery (if available) */}
          {typeof batteryPercentage === "number" && batteryPercentage > 0 && (
            <div className={`flex items-center gap-1 text-sm ${batteryIconColor}`}>
              <BatteryIcon className="w-4 h-4" />
              <span>{batteryPercentage}%</span>
            </div>
          )}

          {/* Info icon + year */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            {/* Info icon that toggles odometer popup */}
            <Info
              className="w-4 h-4 cursor-pointer"
              onClick={() => setShowOdometerPopup(!showOdometerPopup)}
            />

            {/* The "popup" container for odometer info */}
            {showOdometerPopup && (
              <div className="absolute top-6 right-0 bg-white text-black text-xs px-2 py-1 rounded shadow-md">
                Total distance driven: {selectedCar.odometer} km
              </div>
            )}

            {/* Year */}
            <span>{selectedCar.year}</span>
          </div>
        </div>

        {/* 3rd row: Gauge icon for mileage remaining */}
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
          <Gauge className="w-4 h-4" />
          <span>Mileage Remaining: {mileageRemaining} km</span>
        </div>
      </div>

      {/* Footer: "Last driven at X" */}
      {formattedLastDriven && (
        <div className="bg-muted/10 text-muted-foreground text-xs px-4 py-2">
          Last driven at {formattedLastDriven}
        </div>
      )}
    </motion.div>
  );
}

export default memo(CarCardGroup);

/** Helper to compute the day suffix: "1st", "2nd", "3rd", "4th", etc. */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return "th";
  }
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
