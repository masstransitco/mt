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
  const dispatchRadius = useAppSelector(selectDispatchRadius);

  // Our main source of "available cars"
  let availableCars = useAvailableCarsForDispatch();
  const storeAvailableCars = useAppSelector(selectAvailableForDispatch);

  // If in QR mode, override the normal list
  if (isQrScanStation && scannedCar) {
    availableCars = [scannedCar];
  }

  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // On mount/visibility, fetch all data: cars, dispatch locations, Firestore availability
  useEffect(() => {
    let mounted = true;
    if (isVisible) {
      console.log("[CarGrid] Fetching cars, dispatch locations, and Firestore availability...");
      Promise.all([
        dispatch(fetchCars()).unwrap(),
        dispatch(fetchDispatchLocations()).unwrap(),
      ])
        .then(() => dispatch(fetchAvailabilityFromFirestore()))
        .finally(() => {
          if (mounted) {
            setIsInitialLoad(false);
            console.log("[CarGrid] Initial data load complete");
          }
        })
        .catch((err) => {
          console.error("[CarGrid] Error fetching data:", err);
        });
    }
    return () => {
      mounted = false;
    };
  }, [dispatch, isVisible]);

  // Warn if in QR mode but no scanned car
  useEffect(() => {
    if (isQrScanStation && !scannedCar) {
      console.warn("[CarGrid] isQrScanStation is true, but no scannedCar provided!");
    }
  }, [isQrScanStation, scannedCar]);

  // Auto-select the first car if none selected
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      console.log("[CarGrid] Auto-selecting first car:", availableCars[0].id);
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
      if (acc[modelKey].cars.length < 10) {
        acc[modelKey].cars.push(car);
      }
      return acc;
    }, {} as Record<string, CarGroup>);

    const result = Object.values(dict).slice(0, 5);
    console.log("[CarGrid] Created", result.length, "car groups");
    return result;
  }, [availableCars, isVisible, isQrScanStation, scannedCar]);

  if (isInitialLoad) {
    return (
      <div className="py-4">
        {/* Single loading skeleton instead of two */}
        <div
          className="w-full h-48 bg-gray-900/50 border border-gray-800 animate-pulse rounded-lg"
        />
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
