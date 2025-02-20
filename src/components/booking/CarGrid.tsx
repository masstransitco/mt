import React, { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { selectViewState } from "@/store/uiSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";

// CarCardGroup is no longer lazy-loaded to avoid hook issues
import CarCardGroup from "./CarCardGroup";

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = "" }: CarGridProps) {
  const dispatch = useAppDispatch();
  const viewState = useAppSelector(selectViewState);
  const isVisible = viewState === "showCar";

  // Only fetch data when component is visible to reduce network and memory usage
  useEffect(() => {
    if (isVisible) {
      dispatch(fetchCars());
      dispatch(fetchDispatchLocations());
    }
  }, [dispatch, isVisible]);

  // Only calculate available cars when component is visible
  const availableCars = isVisible ? useAvailableCarsForDispatch() : [];
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // Window visibility tracking to pause animations when tab is not active
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsWindowVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Early return if not visible to prevent unnecessary calculations
  if (!isVisible) {
    return null;
  }

  // Only select default car when visible and no car is selected
  useEffect(() => {
    if (isVisible && !selectedCarId && availableCars.length > 0) {
      dispatch(selectCar(availableCars[0].id));
    }
  }, [availableCars, selectedCarId, dispatch, isVisible]);

  // Group cars by model (memoized with limit on group size)
  const groupedByModel = useMemo(() => {
    const groups = Object.values(
      availableCars.reduce((acc, car) => {
        const model = car.model || "Unknown Model";
        if (!acc[model]) {
          acc[model] = { model, cars: [] };
        }
        // Limit each group to maximum 10 cars to prevent excessive rendering
        if (acc[model].cars.length < 10) {
          acc[model].cars.push(car);
        }
        return acc;
      }, {} as Record<string, { model: string; cars: typeof availableCars }>)
    );

    // Limit total number of groups to display
    return groups.slice(0, 5);
  }, [availableCars]);

  // Memoize event handlers 
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  // Intersection Observer for viewport detection
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setIsInViewport(entries[0].isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Use simplified animation when not in viewport or window not visible
  const shouldAnimate = isInViewport && isWindowVisible;

  return (
    <div 
      className={`transition-all duration-300 ${className}`}
      ref={containerRef}
    >
      <div
        className="
          overflow-x-auto
          touch-pan-x
          overscroll-contain
          max-w-full
          will-change-scroll
        "
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', // Hide scrollbar in Firefox
          msOverflowStyle: 'none',  // Hide scrollbar in IE/Edge
        }}
      >
        <div className="flex flex-nowrap gap-3 py-2 px-1">
          <AnimatePresence mode="popLayout">
            {groupedByModel.map((group) => (
              <motion.div
                key={group.model}
                layout={shouldAnimate}
                initial={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
                animate={shouldAnimate ? { opacity: 1, scale: 0.975 } : { opacity: 1, scale: 1 }}
                exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : { opacity: 0 }}
                transition={{ duration: shouldAnimate ? 0.2 : 0 }}
              >
                <CarCardGroup group={group} isVisible={isVisible} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {groupedByModel.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="py-12 text-center rounded-2xl bg-card mt-4 mx-4"
        >
          <p className="text-muted-foreground">No cars available right now. Please check again later.</p>
        </motion.div>
      )}
    </div>
  );
}
