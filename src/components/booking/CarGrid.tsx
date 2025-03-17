"use client";

import { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCars } from "@/store/carSlice";
import {
  fetchDispatchLocations,
  selectDispatchRadius,
  fetchAvailabilityFromFirestore,
} from "@/store/dispatchSlice";
import { selectCar } from "@/store/userSlice";
import { useAvailableCarsForDispatch } from "@/lib/dispatchManager";
import CarCardGroup, { type CarGroup } from "./CarCardGroup";
import type { Car } from "@/types/cars";

/**
 * CarGrid props.
 */
interface CarGridProps {
  className?: string;
  isVisible?: boolean;
  /** If a car was scanned, override the normal availableCars logic. */
  isQrScanStation?: boolean;
  scannedCar?: Car | null;
}

// Preload common models (for example purposes)
const modelPreloadState: Record<string, boolean> = {};
export function preloadCommonCarModels() {
  const commonModels = ["/cars/kona.glb", "/cars/defaultModel.glb"];
  commonModels.forEach((url) => {
    if (!modelPreloadState[url]) {
      const image = new Image();
      image.src = url;
      modelPreloadState[url] = true;
      console.log(`[CarGrid] Preloaded car model: ${url}`);
    }
  });
}

const EmptyState = memo(({ isQrScanStation }: { isQrScanStation: boolean }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
    className="rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm p-3 flex items-center justify-center h-32"
  >
    <div className="text-center">
      <p className="text-gray-400 text-sm">
        {isQrScanStation ? "Car not found or not in range" : "No cars available right now. Please check again later."}
      </p>
    </div>
  </motion.div>
));
EmptyState.displayName = "EmptyState";

const LoadingSkeleton = memo(() => (
  <div className="rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm h-32 w-full animate-pulse flex items-center justify-center">
    <div className="text-xs text-gray-400">Loading vehicles...</div>
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

function CarGrid({ className = "", isVisible = true, isQrScanStation = false, scannedCar = null }: CarGridProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const dispatchRadius = useAppSelector(selectDispatchRadius);

  const [componentState, setComponentState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [dataFreshness, setDataFreshness] = useState(0);

  // Refs to track fetch attempts and component lifecycle
  const mountedRef = useRef(true);
  const fetchCallRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSelectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const availableCarsForDispatch = useAvailableCarsForDispatch();

  const availableCars = useMemo(() => {
    if (isQrScanStation && scannedCar) {
      return [scannedCar];
    }
    return availableCarsForDispatch;
  }, [isQrScanStation, scannedCar, availableCarsForDispatch]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Updated fetch function (removed internal cooldown check)
  const fetchData = useCallback(async () => {
    if (isQrScanStation && scannedCar) return;
    if (!isVisible) return;

    const now = Date.now();
    if (!mountedRef.current) return;

    const currentFetchId = ++fetchCallRef.current;
    lastFetchTimeRef.current = now;
    setLoadingError(null);
    console.log("[CarGrid] Fetching cars and dispatch data...");

    try {
      await Promise.all([dispatch(fetchCars()), dispatch(fetchDispatchLocations())]);
      if (currentFetchId === fetchCallRef.current && mountedRef.current) {
        await dispatch(fetchAvailabilityFromFirestore());
      }
      if (mountedRef.current && currentFetchId === fetchCallRef.current) {
        setComponentState("loaded");
        setDataFreshness((prev) => prev + 1);
        console.log("[CarGrid] Data fetched successfully");
      }
    } catch (err) {
      console.error("[CarGrid] Fetch error:", err);
      if (mountedRef.current && currentFetchId === fetchCallRef.current) {
        setComponentState("error");
        setLoadingError(err instanceof Error ? err.message : "Failed to load vehicles");
      }
    }
  }, [dispatch, isQrScanStation, scannedCar, isVisible]);

  // Group cars by model
  const groupedByModel = useMemo(() => {
    if (!isVisible || availableCars.length === 0) return [];
    if (isQrScanStation && scannedCar) {
      return [{ model: scannedCar.model || "Scanned Car", cars: [scannedCar] }];
    }
    const groups = availableCars.reduce((acc, car) => {
      const key = car.model || "Unknown Model";
      if (!acc[key]) acc[key] = { model: key, cars: [] };
      if (acc[key].cars.length < 10) acc[key].cars.push(car);
      return acc;
    }, {} as Record<string, CarGroup>);
    return Object.values(groups).slice(0, 5);
  }, [availableCars, isVisible, isQrScanStation, scannedCar]);

  // Effect to trigger fetch when component becomes visible or enough time has passed
  useEffect(() => {
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }
    if (isVisible) {
      const now = Date.now();
      const EFFECT_COOLDOWN = 30000; // 30 seconds
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      if (componentState === "idle" || timeSinceLastFetch > EFFECT_COOLDOWN) {
        if (isQrScanStation && scannedCar) {
          setComponentState("loaded");
        } else {
          setComponentState("loading");
          fetchData();
        }
      }
    } else {
      visibilityTimeoutRef.current = setTimeout(() => {}, 300);
    }
    return () => {
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
    };
  }, [isVisible, componentState, isQrScanStation, scannedCar, fetchData]);

  // Set mounted flag and preload models on mount
  useEffect(() => {
    mountedRef.current = true;
    preloadCommonCarModels();
    return () => {
      mountedRef.current = false;
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
    };
  }, []);

  // Auto-select first available car if none is selected
  useEffect(() => {
    if (!isVisible || availableCars.length === 0 || selectedCarId || componentState !== "loaded") return;
    const isSelectedCarAvailable = availableCars.some((car) => car.id === selectedCarId);
    if (!selectedCarId || !isSelectedCarAvailable) {
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
      autoSelectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && availableCars.length > 0) {
          console.log("[CarGrid] Auto-selecting car:", availableCars[0].id);
          dispatch(selectCar(availableCars[0].id));
        }
      }, 300);
    }
    return () => {
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
    };
  }, [availableCars, selectedCarId, dispatch, isVisible, componentState]);

  if (!isVisible) return null;
  if (componentState === "loading" && !isQrScanStation) return <LoadingSkeleton />;
  if (componentState === "error")
    return (
      <div className="rounded-lg border border-red-800 bg-gray-900/50 backdrop-blur-sm p-3 flex items-center justify-center h-32">
        <div className="text-center">
          <p className="text-red-400 text-sm">{loadingError || "Failed to load vehicles"}</p>
        </div>
      </div>
    );

  return (
    <div className={className} ref={containerRef}>
      {groupedByModel.length > 0 ? (
        <div className="py-1">
          <AnimatePresence>
            {groupedByModel.map((group, index) => (
              <motion.div
                key={`${group.model}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <CarCardGroup
                  group={group}
                  isVisible={true}
                  rootRef={containerRef}
                  isQrScanStation={isQrScanStation}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState isQrScanStation={isQrScanStation} />
      )}
    </div>
  );
}

export default memo(CarGrid, (prev, next) => {
  return (
    prev.isVisible === next.isVisible &&
    prev.isQrScanStation === next.isQrScanStation &&
    prev.scannedCar === next.scannedCar
  );
});
