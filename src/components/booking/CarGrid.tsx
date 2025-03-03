"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { CarGroup } from "./CarCardGroup";

// Example Car type for reference
export interface Car {
  id: number;
  model?: string;
  name: string;
  // ... other fields ...
}

interface CarGridProps {
  className?: string;
  isVisible?: boolean;
}

export default function CarGrid({ className = "", isVisible = true }: CarGridProps) {
  const dispatch = useAppDispatch();
  const availableCars = useAvailableCarsForDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // Container ref
  const containerRef = useRef<HTMLDivElement>(null);

  // For controlling data fetch & skeletons
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    let mounted = true;
    if (isVisible) {
      Promise.all([dispatch(fetchCars()), dispatch(fetchDispatchLocations())]).finally(() => {
        if (mounted) {
          setIsInitialLoad(false);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [dispatch, isVisible]);

  // Auto-select the first car if none selected
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch, isVisible]);

  // Group cars by model (limit 10 per group, max 5 groups total)
  const groupedByModel: CarGroup[] = useMemo(() => {
    if (!isVisible) return [];

    // Build a dictionary: { [modelName]: { model: string, cars: Car[] } }
    const dict = availableCars.reduce((acc, car) => {
      const modelKey = car.model || "Unknown Model";
      if (!acc[modelKey]) {
        acc[modelKey] = { model: modelKey, cars: [] };
      }
      // limit the group to 10 cars for performance
      if (acc[modelKey].cars.length < 10) {
        acc[modelKey].cars.push(car);
      }
      return acc;
    }, {} as Record<string, CarGroup>);

    return Object.values(dict).slice(0, 5);
  }, [availableCars, isVisible]);

  if (isInitialLoad) {
    return (
      <div className="py-4 space-y-4">
        {[...Array(2)].map((_, index) => (
          <div key={index} className="w-full h-48 bg-gray-900/50 border border-gray-800 animate-pulse rounded-lg" />
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
                <CarCardGroup group={group} isVisible={isVisible} rootRef={containerRef} />
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
          <p className="text-gray-400">No cars available right now. Please check again later.</p>
        </motion.div>
      )}
    </div>
  );
}
