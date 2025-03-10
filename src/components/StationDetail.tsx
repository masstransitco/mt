"use client";

import React, { memo, useState, useEffect, useMemo, useCallback, Suspense } from "react";
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
  clearDepartureStation,
  resetBookingFlow,
} from "@/store/bookingSlice";
import { saveBookingDetails } from "@/store/bookingThunks";
import { selectDispatchRoute } from "@/store/dispatchSlice";
import { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";
import {
  selectIsSignedIn,
  selectHasDefaultPaymentMethod,
} from "@/store/userSlice";
import { chargeUserForTrip } from "@/lib/stripe";
import { auth } from "@/lib/firebase";
/** NEW: clear out the scannedCar from Redux to allow user to re-scan in future **/
import { setScannedCar } from "@/store/carSlice";

// Loading fallback components
const LoadingFallback = () => (
  <div className="h-40 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
    <div className="text-xs text-gray-400">Loading vehicles...</div>
  </div>
);

const MapCardFallback = () => (
  <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

// Dynamically import CarGrid with improved loading handling
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading vehicles</div>;
    if (isLoading && pastDelay) return <LoadingFallback />;
    return null;
  },
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
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading map</div>;
    if (isLoading && pastDelay) return <MapCardFallback />;
    return null;
  },
  ssr: false,
});

interface StationDetailProps {
  activeStation: StationFeature | null;
  stations?: StationFeature[];
  onConfirmDeparture?: () => void;
  onOpenSignIn: () => void;
  onDismiss?: () => void;
  isQrScanStation?: boolean;
  /** Called when the entire detail panel is closed */
  onClose?: () => void;
}

// Memoized component to wrap CarGrid for better performance
const MemoizedCarGrid = memo(({ isVisible }: { isVisible: boolean }) => {
  if (!isVisible) return null;
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CarGrid isVisible={isVisible} />
    </Suspense>
  );
});
MemoizedCarGrid.displayName = "MemoizedCarGrid";

// Extract Station Stats to a separate component
const StationStats = memo(({ 
  activeStation, 
  step, 
  driveTimeMin,
  parkingValue,
  isVirtualCarStation
}: {
  activeStation: StationFeature;
  step: number;
  driveTimeMin: string | null;
  parkingValue: string;
  isVirtualCarStation: boolean;
}) => {
  // Decide if it's a virtual car location from props or station property
  const isVirtualCarLocation =
    isVirtualCarStation ||
    (activeStation.properties && activeStation.properties.isVirtualCarLocation === true);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
      {/* For virtual car stations, show "Ready to Drive" */}
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-green-400" />
            <span>Status</span>
          </div>
          <span className="font-medium text-green-400">Ready to Drive</span>
        </div>
      ) : activeStation.properties.waitTime ? (
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Est. Wait Time</span>
          </div>
          <span className="font-medium text-white">
            {activeStation.properties.waitTime} min
          </span>
        </div>
      ) : null}

      {step === 2 &&
        typeof activeStation.distance === "number" &&
        !isVirtualCarLocation && (
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
        <span className="font-medium text-white">
          {isVirtualCarLocation ? "Current Location" : parkingValue}
        </span>
      </div>
    </div>
  );
});
StationStats.displayName = "StationStats";

// Confirmation button component
const ConfirmButton = memo(({
  isDepartureFlow,
  charging,
  disabled,
  onClick,
  isVirtualCarLocation
}: {
  isDepartureFlow: boolean;
  charging: boolean;
  disabled: boolean;
  onClick: () => void;
  isVirtualCarLocation?: boolean;
}) => {
  return (
    <div className="pt-3">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full py-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
          "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50 disabled:cursor-not-allowed",
          isVirtualCarLocation && "bg-green-600 hover:bg-green-700"
        )}
      >
        {charging ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
            Processing...
          </>
        ) : isDepartureFlow ? (
          isVirtualCarLocation ? "Start Driving Now" : "Choose Dropoff Station"
        ) : (
          "Confirm Trip"
        )}
      </button>
    </div>
  );
});
ConfirmButton.displayName = "ConfirmButton";

function StationDetailComponent({
  activeStation,
  stations = [],
  onConfirmDeparture = () => {},
  onOpenSignIn = () => {},
  onDismiss = () => {},
  isQrScanStation = false,
  onClose = () => {},
}: StationDetailProps) {
  const dispatch = useAppDispatch();
  
  // Redux data we care about
  const {
    step,
    route,
    departureId,
    arrivalId,
    dispatchRoute,
    isSignedIn,
    hasDefaultPaymentMethod
  } = useAppSelector(state => ({
    step: selectBookingStep(state),
    route: selectRoute(state),
    departureId: selectDepartureStationId(state),
    arrivalId: selectArrivalStationId(state),
    dispatchRoute: selectDispatchRoute(state),
    isSignedIn: selectIsSignedIn(state),
    hasDefaultPaymentMethod: selectHasDefaultPaymentMethod(state)
  }));

  // Distinguish departure vs arrival flow
  const isDepartureFlow = useMemo(() => step <= 2, [step]);

  // Local UI state
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [shouldLoadCarGrid, setShouldLoadCarGrid] = useState(false);
  const [charging, setCharging] = useState(false);
  const [attemptedRender, setAttemptedRender] = useState(false);

  // For station stats
  const parkingValue = useMemo(
    () => (step === 2 ? "Touchless Exit" : step === 4 ? "Touchless Entry" : ""),
    [step]
  );
  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null;
    return Math.round(route.duration / 60).toString();
  }, [route, departureId, arrivalId]);

  // Is it a virtual car location?
  const isVirtualCarLocation = useMemo(() => {
    if (!activeStation) return isQrScanStation;
    return (
      activeStation.properties?.isVirtualCarLocation === true ||
      isQrScanStation
    );
  }, [activeStation, isQrScanStation]);

  // Basic mount initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
      setAttemptedRender(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Decide if we want to load the CarGrid
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isDepartureFlow && step === 2 && activeStation) {
      setShouldLoadCarGrid(true);
    } else {
      timer = setTimeout(() => {
        setShouldLoadCarGrid(false);
      }, 300);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isDepartureFlow, step, activeStation]);

  // If it's a QR station at step 2, forcibly load the CarGrid
  useEffect(() => {
    const isVirtual = activeStation?.properties?.isVirtualCarLocation === true;
    if ((isVirtual || isQrScanStation) && step === 2) {
      console.log("QR scanned car detected, forcing car grid to load");
      setShouldLoadCarGrid(true);
    }
  }, [activeStation, step, isQrScanStation]);

  // Show wallet modal
  const handleOpenWalletModal = useCallback(() => {
    setWalletModalOpen(true);
  }, []);
  const handleCloseWalletModal = useCallback(() => {
    setWalletModalOpen(false);
  }, []);

  // Handle closing the detail component
  const handleClose = useCallback(() => {
    // If this is a QR scan station, reset the flow back to step 1
    if (isQrScanStation || isVirtualCarLocation) {
      console.log("Closing QR-scan station detail => clearing departure + scannedCar");
      dispatch(clearDepartureStation());
      dispatch(setScannedCar(null)); // Clears the scanned car from Redux

      // Let parent know
      onClose();

      // Toast a small message
      toast("Scan the car's QR code again if you want to select this vehicle", {
        duration: 4000,
        position: "bottom-center",
        icon: "ℹ️",
        style: {
          background: "#3b82f6",
          color: "#ffffff",
        },
      });
    } else {
      // For a normal station, just close
      onClose();
    }
  }, [dispatch, isQrScanStation, isVirtualCarLocation, onClose]);

  // "Confirm" logic
  const handleConfirm = useCallback(async () => {
    if (isDepartureFlow && step === 2) {
      // Move on to selecting arrival station
      dispatch(advanceBookingStep(3));
      // No longer saving booking at step 2
      if (isVirtualCarLocation) {
        toast.success("Car ready! Now select your dropoff station.");
      } else {
        toast.success("Departure station confirmed! Now select your arrival station.");
      }
      onConfirmDeparture();
      return;
    }

    // If user is finishing step 4 => payment
    if (!isDepartureFlow && step === 4) {
      // Check sign-in status
      if (!isSignedIn) {
        onOpenSignIn();
        return;
      }
      // Check default payment method
      if (!hasDefaultPaymentMethod) {
        toast.error("Please add/set a default payment method first.");
        return;
      }
      try {
        setCharging(true);
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result.success) {
          throw new Error(result.error || "Charge failed");
        }
        
        dispatch(advanceBookingStep(5));
        // We only save booking details at step 5
        await dispatch(saveBookingDetails());
        
        toast.success("Trip booked! Starting fare of HK$50 charged.");
      } catch (err) {
        console.error("Failed to charge trip =>", err);
        toast.error("Payment failed. Please try again or check your card.");
      } finally {
        setCharging(false);
      }
    }
  }, [
    isDepartureFlow,
    step,
    isSignedIn,
    hasDefaultPaymentMethod,
    dispatch,
    onConfirmDeparture,
    onOpenSignIn,
    isVirtualCarLocation
  ]);

  // If it's step 5, we show the TripSheet as the final overlay
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

  // If we haven't inited yet, show a spinner
  if (!isInitialized) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If we tried to render but found no station
  if (!activeStation && attemptedRender) {
    console.error(
      "StationDetail attempted to render but activeStation is null",
      "departureId:", departureId, 
      "arrivalId:", arrivalId,
      "isQrScanStation:", isQrScanStation
    );
  }

  // If no station selected at step 2 or 4 => fallback
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

  // Calculate estimated pickup time if applicable (not for virtualCar)
const estimatedPickupTime = useMemo(() => {
  // If it's a virtual car location or there's no dispatchRoute/duration, return null
  if (isVirtualCarLocation || !dispatchRoute || !dispatchRoute.duration) {
    return null;
  }

  const now = new Date();
  const pickupTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
  const hours = pickupTime.getHours() % 12 || 12;
  const minutes = pickupTime.getMinutes();
  const ampm = pickupTime.getHours() >= 12 ? "pm" : "am";
  return `${hours}:${minutes < 10 ? "0" + minutes : minutes}${ampm}`;
}, [isVirtualCarLocation, dispatchRoute]);

  return (
    <motion.div
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Only show a close button for QR scanned stations if you want a top-right X */}
      {isQrScanStation && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800/50"
            aria-label="Close"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      <Suspense fallback={<MapCardFallback />}>
        <MapCard
          coordinates={[
            activeStation.geometry.coordinates[0],
            activeStation.geometry.coordinates[1],
          ]}
          name={activeStation.properties.Place}
          address={activeStation.properties.Address}
          className="mt-2 mb-2"
        />
      </Suspense>

      {/* If there's a non-virtual station at step 2, show estimated pickup time */}
      {step === 2 && !isVirtualCarLocation && estimatedPickupTime && (
        <div className="text-sm text-center bg-blue-600/20 rounded-md p-2 border border-blue-500/30">
          <span className="text-gray-200">Estimated car arrival: </span>
          <span className="font-medium text-white">{estimatedPickupTime}</span>
        </div>
      )}

      {/* Station Stats */}
      <StationStats
        activeStation={activeStation}
        step={step}
        driveTimeMin={driveTimeMin}
        parkingValue={parkingValue}
        isVirtualCarStation={isVirtualCarLocation}
      />

      {/* Show CarGrid for step 2 (departure) */}
      <AnimatePresence>
        {isDepartureFlow && step === 2 && (
          <motion.div 
            className="py-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {(shouldLoadCarGrid || isVirtualCarLocation) && (
              <MemoizedCarGrid isVisible={true} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* If user is signed in & step === 4 => show PaymentSummary */}
      {step === 4 && isSignedIn && (
        <PaymentSummary onOpenWalletModal={handleOpenWalletModal} />
      )}

      {/* Confirm button */}
      <ConfirmButton
        isDepartureFlow={isDepartureFlow}
        charging={charging}
        disabled={charging || !(step === 2 || step === 4)}
        onClick={handleConfirm}
        isVirtualCarLocation={isVirtualCarLocation}
      />

      {/* WalletModal */}
      <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
    </motion.div>
  );
}

export default memo(StationDetailComponent);
