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

// Payment & Firebase
import { chargeUserForTrip } from "@/lib/stripe";
import { auth } from "@/lib/firebase";

// New PaymentSummary
import { PaymentSummary } from "@/components/ui/PaymentComponents";

/** Dynamically import the MapCard for step 2/4 display */
const MapCard = dynamic(() => import("./MapCard"), {
  loading: () => (
    <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  ),
  ssr: false,
});

// Import TripSheet for step 5
import TripSheet from "./TripSheet";

interface StationDetailProps {
  activeStation: StationFeature | null;
  stations?: StationFeature[];
  onConfirmDeparture?: () => void;
  onOpenSignIn: () => void;
  onDismiss?: () => void;
}

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

  // Dispatch data
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Auth & PM checks
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);

  // Distinguish departure vs arrival flow
  const isDepartureFlow = step <= 2;

  // State for controlling WalletModal. We’ll pass a stub for demonstration.
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // If step 5 => show TripSheet exclusively
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
            <span>View parking</span>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 flex items-center gap-2 text-gray-300">
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

  // Confirm button logic
  const handleConfirm = async () => {
    // Step 2 => finalize departure
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3));
      toast.success("Departure station confirmed! Now select your arrival station.");
      onConfirmDeparture?.();
      return;
    }

    // Step 4 => finalize arrival
    if (!isDepartureFlow && step === 4) {
      if (!isSignedIn) {
        onOpenSignIn();
        return;
      }
      if (!hasDefaultPaymentMethod) {
        // user has no default => might open wallet or just show error
        toast.error("Please add/set a default payment method first.");
        return;
      }
      try {
        // $50 => pass 5000 (cents)
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result.success) {
          throw new Error(result.error || "Charge failed");
        }
        toast.success("Trip booked! Starting fare of HK$50 charged.");
        dispatch(advanceBookingStep(5));
      } catch (err) {
        console.error("Failed to charge trip =>", err);
        toast.error("Payment failed. Please try again or check your card.");
      }
    }
  };

  return (
    <motion.div
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Map */}
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

        {step === 4 && driveTimeMin && (
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <span>Drive Time</span>
            </div>
            <span className="font-medium text-white">{driveTimeMin} min</span>
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <span>Parking</span>
          </div>
          <span className="font-medium text-white">{parkingValue}</span>
        </div>
      </div>

      {/* If user is signed in & step === 4 => show PaymentSummary above confirm */}
      {step === 4 && isSignedIn && (
        <PaymentSummary onOpenWalletModal={() => setWalletModalOpen(true)} />
      )}

      {/* Confirm button */}
      <div className="pt-3">
        <button
          onClick={handleConfirm}
          disabled={!(step === 2 || step === 4)}
          className={cn(
            "w-full py-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
            "text-white bg-blue-600 hover:bg-blue-700"
          )}
        >
          {isDepartureFlow ? "Choose Return Station" : "Confirm Trip"}
        </button>
      </div>

      {/* You might conditionally render your WalletModal here if walletModalOpen */}
      {/* <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} /> */}
    </motion.div>
  );
}

export default memo(StationDetailComponent);
