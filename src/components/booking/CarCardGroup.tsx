// src/components/booking/CarCardGroup.tsx

"use client";

import React, { memo, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";
// We'll import the four battery icons from Lucide:
import {
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Gauge,
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

  // For our group, see if the "selectedCar" is within it
  const selectedCar = useMemo(() => {
    const found = group.cars.find((c) => c.id === selectedCarId);
    return found || group.cars[0]; // fallback if none selected
  }, [group.cars, selectedCarId]);

  // We treat the group as "selected" if any car in it is selected
  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId);

  // If multiple cars share the same model, they can also share the same GLB,
  // but if you prefer, you can trust the selectedCar's modelUrl:
  const modelUrl = selectedCar?.modelUrl || "/cars/defaultModel.glb";

  // Handler to pick a different car from the same group
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  // 1) Battery logic: choose icon + color based on percentage
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
      // "chartreuse" is close to lime, pick a tailwind color you like:
      batteryIconColor = "text-lime-400";
    } else {
      BatteryIcon = BatteryFull;
      batteryIconColor = "text-green-500";
    }
  }

  // 2) Format "location_updated" date into "13th February 21:13pm" etc.
  const locationUpdated = selectedCar.location_updated;
  const formattedLastDriven = useMemo(() => {
    if (!locationUpdated) return "";
    const d = new Date(locationUpdated); // parse the string
    if (isNaN(d.getTime())) return ""; // fallback if invalid

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
    const year = d.getFullYear(); // you can use or ignore the year
    // For hours/minutes + am/pm
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const isPM = hours >= 12;
    let hours12 = hours % 12 || 12;
    const ampm = isPM ? "pm" : "am";
    // Zero-pad minutes
    const minutesStr = String(minutes).padStart(2, "0");

    // Example final format: "13th February 21:13pm"
    return `${day}${suffix} ${month} ${hours12}:${minutesStr}${ampm}`;
  }, [locationUpdated]);

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
      style={{ width: 320 }} // slightly wider to accommodate the new layout
    >
      {/* Badge (e.g., "5-seater") if you want to show it on selection */}
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

      {/* Car Details (common for the group) */}
      <div className="p-4">

        {/* 
          Row 1: Left = Model (bold), Right = Car Name dropdown
          We'll place the Year just below the dropdown on the right.
        */}
        <div className="flex items-start justify-between">
          {/* Left side (model name) */}
          <div className="flex flex-col">
            <p className="font-bold text-foreground text-lg">{selectedCar.model}</p>
          </div>

          {/* Right side (dropdown + year) */}
          <div className="flex flex-col items-end">
            {/* Dropdown */}
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
            {/* Year below dropdown */}
            <p className="text-sm text-muted-foreground">{selectedCar.year}</p>
          </div>
        </div>

        {/* Row 2: Battery + Odometer */}
        <div className="mt-3 space-y-1">
          {/* Battery (if available) */}
          {typeof batteryPercentage === "number" && batteryPercentage > 0 && (
            <div className={`flex items-center gap-1 text-sm ${batteryIconColor}`}>
              <BatteryIcon className="w-4 h-4" />
              <span>{batteryPercentage}%</span>
            </div>
          )}

          {/* Odometer */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>{selectedCar.odometer} km</span>
          </div>
        </div>
      </div>

      {/* Slim footer for "Last driven" */}
      {formattedLastDriven && (
        <div className="bg-muted/10 text-muted-foreground text-xs px-4 py-2">
          Last driven at {formattedLastDriven}
        </div>
      )}
    </motion.div>
  );
}

export default memo(CarCardGroup);

/** Helper function to get "st", "nd", "rd", "th" suffix for a given day. */
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
