"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars, selectAvailableForDispatch } from "@/store/carSlice";
import { fetchDispatchLocations, selectDispatchRadius, selectManualSelectionMode } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { CarGroup } from "./CarCardGroup";
import type { Car } from "@/types/cars";

interface CarGridProps {
  className?: string;
  isVisible?: boolean;
  /** For QR scanning: if a car is scanned, override auto-selection */
  isQrScanStation?: boolean;
  scannedCar?: Car | null;
}

export default function CarGrid({
  className = "",
  isVisible = true,
  isQrScanStation = false,
  scannedCar = null,
}: CarGridProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // Read dispatch settings from Redux:
  const dispatchRadius = useAppSelector(selectDispatchRadius);
  const manualSelectionMode = useAppSelector(selectManualSelectionMode);

  // Get available cars – this hook auto-filters based on dispatch settings
  let availableCars = useAvailableCarsForDispatch();

  // For logging/debugging: also get the available cars from the store directly
  const storeAvailableCars = useAppSelector(selectAvailableForDispatch);

  // In QR mode, override normal selection if a scanned car is provided.
  if (isQrScanStation && scannedCar) {
    availableCars = [scannedCar];
  }

  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);

  // Control initial loading state
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Fetch initial data when component becomes visible.
  useEffect(() => {
    let mounted = true;
    if (isVisible) {
      console.log("[CarGrid] Fetching cars and dispatch locations...");
      Promise.all([
        dispatch(fetchCars()),
        dispatch(fetchDispatchLocations())
      ]).finally(() => {
        if (mounted) {
          setIsInitialLoad(false);
          console.log("[CarGrid] Initial data load complete");
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [dispatch, isVisible]);

  // Warn if in QR mode without a scanned car.
  useEffect(() => {
    if (isQrScanStation && !scannedCar) {
      console.warn("[CarGrid] isQrScanStation is true but no scannedCar provided!");
    }
  }, [isQrScanStation, scannedCar]);

  // Auto-select the first car if none is selected.
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      console.log("[CarGrid] Auto-selecting first car:", availableCars[0].id);
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch, isVisible]);

  // Group available cars by model.
  // This grouping respects the list as determined by DispatchAdmin settings (via useAvailableCarsForDispatch)
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible) return [];
    if (availableCars.length === 0) {
      console.log("[CarGrid] No cars available to group");
      return [];
    }

    // In QR mode, if one scanned car exists, skip grouping.
    if (isQrScanStation && scannedCar) {
      return [{
        model: scannedCar.model || "Scanned Car",
        cars: [scannedCar]
      }];
    }

    console.log("[CarGrid] Grouping", availableCars.length, "cars by model");
    const dict = availableCars.reduce((acc, car) => {
      const modelKey = car.model || "Unknown Model";
      if (!acc[modelKey]) {
        acc[modelKey] = { model: modelKey, cars: [] };
      }
      // Limit each group to 10 cars.
      if (acc[modelKey].cars.length < 10) {
        acc[modelKey].cars.push(car);
      }
      return acc;
    }, {} as Record<string, CarGroup>);

    const result = Object.values(dict).slice(0, 5);
    console.log("[CarGrid] Created", result.length, "car groups");
    return result;
  }, [availableCars, isVisible, isQrScanStation, scannedCar]);

  // Debug info to show current global dispatch settings.
  const renderDebugInfo = () => {
    return (
      <div className="text-xs text-gray-500 mb-2">
        Dispatch Settings – Radius: {dispatchRadius} m, Mode: {manualSelectionMode ? "Manual" : "Automatic"}
      </div>
    );
  };

  if (isInitialLoad) {
    return (
      <div className="py-4 space-y-4">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="w-full h-48 bg-gray-900/50 border border-gray-800 animate-pulse rounded-lg"
          />
        ))}
      </div>
    );
  }

  console.log("[CarGrid] Rendering with", groupedByModel.length, "car groups");

  return (
    <div className={`transition-all duration-300 ${className}`} ref={containerRef}>
      {renderDebugInfo()}
      <div className="px-0 py-2">
        <AnimatePresence>
          {isVisible &&
            groupedByModel.map((group, index) => (
              <motion.div
                key={`${group.model}-${availableCars.length}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                }}
              >
                <CarCardGroup
                  key={`group-${group.model}-${availableCars.length}`}
                  group={group}
                  isVisible={isVisible}
                  rootRef={containerRef}
                  isQrScanStation={isQrScanStation}
                />
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {isVisible && groupedByModel.length === 0 && !isInitialLoad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="py-12 text-center rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm mt-4 mx-4"
        >
          <p className="text-gray-400">
            {isQrScanStation
              ? "Car not found or not in range"
              : "No cars available right now. Please check again later."}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {availableCars.length} cars in store, {groupedByModel.length} groups created
          </p>
        </motion.div>
      )}
    </div>
  );
}
