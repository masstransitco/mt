"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStationSelector } from "../context/StationSelectorContext";

interface StationIconProps {
  type: "departure" | "arrival";
  highlight: boolean;
  step: number;
}

/**
 * Unified station icon component for both departure and arrival
 */
const StationIcon = React.memo(({ type, highlight, step }: StationIconProps) => {
  const { theme, isQrScanStation } = useStationSelector();
  
  // Get departure and arrival IDs from context
  const { departureId, arrivalId } = useStationSelector();
  
  // Check if departure and arrival are the same station
  const isSameStation = departureId && arrivalId && departureId === arrivalId;
  
  // Determine the color based on type, QR scan status, and whether stations are the same
  const dotColor = type === "departure" 
    ? (isQrScanStation ? theme.colors.QR_SCAN : theme.colors.DEPARTURE) 
    : (isSameStation ? theme.colors.PICKUP_DROPOFF : theme.colors.ARRIVAL);

  // Get sizes from context theme
  const { ICON: iconSize, DOT: dotSize } = theme.sizes;
  
  // Determine if we should show the search icon based on step and type
  const showSearchIcon = (type === "departure" && step === 1) || (type === "arrival" && step === 3);
  
  // Determine if we should show the inner dot (filled state)
  const showInnerDot = type === "departure" ? step >= 3 : step >= 4;

  return (
    <div className="transition-all duration-300">
      {showSearchIcon ? (
        // Search state
        <Search className={cn("text-foreground", iconSize)} />
      ) : (
        // Circle with border using ultra-black minimal style
        <div
          className={cn(
            "rounded-full flex items-center justify-center",
            "border-2 transition-all duration-300",
            highlight ? "border-white/80" : "border-white/30",
            iconSize,
          )}
          style={{
            background: "rgba(0, 0, 0, 0.8)",
            boxShadow: highlight ? "0 0 6px rgba(255, 255, 255, 0.1)" : "none",
          }}
        >
          {showInnerDot && (
            // Inner dot for selected state - keep the accent color
            <div className={cn("rounded-full", dotSize)} style={{ backgroundColor: dotColor }}></div>
          )}
        </div>
      )}
    </div>
  );
});

StationIcon.displayName = "StationIcon";

export default StationIcon;