"use client";

import React, {
  memo,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  useRef,
} from "react";
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
  fetchRoute,
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
import { selectScannedCar } from "@/store/carSlice";
import TripSheet from "./TripSheet";
import WalletModal from "@/components/ui/WalletModal";
import PaymentResultModal from "@/components/ui/PaymentResultModal";

/** 
 * 1) Dynamically import PaymentSummary 
 *    so it only loads when step=4.
 */
const PaymentSummary = dynamic(
  () => import("@/components/ui/PaymentComponents").then((mod) => ({ default: mod.PaymentSummary })),
  {
    loading: () => <div className="text-sm text-gray-400">Loading payment...</div>,
    ssr: false,
  }
);

// --- A small fallback component for <Suspense> around MapCard --- //
function MapCardFallback() {
  return (
    <div className="h-52 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}

// --- Lazy-loaded components & fallbacks --- //
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading vehicles</div>;
    if (isLoading && pastDelay) {
      return (
        <div className="h-40 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      );
    }
    return null;
  },
  ssr: false,
});

const MapCard = dynamic(() => import("./MapCard"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading map</div>;
    if (isLoading && pastDelay) {
      return <MapCardFallback />;
    }
    return null;
  },
  ssr: false,
});

/** StationDetailProps interface */
interface StationDetailProps {
  activeStation: StationFeature | null;
  stations?: StationFeature[];
  onConfirmDeparture?: () => void;
  onOpenSignIn: () => void;
  onDismiss?: () => void;
  isQrScanStation?: boolean;
  onClose?: () => void; // We'll keep this if needed for programmatic close
  isMinimized?: boolean; // New prop to track sheet's minimized state
}

/** A small wrapper for CarGrid */
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
    <Suspense
      fallback={
        <div className="h-52 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      }
    >
      <CarGrid
        className="h-52 w-full"
        isVisible={isVisible}
        isQrScanStation={isQrScanStation}
        scannedCar={scannedCar}
      />
    </Suspense>
  );
});
MemoizedCarGrid.displayName = "MemoizedCarGrid";

/** A small stats panel for station info */
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
    isVirtualCarStation || activeStation.properties?.isVirtualCarLocation;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-700">
      {/* Show "Ready to Drive" if station is virtual */}
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

      {/* Step=2 => show walking distance if not a virtual station */}
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

      {/* Step=4 => driving time */}
      {step === 4 && driveTimeMin && (
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <span>Drive Time</span>
          </div>
          <span className="font-medium text-white">{driveTimeMin} min</span>
        </div>
      )}

      {/* Parking info */}
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
        isVirtualCarLocation ? "Start Driving Now" : "Choose Return"
      ) : (
        "Confirm Trip"
      )}
    </button>
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
  isMinimized = false, // Default to false
}: StationDetailProps) {
  const dispatch = useAppDispatch();

  // Redux states
  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);
  const scannedCarRedux = useAppSelector(selectScannedCar);

  // Flow booleans
  const isDepartureFlow = useMemo(() => step <= 2, [step]);

  // Local states
  const [isInitialized, setIsInitialized] = useState(true);
  const [attemptedRender, setAttemptedRender] = useState(true);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [shouldLoadCarGrid, setShouldLoadCarGrid] = useState(false);
  const [charging, setCharging] = useState(false);
  
  // For forcing refresh when sheet expands
  const [forceRefreshKey, setForceRefreshKey] = useState(0);
  
  // Payment result modal states
  const [paymentResultModalOpen, setPaymentResultModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  // Get stations by ID for the receipt or display
  const departureStation = useMemo(
    () => stations.find((s) => s.id === departureId) || null,
    [stations, departureId]
  );
  const arrivalStation = useMemo(
    () => stations.find((s) => s.id === arrivalId) || null,
    [stations, arrivalId]
  );

  // For the "Parking" label
  const parkingValue = useMemo(() => {
    if (step === 2) return "Touchless Exit";
    if (step === 4) return "Touchless Entry";
    return "";
  }, [step]);

  // Convert route duration => minutes
  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null;
    return Math.round(route.duration / 60).toString();
  }, [route, departureId, arrivalId]);

  // Identify if station is a "virtual" car location
  const isVirtualCarLocation = useMemo(
    () => !!activeStation?.properties?.isVirtualCarLocation,
    [activeStation]
  );

  // Debounce route fetching
  const routeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle sheet expansion => force a content refresh
  useEffect(() => {
    if (!isMinimized) {
      setForceRefreshKey((prev) => prev + 1);
      setIsInitialized(true);
      setAttemptedRender(true);

      // Force CarGrid to load if in step 2
      if (isDepartureFlow && step === 2 && activeStation) {
        setShouldLoadCarGrid(true);
      }

      // If step 3 or 4 => refetch route
      if (step >= 3 && departureId && arrivalId && stations.length > 0) {
        const depStation = stations.find((s) => s.id === departureId);
        const arrStation = stations.find((s) => s.id === arrivalId);
        if (depStation && arrStation) {
          dispatch(fetchRoute({ departure: depStation, arrival: arrStation }));
        }
      }
    }
  }, [
    isMinimized,
    isDepartureFlow,
    step,
    activeStation,
    departureId,
    arrivalId,
    stations,
    dispatch,
  ]);

  useEffect(() => {
    if (step >= 3 && departureId && arrivalId && stations.length > 0) {
      // Clear previous debounce
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
      // Only fetch if the sheet is expanded
      if (!isMinimized) {
        routeFetchTimeoutRef.current = setTimeout(() => {
          console.log("StationDetail fetching route:", departureId, arrivalId);
          const depStation = stations.find((s) => s.id === departureId);
          const arrStation = stations.find((s) => s.id === arrivalId);
          if (depStation && arrStation) {
            dispatch(fetchRoute({ departure: depStation, arrival: arrStation }));
          }
        }, 500);
      }
    }
    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [step, departureId, arrivalId, stations, dispatch, isMinimized]);

  // Show CarGrid in step=2
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

  // For QR station, forcibly load CarGrid at step=2
  useEffect(() => {
    if (isQrScanStation && step === 2) {
      setShouldLoadCarGrid(true);
    }
  }, [isQrScanStation, step]);

  // Payment modal open/close
  const handleOpenWalletModal = useCallback(() => {
    setWalletModalOpen(true);
  }, []);
  const handleCloseWalletModal = useCallback(() => {
    setWalletModalOpen(false);
  }, []);

  // Payment result modal steps
  const handlePaymentContinue = useCallback(() => {
    setPaymentResultModalOpen(false);
    if (paymentSuccess) {
      dispatch(advanceBookingStep(5));
      dispatch(saveBookingDetails());
    }
  }, [dispatch, paymentSuccess]);

  const handlePaymentRetry = useCallback(() => {
    setPaymentResultModalOpen(false);
  }, []);

  // Confirm button logic
  const handleConfirm = useCallback(async () => {
    // Step 2 => proceed to step 3 (choose arrival)
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3));
      if (isVirtualCarLocation) {
        toast.success("Car ready! Now select your dropoff station.");
      } else {
        toast.success("Departure station confirmed! Now choose your arrival station.");
      }
      onConfirmDeparture();
      return;
    }

    // Step 4 => handle payment
    if (!isDepartureFlow && step === 4) {
      if (!isSignedIn) {
        onOpenSignIn();
        return;
      }
      if (!hasDefaultPaymentMethod) {
        toast.error("Please add/set a default payment method first.");
        handleOpenWalletModal();
        return;
      }
      
      try {
        setCharging(true);
        // Example charge of $50 => 5000 cents
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        
        if (!result.success) {
          throw new Error(result.error || "Charge failed");
        }
        // Payment succeeded
        setPaymentSuccess(true);
        setPaymentReference(
          result.transactionId || "TXN" + Date.now().toString().slice(-8)
        );
        setCardLast4(result.cardLast4 || "4242");
        setPaymentResultModalOpen(true);
      } catch (err) {
        console.error("Failed to charge trip =>", err);
        setPaymentSuccess(false);
        setPaymentResultModalOpen(true);
      } finally {
        setCharging(false);
      }
    }
  }, [
    isDepartureFlow,
    step,
    isVirtualCarLocation,
    dispatch,
    onConfirmDeparture,
    isSignedIn,
    onOpenSignIn,
    hasDefaultPaymentMethod,
    handleOpenWalletModal,
  ]);

  // Possibly show an "estimated pickup time" if we have a dispatch route
  const estimatedPickupTime = useMemo(() => {
    if (isVirtualCarLocation || !dispatchRoute?.duration) return null;
    const now = new Date();
    const pickupTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
    const hh = pickupTime.getHours() % 12 || 12;
    const mm = pickupTime.getMinutes();
    const ampm = pickupTime.getHours() >= 12 ? "pm" : "am";
    return `${hh}:${mm < 10 ? "0" + mm : mm}${ampm}`;
  }, [isVirtualCarLocation, dispatchRoute]);

  // If user is already in final step (5), show TripSheet
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

  // If we want a loading spinner until fully loaded
  if (!isInitialized) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If we attempted to render but have no activeStation
  if (!activeStation && attemptedRender) {
    console.error(
      "StationDetail attempted to render but activeStation is null",
      "departureId:", departureId,
      "arrivalId:", arrivalId,
      "isQrScanStation:", isQrScanStation
    );
  }

  // If truly no station, fallback UI
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

  // Use forceRefreshKey to force remount of the component
  return (
    <>
      <motion.div
        key={`station-detail-${forceRefreshKey}`}
        className="p-4 space-y-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "tween", duration: 0.2 }}
      >
        {/* Map preview */}
        <Suspense fallback={<MapCardFallback />}>
          <MapCard
            coordinates={[
              activeStation.geometry.coordinates[0],
              activeStation.geometry.coordinates[1],
            ]}
            name={activeStation.properties.Place}
            address={activeStation.properties.Address}
            className="mt-0 mb-2 h-52 w-full"
          />
        </Suspense>

        {/* If step=2 and not virtual => show an estimated pickup time */}
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

        {/* CarGrid + Confirm Button for step=2 with reduced space between */}
        {isDepartureFlow && step === 2 && (
          <div className="space-y-1">
            {(shouldLoadCarGrid || isVirtualCarLocation) && (
              <MemoizedCarGrid
                isVisible
                isQrScanStation={isQrScanStation}
                scannedCar={scannedCarRedux}
              />
            )}
            <ConfirmButton
              isDepartureFlow={isDepartureFlow}
              charging={charging}
              disabled={charging || !(step === 2 || step === 4)}
              onClick={handleConfirm}
              isVirtualCarLocation={isVirtualCarLocation}
            />
          </div>
        )}

        {/* PaymentSummary if step=4 and user is signed in */}
        {step === 4 && isSignedIn && (
          <div className="space-y-2">
            <PaymentSummary onOpenWalletModal={handleOpenWalletModal} />
            <ConfirmButton
              isDepartureFlow={isDepartureFlow}
              charging={charging}
              disabled={charging || !(step === 2 || step === 4)}
              onClick={handleConfirm}
              isVirtualCarLocation={isVirtualCarLocation}
            />
          </div>
        )}

        {/* Wallet/Payment Modal */}
        <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
      </motion.div>
      
      {/* Payment Result Modal */}
      <PaymentResultModal
        isOpen={paymentResultModalOpen}
        isSuccess={paymentSuccess}
        amount={5000} // e.g. HK$50.00 in cents
        referenceId={paymentReference}
        cardLast4={cardLast4}
        onContinue={handlePaymentContinue}
        onRetry={handlePaymentRetry}
        departureStation={departureStation?.properties.Place}
        arrivalStation={arrivalStation?.properties.Place}
      />
    </>
  );
}

export default memo(StationDetailComponent);