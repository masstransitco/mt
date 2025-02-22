"use client";

import React, { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { CarGroup } from "./CarCardGroup";

// Example Car type for reference.
// Adjust to match your real car properties in the store.
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
  const availableCars = useAvailableCarsForDispatch(); // returns Car[] presumably
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // This is our horizontal scroll container ref
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

    // We build a dictionary: { [modelName]: { model: string, cars: Car[] } }
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
      <div className="py-8 space-y-4">
        <div className="w-full h-48 bg-neutral-200 animate-pulse rounded-lg" />
        <div className="w-3/4 h-4 bg-neutral-200 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 ${className}`}>
      <div
        ref={containerRef}
        className="
          overflow-x-auto
          touch-pan-x
          overscroll-contain
          max-w-full
          will-change-scroll
          pb-safe
          hide-scrollbar
        "
        onScroll={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          contain: "paint style layout",
        }}
      >
        <div className="flex flex-nowrap gap-3 py-2 px-1">
          <AnimatePresence mode="popLayout">
            {isVisible &&
              groupedByModel.map((group) => (
                <motion.div
                  key={group.model}
                  layout="position"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    duration: 0.2,
                    layout: { duration: 0.2 },
                  }}
                  style={{
                    contain: "paint style layout",
                    willChange: "transform",
                  }}
                >
                  {/* Pass the scroll container ref so CarCardGroup can observe inside it */}
                  <CarCardGroup group={group} isVisible={isVisible} rootRef={containerRef} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>

      {isVisible && groupedByModel.length === 0 && !isInitialLoad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="py-12 text-center rounded-2xl bg-neutral-200 mt-4 mx-4"
        >
          <p className="text-gray-600">No cars available right now. Please check again later.</p>
        </motion.div>
      )}
    </div>
  );
}