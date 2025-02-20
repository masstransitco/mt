import React, { useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { selectViewState } from "@/store/uiSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup from "./CarCardGroup";

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = "" }: CarGridProps) {
  const dispatch = useAppDispatch();

  // 1) Ensure cars & dispatch locations are loaded
  useEffect(() => {
    dispatch(fetchCars());
    dispatch(fetchDispatchLocations());
  }, [dispatch]);

  // 2) Get available cars + selected car
  const availableCars = useAvailableCarsForDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const viewState = useAppSelector(selectViewState);

  // 3) If no car is selected, default to the first available
  useEffect(() => {
    if (!selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch]);

  // 4) Group cars by model (memoized to avoid recalculations)
  const groupedByModel = useMemo(() => 
    Object.values(
      availableCars.reduce((acc, car) => {
        const model = car.model || "Unknown Model";
        if (!acc[model]) {
          acc[model] = { model, cars: [] };
        }
        acc[model].cars.push(car);
        return acc;
      }, {} as Record<string, { model: string; cars: typeof availableCars }>)
    ), [availableCars]
  );

  // 5) Conditionally render if using a viewState
  const isVisible = viewState === "showCar";
  if (!isVisible) {
    return null;
  }

  // Memoize event handlers to avoid re-creating them on every render
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className={`transition-all duration-300 ${className}`}>
      {/**
       * Outer container for horizontal scrolling:
       * - overflow-x-auto gives a scrollbar if content overflows.
       * - touch-pan-x and -webkit-overflow-scrolling:touch enable smooth horizontal swiping on mobile.
       * - onWheel and onTouchMove stop propagation so the browser does not scroll.
       */}
      <div
        className="
          overflow-x-auto
          touch-pan-x
          -webkit-overflow-scrolling:touch
        "
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
      >
        {/**
         * Inner flex container: flex-nowrap prevents wrapping;
         * w-max forces the container to expand with its content.
         */}
        <div className="flex flex-nowrap w-max gap-3 py-2">
          <AnimatePresence mode="popLayout">
            {groupedByModel.map((group) => (
              <motion.div
                key={group.model}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 0.975 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <CarCardGroup group={group} isVisible={isVisible} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/** Fallback when no cars are available */}
      {groupedByModel.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-12 text-center rounded-2xl bg-card mt-4 mx-4"
        >
          <p className="text-muted-foreground">No cars available right now. Please check again later.</p>
        </motion.div>
      )}
    </div>
  );
}
