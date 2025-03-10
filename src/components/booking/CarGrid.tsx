"use client";

import React, { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { CarGroup } from "./CarCardGroup";
import type { Car } from "@/types/cars";

interface CarGridProps {
  className?: string;
  isVisible?: boolean;
  /** New Props to handle scanning logic */
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
  
  // 1) If NOT in QR flow => use dispatch manager
  //    If in QR flow => just use the scannedCar
  let availableCars = useAvailableCarsForDispatch();  
  if (isQrScanStation && scannedCar) {
    // Bypass normal dispatch logic
    availableCars = [scannedCar];
  }
  
  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);

  // For controlling data fetch & skeleton
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    let mounted = true;
    if (isVisible) {
      Promise.all([
        dispatch(fetchCars()), 
        dispatch(fetchDispatchLocations())
      ]).finally(() => {
        if (mounted) {
          setIsInitialLoad(false);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [dispatch, isVisible]);

  // If in QR flow but scannedCar was not actually provided, you might handle that too:
  // For example:
  useEffect(() => {
    if (isQrScanStation && !scannedCar) {
      console.warn("[CarGrid] isQrScanStation is true but no scannedCar provided!");
    }
  }, [isQrScanStation, scannedCar]);

  // Auto-select the first car if none selected
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch, isVisible]);

  // Group cars by model
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible) return [];
    if (availableCars.length === 0) return [];

    // If only 1 car in QR flow, you can skip grouping entirely:
    if (isQrScanStation && scannedCar) {
      return [{
        model: scannedCar.model || "Scanned Car",
        cars: [scannedCar]
      }];
    }

    // Otherwise normal grouping:
    const dict = availableCars.reduce((acc, car) => {
      const modelKey = car.model || "Unknown Model";
      if (!acc[modelKey]) {
        acc[modelKey] = { model: modelKey, cars: [] };
      }
      // limit group to 10 cars
      if (acc[modelKey].cars.length < 10) {
        acc[modelKey].cars.push(car);
      }
      return acc;
    }, {} as Record<string, CarGroup>);

    return Object.values(dict).slice(0, 5);
  }, [availableCars, isVisible, isQrScanStation, scannedCar]);

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

  return (
    <div className={`transition-all duration-300 ${className}`} ref={containerRef}>
      <div className="px-0 py-2">
        <AnimatePresence>
          {isVisible &&
            groupedByModel.map((group, index) => (
              <motion.div
                key={group.model}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                }}
              >
                <CarCardGroup
                  group={group}
                  isVisible={isVisible}
                  rootRef={containerRef}
                  isQrScanStation={isQrScanStation} // pass it down
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
              : "No cars available right now. Please check again later."
            }
          </p>
        </motion.div>
      )}
    </div>
  );
}
