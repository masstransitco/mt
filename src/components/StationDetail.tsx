"use client";

import React, { memo, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Clock, Footprints } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
  selectDepartureStationId,
  selectArrivalStationId,
  clearArrivalStation,
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";
import { selectIsSignedIn } from "@/store/userSlice";

// Custom icons
import { SteerWheel } from "@/components/ui/icons/SteerWheel";
import { Parking } from "@/components/ui/icons/Parking";

// Payment & Firebase
import { PaymentMethodCard } from "@/components/ui/PaymentComponents";
import { getSavedPaymentMethods, SavedPaymentMethod } from "@/lib/stripe";
import { auth } from "@/lib/firebase";

/** Dynamically import the MapCard */
const MapCard = dynamic(() => import("./MapCard"), {
  loading: () => (
    <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  ),
  ssr: false,
});

interface StationDetailProps {
  activeStation: StationFeature | null;
  stations?: StationFeature[];
  onConfirmDeparture?: () => void;
  onOpenSignIn: () => void;
  onOpenWalletModal?: () => void;
  onDismiss?: () => void; // Added onDismiss prop
}

function StationDetailComponent({
  activeStation,
  stations,
  onConfirmDeparture,
  onOpenSignIn,
  onOpenWalletModal,
  onDismiss,
}: StationDetailProps) {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  const isSignedIn = useAppSelector(selectIsSignedIn);
  const isDepartureFlow = step <= 2;

  // Track if component is being unmounted
  const unmountingRef = useRef(false);
  const isDismissingRef = useRef(false);

  // Payment UI (shown at step 4)
  const [showPaymentUI, setShowPaymentUI] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);

  // Handle clean dismissal to prevent app becoming unresponsive
  const handleSafeDismiss = useCallback(() => {
    if (unmountingRef.current || isDismissingRef.current) return;
    isDismissingRef.current = true;

    try {
      // If we're in step 4, clear arrival station first
      if (step === 4 && arrivalId) {
        dispatch(clearArrivalStation());
      }
    } catch (error) {
      console.error("Error during station cleanup:", error);
    }

    // Allow time for state to update before calling parent's onDismiss
    setTimeout(() => {
      if (onDismiss) {
        onDismiss();
      }
      // Reset after dismissal is complete
      setTimeout(() => {
        isDismissingRef.current = false;
      }, 100);
    }, 50);
  }, [dispatch, step, arrivalId, onDismiss]);

  // Initialize component correctly and handle cleanup
  useEffect(() => {
    unmountingRef.current = false;
    isDismissingRef.current = false;
    
    return () => {
      unmountingRef.current = true;
      // If we're unmounting during step 4, ensure the arrival station is cleared
      if (step === 4 && arrivalId) {
        try {
          dispatch(clearArrivalStation());
        } catch (e) {
          console.error("Error during unmount cleanup:", e);
        }
      }
    };
  }, [dispatch, step, arrivalId]);

  // Load payment methods if signed in & at step 4
  useEffect(() => {
    if (isSignedIn && step === 4 && showPaymentUI) {
      const user = auth.currentUser;
      if (!user) return;
      (async () => {
        const res = await getSavedPaymentMethods(user.uid);
        if (res.success && res.data) {
          setPaymentMethods(res.data);
        }
      })();
    }
  }, [isSignedIn, step, showPaymentUI]);

  // Auto-show Payment UI if user signs in at Step 4
  useEffect(() => {
    if (step === 4 && isSignedIn) {
      setShowPaymentUI(true);
    }
  }, [step, isSignedIn]);

  // For debugging
  useEffect(() => {
    console.log("[StationDetail] step=", step);
    if (stations?.length) {
      console.log("[StationDetail] stations array length=", stations.length);
    }
  }, [step, stations]);

  /**
   * Estimated arrival time to the departure station (step 2 -> station).
   */
  const estimatedPickupTime = useMemo(() => {
    if (!dispatchRoute?.duration) return null;
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
    const arrivalTimeEnd = new Date(arrivalTime.getTime() + 15 * 60 * 1000);

    const formatTime = (date: Date) => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      return `${hours}:${minutesStr}${ampm}`;
    };
    return {
      start: formatTime(arrivalTime),
      end: formatTime(arrivalTimeEnd),
    };
  }, [dispatchRoute?.duration]);

  // Grab the departure station name from step 2
  const departureStation = useMemo(() => {
    if (!stations || !departureId) return null;
    return stations.find((st) => st.properties.ObjectId === departureId) ?? null;
  }, [stations, departureId]);

  const departureStationName = departureStation?.properties?.Place ?? "";

  // If no station selected for the current step
  if (!activeStation) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-gray-300">
          {isDepartureFlow
            ? "Select a departure station from the map or list below."
            : "Select an arrival station from the map or list below."}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-gray-800/50 flex items-center gap-2 text-gray-300">
            <Parking className="w-4 h-4 text-blue-400" />
            <span>View parking</span>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Check availability</span>
          </div>
        </div>
      </div>
    );
  }

  // Step-based parking label
  const parkingValue =
    step === 2 ? "Touchless Exit" : step === 4 ? "Touchless Entry" : "";

  // Convert route duration to minutes if present
  const driveTimeMin =
    route && departureId && arrivalId
      ? Math.round(route.duration / 60).toString()
      : null;

  const handleConfirm = () => {
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3));
      toast.success("Departure station confirmed! Now select your arrival station.");
      onConfirmDeparture?.();
    } else if (!isDepartureFlow && step === 4) {
      if (!isSignedIn) {
        onOpenSignIn();
      } else {
        setShowPaymentUI(true);
      }
    }
  };

  const stationCoordinates: [number, number] = [
    activeStation.geometry.coordinates[0],
    activeStation.geometry.coordinates[1],
  ];

  return (
    <motion.div
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* MapCard */}
      <MapCard
        coordinates={stationCoordinates}
        name={activeStation.properties.Place}
        address={activeStation.properties.Address}
        className="mt-2 mb-2"
      />

      {/* Station stats card */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
        {/* Wait time if any */}
        {activeStation.properties.waitTime && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Est. Wait Time</span>
            </div>
            <span className="font-medium text-white">
              {activeStation.properties.waitTime} min
            </span>
          </div>
        )}

        {/* Step 2 => "Distance from You" (Footprints icon) */}
        {step === 2 && activeStation.distance !== undefined && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <Footprints className="w-4 h-4 text-blue-400" />
              <span>Distance from You</span>
            </div>
            <span className="font-medium text-white">
              {activeStation.distance.toFixed(1)} km
            </span>
          </div>
        )}

        {/* Step 4 => "Drive Time" (SteerWheel icon) */}
        {step === 4 && driveTimeMin && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <SteerWheel className="w-4 h-4 text-blue-400" />
              <span>Drive Time</span>
            </div>
            <span className="font-medium text-white">{driveTimeMin} min</span>
          </div>
        )}

        {/* Parking row */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Parking className="w-4 h-4 text-blue-400" />
            <span>Parking</span>
          </div>
          <span className="font-medium text-white">{parkingValue}</span>
        </div>
      </div>

      {/* Step 4: Payment UI inline if signed in and showPaymentUI */}
      {step === 4 && isSignedIn && showPaymentUI && (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
          {paymentMethods.length > 0 ? (
            <div className="space-y-3 mb-4">
              {paymentMethods.map((m) => (
                <PaymentMethodCard
                  key={m.id}
                  method={m}
                  onDelete={async () => {
                    toast("Delete not implemented");
                  }}
                  onSetDefault={async () => {
                    toast("Set default not implemented");
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No payment methods yet</p>
          )}

          {onOpenWalletModal && (
            <button
              onClick={onOpenWalletModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              <span>Add or Manage</span>
            </button>
          )}
        </div>
      )}

      {/* Confirm button */}
      <div className="pt-3">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4)}
          className={cn(
            "w-full py-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
            "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50",
            "disabled:cursor-not-allowed"
          )}
        >
          {isDepartureFlow ? "Choose Return Station" : "Confirm Trip"}
        </button>
      </div>
    </motion.div>
  );
}

export default memo(StationDetailComponent);
