"use client";

import type React from "react";
import { memo, useState, useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectCar } from "@/store/userSlice";
import { BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Gauge, Info } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Car } from "@/types/cars";
import { CarSeat } from "@/components/ui/icons/CarSeat";

// Fallback skeleton while the 3D viewer loads
const ViewerSkeleton = memo(() => (
  <div className="relative w-full h-full bg-gray-900/30 rounded-lg overflow-hidden">
    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-900/30 via-gray-800/30 to-gray-900/30" />
  </div>
));
ViewerSkeleton.displayName = "ViewerSkeleton";

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

/** Observe element visibility via IntersectionObserver */
function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = { threshold: 0.1 }
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => setIsIntersecting(entry.isIntersecting));
    }, options);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, options]);
  
  return isIntersecting;
}

/** Custom hook for (optionally) hooking into scroll events */
function useTouchScrollHandler() {
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.currentTarget.dataset.touchY = e.touches[0].clientY.toString();
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const height = el.clientHeight;
    const delta = e.touches[0].clientY - (el.dataset.touchY ? parseFloat(el.dataset.touchY) : 0);

    // Removed e.preventDefault() to avoid the passive event warning
    // If you need to block overscroll, consider using `touch-action: pan-y; overscroll-behavior: contain;` in CSS

    el.dataset.touchY = e.touches[0].clientY.toString();
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.touchY;
  }, []);
  
  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

// Helper function to format "Last driven" time
function formatLastDriven(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never driven";
  
  try {
    const lastUpdate = new Date(timestamp);
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
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}, ${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hr${diffHours !== 1 ? 's' : ''}, ${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
    } else {
      return "Just now";
    }
  } catch (error) {
    return "Unknown";
  }
}

// Dynamically load Car3DViewer with a consistent loading state.
const Car3DViewer = dynamic(() => import("./Car3DViewer"), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

function CarCardGroup({ group, isVisible = true, rootRef, isQrScanStation = false }: CarCardGroupProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // Odometer popup state
  const [showOdometerPopup, setShowOdometerPopup] = useState(false);
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Card ref for intersection observer
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useIntersectionObserver(cardRef, { threshold: 0.1 });

  // Decide which car to display
  const displayedCar = group.cars.length === 1
    ? group.cars[0]
    : group.cars.find((c) => c.id === selectedCarId) || group.cars[0];

  // Battery info
  const { batteryPercentage, batteryIconColor, BatteryIcon } = (() => {
    const rawBattery = displayedCar.electric_battery_percentage_left;
    const parsed = rawBattery != null ? Number(rawBattery) : NaN;
    const percentage = !isNaN(parsed) && parsed >= 1 && parsed <= 100 ? parsed : 90;
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
    return { batteryPercentage: percentage, batteryIconColor: color, BatteryIcon: Icon };
  })();

  const modelUrl = displayedCar?.modelUrl || "/cars/defaultModel.glb";
  
  // Format last driven time
  const lastDrivenText = formatLastDriven(displayedCar.location_updated);

  // Handler to select a car
  const handleSelectCar = useCallback(
    (carId: number) => {
      dispatch(selectCar(carId));
      setShowOdometerPopup(false);
    },
    [dispatch]
  );

  // Odometer popup toggling
  const handleOdometerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOdometerPopup((prev) => !prev);
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => setShowOdometerPopup(false), 3000);
  }, []);

  // Cleanup odometer popup on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, []);

  // Determine if any car in the group is selected
  const isGroupSelected = group.cars.some((c) => c.id === selectedCarId);

  // Optional scroll handlers (no more preventDefault)
  const touchScrollHandlers = useTouchScrollHandler();

  return (
    <motion.div
      ref={cardRef}
      onClick={() => {
        if (!isGroupSelected) {
          dispatch(selectCar(displayedCar.id));
        }
      }}
      initial={{ opacity: 0, y: 5 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isGroupSelected ? 1.0 : 0.98,
      }}
      transition={{ type: "tween", duration: 0.2 }}
      className="relative overflow-hidden rounded-lg bg-gray-900/50 text-white border border-gray-800 backdrop-blur-sm shadow-md transition-colors cursor-pointer mb-2 w-full h-32"
      style={{
        contain: "content",
        // If you want to block overscroll, try:
        // touchAction: "pan-y",
        // overscrollBehavior: "contain",
        // overflow: "auto",
      }}
      {...touchScrollHandlers}
    >
      {isGroupSelected && (
        <div className="absolute top-2 right-2 z-10">
          <div className="px-1.5 py-0.5 rounded-full bg-blue-500/80 text-white text-xs backdrop-blur-sm">
            Selected
          </div>
        </div>
      )}
      <div className="flex flex-col h-full">
        <div className="flex flex-row flex-1">
          <div className="relative w-1/2 h-full overflow-hidden">
            {!isQrScanStation && group.cars.length > 1 && (
              <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                <select
                  className="cursor-pointer bg-gray-800/80 border border-gray-700 rounded px-1.5 py-0.5 text-white text-xs backdrop-blur-sm"
                  onChange={(e) => handleSelectCar(Number.parseInt(e.target.value, 10))}
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
            {isInView && isVisible ? (
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
          <div className="w-1/2 h-full p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <p className="font-medium text-sm leading-tight text-white">
                  {displayedCar.model || "Unknown Model"}
                </p>
              </div>
              <div className="flex items-center mt-1.5 gap-1.5 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-1.5 py-0.5">
                  <BatteryIcon className={`w-3.5 h-3.5 ${batteryIconColor}`} />
                  <span className="text-xs font-medium">{batteryPercentage}%</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-1.5 py-0.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs">{(batteryPercentage * 3.2).toFixed(0)} km</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-800/70 rounded-full px-1.5 py-0.5">
                  <CarSeat className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-xs">1+4 seats</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* New Footer Component */}
        <div className="w-full h-6 bg-gray-800/50 px-3 flex items-center justify-between text-xs border-t border-gray-700/30">
          <div className="flex items-center gap-1.5 relative">
            <Info
              className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-white transition-colors"
              onClick={handleOdometerClick}
            />
            {showOdometerPopup && (
              <div className="absolute left-0 bottom-6 bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg border border-gray-700 z-10 min-w-32">
                <div>Total distance: {displayedCar.odometer || "N/A"} km</div>
                <div>Year: {displayedCar.year || "2021"}</div>
              </div>
            )}
            <span className="text-gray-400">Last driven: {lastDrivenText}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(CarCardGroup, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.isQrScanStation === nextProps.isQrScanStation &&
    prevProps.group.model === nextProps.group.model &&
    prevProps.group.cars.length === nextProps.group.cars.length
  );
});
