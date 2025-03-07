"use client";

import React, { memo, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
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
import { saveBookingDetails } from "@/store/bookingThunks"; // Fixed import from bookingThunks
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";
import {
  selectIsSignedIn,
  selectHasDefaultPaymentMethod,
} from "@/store/userSlice";
import { chargeUserForTrip } from "@/lib/stripe";
import { auth } from "@/lib/firebase";

// Dynamically import CarGrid for better code splitting
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: () => (
    <div className="h-40 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicles...</div>
    </div>
  ),
  ssr: false,
});

// PaymentSummary is your minimal UI for default PM + "Payment Methods" button
import { PaymentSummary } from "@/components/ui/PaymentComponents";

// Your TripSheet for step 5
import TripSheet from "./TripSheet";

// Import your actual WalletModal
import WalletModal from "@/components/ui/WalletModal";

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

// Memoized component to wrap CarGrid for better performance
const MemoizedCarGrid = memo(({ isVisible }: { isVisible: boolean }) => {
  // Only render when visible
  if (!isVisible) return null;
  
  return <CarGrid isVisible={isVisible} />;
});
MemoizedCarGrid.displayName = "MemoizedCarGrid";

function StationDetailComponent({
  activeStation,
  stations,
  onConfirmDeparture,
  onOpenSignIn,
  onDismiss,
}: StationDetailProps) {
  const dispatch = useAppDispatch();

  // Booking flow
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);

  // Possibly for dispatch details
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Auth + Payment
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);

  // Distinguish departure vs arrival flow
  const isDepartureFlow = step <= 2;

  // Local state to track if component is fully initialized
  const [isInitialized, setIsInitialized] = useState(false);
  
  // State to control the "WalletModal"
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  
  // Flag for lazy-loading the CarGrid
  const [shouldLoadCarGrid, setShouldLoadCarGrid] = useState(false);
  
  // For showing a spinner on "Confirm Trip"
  const [charging, setCharging] = useState(false);

  // Ensure component is properly initialized on mount
  useEffect(() => {
    // Short delay to ensure all Redux state is properly loaded
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Initialize carGrid loading based on step and activeStation
  useEffect(() => {
    if (isDepartureFlow && step === 2 && activeStation) {
      setShouldLoadCarGrid(true);
    } else {
      // Give time for exit animations before unloading
      const timer = setTimeout(() => {
        setShouldLoadCarGrid(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isDepartureFlow, step, activeStation]);

  // If step 5 => show TripSheet exclusively (blocking background)
  if (step === 5) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40 pointer-events-auto" />
        <div className="fixed inset-0 z-50 flex flex-col">
          <TripSheet />
        </div>
      </>
    );
  }

  // If component not initialized yet, show loading state
  if (!isInitialized) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If no station selected at step 2 or 4 => show fallback
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

  // The "Confirm Trip" logic
  const handleConfirm = async () => {
    if (isDepartureFlow && step === 2) {
      // Step 2 => next is step 3
      dispatch(advanceBookingStep(3));
      
      // Save booking state to persist it
      dispatch(saveBookingDetails());
      
      toast.success("Departure station confirmed! Now select your arrival station.");
      onConfirmDeparture?.();
      return;
    }

    if (!isDepartureFlow && step === 4) {
      // Step 4 => finalize arrival
      if (!isSignedIn) {
        onOpenSignIn();
        return;
      }
      if (!hasDefaultPaymentMethod) {
        toast.error("Please add/set a default payment method first.");
        return;
      }
      try {
        setCharging(true);
        // $50 => pass 5000 (cents)
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result.success) {
          throw new Error(result.error || "Charge failed");
        }
        
        // Advance to step 5
        dispatch(advanceBookingStep(5));
        
        // Save booking state to persist it
        dispatch(saveBookingDetails());
        
        toast.success("Trip booked! Starting fare of HK$50 charged.");
      } catch (err) {
        console.error("Failed to charge trip =>", err);
        toast.error("Payment failed. Please try again or check your card.");
      } finally {
        setCharging(false);
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

      {/* Show CarGrid for the departure flow at step 2 with AnimatePresence for mounting/unmounting */}
      <AnimatePresence>
        {isDepartureFlow && step === 2 && (
          <motion.div 
            className="py-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {shouldLoadCarGrid && <MemoizedCarGrid isVisible={true} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* If user is signed in & step === 4 => show PaymentSummary above Confirm */}
      {step === 4 && isSignedIn && (
        <PaymentSummary onOpenWalletModal={() => setWalletModalOpen(true)} />
      )}

      {/* Confirm button (with spinner if charging) */}
      <div className="pt-3">
        <button
          onClick={handleConfirm}
          disabled={charging || !(step === 2 || step === 4)}
          className={cn(
            "w-full py-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
            "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50 disabled:cursor-not-allowed"
          )}
        >
          {charging ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
              Processing...
            </>
          ) : isDepartureFlow ? (
            "Choose Dropoff Station"
          ) : (
            "Confirm Trip"
          )}
        </button>
      </div>

      {/* Actually render the WalletModal here so that "onOpenWalletModal" works */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </motion.div>
  );
}

export default memo(StationDetailComponent);
