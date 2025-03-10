"use client";

import React, {
  memo,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from "react";
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
import { setScannedCar, selectScannedCar } from "@/store/carSlice";

// Lazy loads, fallbacks, etc.
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

// Dynamically import CarGrid
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading vehicles</div>;
    if (isLoading && pastDelay) return <LoadingFallback />;
    return null;
  },
  ssr: false,
});

import { PaymentSummary } from "@/components/ui/PaymentComponents";
import TripSheet from "./TripSheet";
import WalletModal from "@/components/ui/WalletModal";

// Dynamically import MapCard
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
  onClose?: () => void;
}

// A small wrapper for CarGrid
const MemoizedCarGrid = memo(function MemoizedCarGridWrapper({
  isVisible,
  isQrScanStation,
  scannedCar,
}: {
  isVisible: boolean;
  isQrScanStation?: boolean;
  scannedCar?: any;
}) {
  if (!isVisible) return null;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CarGrid
        isVisible={isVisible}
        isQrScanStation={isQrScanStation}
        scannedCar={scannedCar}
      />
    </Suspense>
  );
});
MemoizedCarGrid.displayName = "MemoizedCarGrid";

/** StationStats for display */
const StationStats = memo(function StationStats({
  activeStation,
  step,
  driveTimeMin,
  parkingValue,
  isVirtualCarStation,
}: {
  activeStation: StationFeature;
  step: number;
  driveTimeMin: string | null;
  parkingValue: string;
  isVirtualCarStation: boolean;
}) {
  const isVirtualCarLocation =
    isVirtualCarStation ||
    (activeStation.properties?.isVirtualCarLocation === true);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
      {/* For a virtual car station, show Ready to Drive */}
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

/** Confirm button for step 2 or 4 */
const ConfirmButton = memo(function ConfirmButton({
  isDepartureFlow,
  charging,
  disabled,
  onClick,
  isVirtualCarLocation,
}: {
  isDepartureFlow: boolean;
  charging: boolean;
  disabled: boolean;
  onClick: () => void;
  isVirtualCarLocation?: boolean;
}) {
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

  // Step & state from Redux
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);

  // If you stored scannedCar in Redux:
  const scannedCarRedux = useAppSelector(selectScannedCar);

  const isDepartureFlow = useMemo(() => step <= 2, [step]);

  // Local UI states
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [shouldLoadCarGrid, setShouldLoadCarGrid] = useState(false);
  const [charging, setCharging] = useState(false);
  const [attemptedRender, setAttemptedRender] = useState(false);

  const parkingValue = useMemo(() => {
    if (step === 2) return "Touchless Exit";
    if (step === 4) return "Touchless Entry";
    return "";
  }, [step]);

  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null;
    return Math.round(route.duration / 60).toString();
  }, [route, departureId, arrivalId]);

  // If this station is a virtual "car" location or if we explicitly are in QR scan mode
  const isVirtualCarLocation = useMemo(() => {
    if (!activeStation) return isQrScanStation;
    return (
      activeStation.properties?.isVirtualCarLocation === true ||
      isQrScanStation
    );
  }, [activeStation, isQrScanStation]);

  // Initialize once
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
      setAttemptedRender(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Decide if we want to load CarGrid
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

  // Also forcibly load if we’re in QR mode at step 2
  useEffect(() => {
    if (isQrScanStation && step === 2) {
      setShouldLoadCarGrid(true);
    }
  }, [isQrScanStation, step]);

  const handleOpenWalletModal = useCallback(() => {
    setWalletModalOpen(true);
  }, []);
  const handleCloseWalletModal = useCallback(() => {
    setWalletModalOpen(false);
  }, []);

  /** If parent forcibly closes detail (like user swiped down), handle cleaning up for QR. */
  const handleClose = useCallback(() => {
    // If it's a QR-station, reset departure + scannedCar
    if (isQrScanStation || isVirtualCarLocation) {
      dispatch(clearDepartureStation());
      dispatch(setScannedCar(null));
      onClose();
      toast("Scan the car's QR code again if you want to select this vehicle", {
        duration: 4000,
        position: "bottom-center",
        icon: "ℹ️",
        style: { background: "#3b82f6", color: "#ffffff" },
      });
    } else {
      onClose();
    }
  }, [dispatch, isQrScanStation, isVirtualCarLocation, onClose]);

  /** Confirm logic for step 2 or step 4 */
  const handleConfirm = useCallback(async () => {
    // Step 2 => user picking arrival next
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3));
      if (isVirtualCarLocation) {
        toast.success("Car ready! Now select your dropoff station.");
      } else {
        toast.success("Departure station confirmed! Now select your arrival station.");
      }
      onConfirmDeparture();
      return;
    }

    // Step 4 => finalize payment
    if (!isDepartureFlow && step === 4) {
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
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result.success) {
          throw new Error(result.error || "Charge failed");
        }

        dispatch(advanceBookingStep(5));
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
    isVirtualCarLocation,
    onConfirmDeparture,
    dispatch,
    isSignedIn,
    onOpenSignIn,
    hasDefaultPaymentMethod,
  ]);

  /** Possibly show an "estimated pickup time" for dispatch if not virtualCar */
  const estimatedPickupTime = useMemo(() => {
    if (isVirtualCarLocation || !dispatchRoute?.duration) return null;
    const now = new Date();
    const pickupTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
    const hh = pickupTime.getHours() % 12 || 12;
    const mm = pickupTime.getMinutes();
    const ampm = pickupTime.getHours() >= 12 ? "pm" : "am";
    return `${hh}:${mm < 10 ? "0" + mm : mm}${ampm}`;
  }, [isVirtualCarLocation, dispatchRoute]);

  // If user already in final step, show TripSheet
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

  if (!isInitialized) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If tried to render but no station
  if (!activeStation && attemptedRender) {
    console.error(
      "StationDetail attempted to render but activeStation is null",
      "departureId:", departureId,
      "arrivalId:", arrivalId,
      "isQrScanStation:", isQrScanStation
    );
  }

  // Fallback UI if no station
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

  // Normal UI
  return (
    <motion.div
      className="p-4 space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/*  No "X" button for isQrScanStation here, the parent calls onClose */}
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

      {/* if step=2 and not virtual => show dispatch pickup time */}
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

      {/* CarGrid if step=2 (departure) */}
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
              <MemoizedCarGrid
                isVisible
                // Now pass the needed props for QR flow
                isQrScanStation={isQrScanStation}
                scannedCar={scannedCarRedux} 
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PaymentSummary if step=4 and user is signed in */}
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

      <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
    </motion.div>
  );
}

export default memo(StationDetailComponent);
