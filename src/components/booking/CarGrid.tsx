"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars, selectAvailableForDispatch } from "@/store/carSlice";
import {
  fetchDispatchLocations,
  selectDispatchRadius,
  fetchAvailabilityFromFirestore,
} from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { CarGroup } from "./CarCardGroup";
import type { Car } from "@/types/cars";

/**
 * CarGrid props.
 */
interface CarGridProps {
  className?: string;
  isVisible?: boolean;
  /** If a car was scanned, we override the normal availableCars logic. */
  isQrScanStation?: boolean;
  scannedCar?: Car | null;
}

/**
 * Main CarGrid component that fetches cars & dispatch data, then displays them in groups.
 */
export default function CarGrid({
  className = "",
  isVisible = true,
  isQrScanStation = false,
  scannedCar = null,
}: CarGridProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const dispatchRadius = useAppSelector(selectDispatchRadius);

  // Our primary "available cars"
  let availableCars = useAvailableCarsForDispatch();

  // If in QR mode, override the normal list with just the scannedCar
  if (isQrScanStation && scannedCar) {
    availableCars = [scannedCar];
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // On mount (or when visible), fetch data: cars, dispatch locations, & Firestore availability
  useEffect(() => {
    let mounted = true;

    if (isVisible) {
      console.log("[CarGrid] Fetching cars, dispatch locations, and Firestore availability...");

      // Remove all ".unwrap()" calls to prevent unhandled rejections
      Promise.all([
        dispatch(fetchCars()),             // no .unwrap()
        dispatch(fetchDispatchLocations()),
      ])
        .then(() => dispatch(fetchAvailabilityFromFirestore()))
        .then(() => {
          console.log("[CarGrid] All data loaded (or attempted).");
        })
        .catch((err) => {
          // If any fetch fails (e.g. 500 error), log it but do NOT freeze
          console.error("[CarGrid] Some data fetch call failed:", err);
        })
        .finally(() => {
          if (mounted) {
            setIsInitialLoad(false);
            console.log("[CarGrid] Initial data load done");
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [dispatch, isVisible]);

  // Warn if in QR mode but no scanned car
  useEffect(() => {
    if (isQrScanStation && !scannedCar) {
      console.warn("[CarGrid] isQrScanStation is true, but no scannedCar was provided!");
    }
  }, [isQrScanStation, scannedCar]);

  // Auto-select the first car if none selected
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      console.log("[CarGrid] Auto-selecting the first available car:", availableCars[0].id);
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch, isVisible]);

  // Group cars by model
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible) return [];
    if (availableCars.length === 0) {
      console.log("[CarGrid] No cars available to group");
      return [];
    }

    // If in QR station mode with a scanned car, just show that single car
    if (isQrScanStation && scannedCar) {
      return [
        {
          model: scannedCar.model || "Scanned Car",
          cars: [scannedCar],
        },
      ];
    }

    console.log("[CarGrid] Grouping", availableCars.length, "cars by model");
    const dict = availableCars.reduce((acc, car) => {
      const modelKey = car.model || "Unknown Model";
      if (!acc[modelKey]) {
        acc[modelKey] = { model: modelKey, cars: [] };
      }
      // cap each group at 10 cars
      if (acc[modelKey].cars.length < 10) {
        acc[modelKey].cars.push(car);
      }
      return acc;
    }, {} as Record<string, CarGroup>);

    // Only take the first 5 groups for display
    const result = Object.values(dict).slice(0, 5);
    console.log("[CarGrid] Created", result.length, "car groups");
    return result;
  }, [availableCars, isVisible, isQrScanStation, scannedCar]);

  // If still loading data, show a skeleton
  if (isInitialLoad) {
    return (
      <div className="py-4">
        <div className="w-full h-48 bg-gray-900/50 border border-gray-800 animate-pulse rounded-lg" />
      </div>
    );
  }

  console.log("[CarGrid] Rendering with", groupedByModel.length, "car groups");

  return (
    <div className={`transition-all duration-300 ${className}`} ref={containerRef}>
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

      {isVisible && groupedByModel.length === 0 && (
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