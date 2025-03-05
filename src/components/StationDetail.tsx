"use client";

import React, { memo, useEffect, useState, useRef } from "react";
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
} from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";
import {
  selectIsSignedIn,
  selectHasDefaultPaymentMethod,
} from "@/store/userSlice";

// Custom icons
import { SteerWheel } from "@/components/ui/icons/SteerWheel";
import { Parking } from "@/components/ui/icons/Parking";

// Payment & Firebase
import { PaymentMethodCard } from "@/components/ui/PaymentComponents";
import {
  getSavedPaymentMethods,
  SavedPaymentMethod,
  chargeUserForTrip,
} from "@/lib/stripe";
import { auth } from "@/lib/firebase";

// Import new TripSheet (shown at step 5)
import TripSheet from "./TripSheet";

/** Dynamically import the MapCard for step 2/4 display */
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
  onDismiss?: () => void;
}

/**
 * StationDetailComponent:
 * - Step 2 => Confirm departure station
 * - Step 4 => Confirm arrival, possibly charge the user
 * - Step 5 => show TripSheet (and block background)
 */
function StationDetailComponent({
  activeStation,
  stations,
  onConfirmDeparture,
  onOpenSignIn,
  onDismiss,
}: StationDetailProps) {
  const dispatch = useAppDispatch();

  // Booking flow state
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // Dispatch data (if any)
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Auth & Payment checks
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);

  // Distinguish between departure and arrival steps
  const isDepartureFlow = step <= 2;

  // Payment UI (shown at step 4 if user is signed in but no default PM)
  const [showPaymentUI, setShowPaymentUI] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  // Track if component is mounted
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // If user is signed in at step 4 AND we want to show Payment UI, load user’s methods
  useEffect(() => {
    if (isSignedIn && step === 4 && showPaymentUI) {
      const user = auth.currentUser;
      if (!user) return;

      setPaymentMethodsLoading(true);
      (async () => {
        try {
          const res = await getSavedPaymentMethods(user.uid);
          if (!isMounted.current) return;
          if (res.success && res.data) {
            setPaymentMethods(res.data);
          }
        } catch (error) {
          console.error("[StationDetail] Error loading payment methods:", error);
        } finally {
          if (isMounted.current) {
            setPaymentMethodsLoading(false);
          }
        }
      })();
    }
  }, [isSignedIn, step, showPaymentUI]);

  // Auto-show Payment UI if user is signed in at step 4 but has no default PM
  useEffect(() => {
    if (step === 4 && isSignedIn && !hasDefaultPaymentMethod) {
      setShowPaymentUI(true);
    }
  }, [step, isSignedIn, hasDefaultPaymentMethod]);

  /**
   * handleConfirm - triggered by "Confirm Trip" button in step 2/4
   */
  const handleConfirm = async () => {
    if (isDepartureFlow && step === 2) {
      // Step 2 => finalizing departure station => move to step 3
      dispatch(advanceBookingStep(3));
      toast.success("Departure station confirmed! Now select your arrival station.");
      onConfirmDeparture?.();
      return;
    }

    if (!isDepartureFlow && step === 4) {
      // Step 4 => confirm arrival, do the $50 transaction if possible
      if (!isSignedIn) {
        onOpenSignIn();
        return;
      }
      if (!hasDefaultPaymentMethod) {
        setShowPaymentUI(true);
        return;
      }

      // If user is signed in & has default PM => attempt $50 charge
      try {
        // Stripe expects smallest currency units => HK$50 => 5000
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result?.success) {
          throw new Error(result?.error || "Charge failed");
        }
        toast.success("Trip booked! Starting fare of HK$50 charged.");

        dispatch(advanceBookingStep(5));
      } catch (error) {
        console.error("[StationDetail] Error charging $50 =>", error);
        toast.error("Failed to charge initial fare. Try again or add a new card.");
      }
    }
  };

  // If we are at step 5, show TripSheet exclusively (and block background)
  if (step === 5) {
    return (
      <>
        {/* Dark overlay to block background interactions */}
        <div className="fixed inset-0 bg-black/50 z-40 pointer-events-auto" />
        {/* TripSheet pinned above */}
        <div className="fixed inset-0 z-50 flex flex-col">
          <TripSheet />
        </div>
      </>
    );
  }

  // If no station selected at step 2 or 4
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
        coordinates={[
          activeStation.geometry.coordinates[0],
          activeStation.geometry.coordinates[1],
        ]}
        name={activeStation.properties.Place}
        address={activeStation.properties.Address}
        className="mt-2 mb-2"
      />

      {/* Station Stats */}
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

        {/* Step 2 => "Distance from You" */}
        {step === 2 && typeof activeStation.distance === "number" && (
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

        {/* Step 4 => "Drive Time" */}
        {step === 4 && driveTimeMin && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <SteerWheel className="w-4 h-4 text-blue-400" />
              <span>Drive Time</span>
            </div>
            <span className="font-medium text-white">{driveTimeMin} min</span>
          </div>
        )}

        {/* Parking */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Parking className="w-4 h-4 text-blue-400" />
            <span>Parking</span>
          </div>
          <span className="font-medium text-white">{parkingValue}</span>
        </div>
      </div>

      {/* Payment UI (step 4, if user is signed in but no default PM) */}
      {step === 4 && isSignedIn && showPaymentUI && (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg px-4 py-4 space-y-3 border border-gray-700">
          {paymentMethodsLoading ? (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-3">
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
            <p className="text-sm text-gray-400">No payment methods yet</p>
          )}
        </div>
      )}

      {/* Confirm button */}
      <div className="pt-3">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4) || paymentMethodsLoading}
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
