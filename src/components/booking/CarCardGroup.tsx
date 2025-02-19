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

  // Pick whichever car is actually "selected" in this group; fallback to first if none
  const selectedCar = useMemo(() => {
    const found = group.cars.find((c) => c.id === selectedCarId);
    return found || group.cars[0];
  }, [group.cars, selectedCarId]);

  // If *any* car in the group is the selectedCar, we consider the group "selected"
  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId);
  const modelUrl = selectedCar?.modelUrl || "/cars/defaultModel.glb";

  // When a user picks a different car in the dropdown
  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
    setShowOdometerPopup(false); // close popup when switching cars
  };

  // -----------------------------------------
  // 1) Battery fallback logic (1..100 => valid, else 92)
  // -----------------------------------------
  const rawBattery = selectedCar.electric_battery_percentage_left; // number, null, undefined, etc.
  const parsed = rawBattery != null ? parseFloat(String(rawBattery)) : NaN;
  const isValid = !isNaN(parsed) && parsed >= 1 && parsed <= 100;
  const batteryPercentage = isValid ? parsed : 92;

  // -----------------------------------------
  // 2) Battery icon + color
  // -----------------------------------------
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
  // -----------------------------------------
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
  // 4) "Mileage remaining" = batteryPercentage * 3.51
  // -----------------------------------------
  const mileageRemaining = (batteryPercentage * 3.51).toFixed(1);

  // Click entire card => select this group/car
  const handleCardClick = () => {
    // If the group isn't selected, we select the "selectedCar" from this group
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
        rounded-2xl 
        bg-card 
        transition-all 
        duration-300 
        border 
        border-border/50
        ${isGroupSelected ? "shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white" : ""}
      `}
      style={{ width: 320, overflow: "hidden" }}
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
        {/* Row 1: Model (left), Dropdown (right) */}
        <div className="flex items-start justify-between">
          <p className="font-bold text-foreground text-lg">{selectedCar.model}</p>
          <div
            className="flex flex-col items-end relative"
            // stop clicks on the dropdown from also triggering card click
            onClick={(e) => e.stopPropagation()}
          >
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

        {/* Row 2: Battery (left), Info icon & year (right) */}
        <div className="flex items-center justify-between mt-1 relative">
          {/* Battery display */}
          <div className="flex items-center gap-1">
            <BatteryIcon className={`w-4 h-4 ${batteryIconColor}`} />
            <span className="text-sm">{batteryPercentage}%</span>
          </div>

          {/* Info icon + year */}
          <div
            className="flex items-center gap-1 text-sm text-muted-foreground"
            // stop info clicks from triggering card click
            onClick={(e) => e.stopPropagation()}
          >
            <Info
              className="w-4 h-4 cursor-pointer"
              onClick={() => setShowOdometerPopup(!showOdometerPopup)}
            />
            {showOdometerPopup && (
              <div className="absolute top-6 right-0 bg-white text-black text-xs px-2 py-1 rounded shadow-md">
                Total distance driven: {selectedCar.odometer} km
              </div>
            )}
            <span>{selectedCar.year}</span>
          </div>
        </div>

        {/* Row 3: Gauge icon + mileageRemaining */}
        <div className="mt-2 flex items-center gap-2 text-muted-foreground">
          <Gauge className="w-4 h-4" />
          <span className="text-sm">{mileageRemaining} km</span>
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

/** Helper to compute the day suffix: "1st", "2nd", "3rd", etc. */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
}
