"use client";

import { memo, useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Clock, Footprints, Info } from "lucide-react";
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
import type { StationFeature } from "@/store/stationsSlice";
import { cn } from "@/lib/utils";
import { selectIsSignedIn, selectHasDefaultPaymentMethod } from "@/store/userSlice";
import { chargeUserForTrip } from "@/lib/stripe";
import { auth } from "@/lib/firebase";
import { selectScannedCar } from "@/store/carSlice";
import TripSheet from "./TripSheet";
import WalletModal from "@/components/ui/WalletModal";
import PaymentResultModal from "@/components/ui/PaymentResultModal";

// Dynamically import PaymentSummary
const PaymentSummary = dynamic(
  () =>
    import("@/components/ui/PaymentComponents").then((mod) => ({
      default: mod.PaymentSummary,
    })),
  {
    loading: () => <div className="text-sm text-gray-400">Loading payment...</div>,
    ssr: false,
  }
);

// Map fallback component
function MapCardFallback() {
  return (
    <div className="h-44 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
}

// Lazy-loaded components
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading vehicles</div>;
    if (isLoading && pastDelay) {
      return (
        <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
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
    if (isLoading && pastDelay) return <MapCardFallback />;
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
  onClose?: () => void;
  isMinimized?: boolean;
}

/**
 * A memoized wrapper for CarGrid that delays rendering for smooth transitions.
 */
const MemoizedCarGrid = memo(function MemoizedCarGridWrapper({
  isVisible,
  isQrScanStation,
  scannedCar,
}: {
  isVisible: boolean;
  isQrScanStation?: boolean;
  scannedCar?: any;
}) {
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShouldRender(isVisible), isVisible ? 100 : 150);
    return () => clearTimeout(timer);
  }, [isVisible]);
  if (!isVisible && !shouldRender) return null;
  return (
    <Suspense
      fallback={
        <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      }
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
        <CarGrid className="h-32 w-full" isVisible={true} isQrScanStation={isQrScanStation} scannedCar={scannedCar} />
      </motion.div>
    </Suspense>
  );
});
MemoizedCarGrid.displayName = "MemoizedCarGrid";

/** InfoPopup component */
const InfoPopup = memo(function InfoPopup({
  text = "Parking entry and exits are contactless and requires no further payments.",
}: {
  text?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleShowInfo = useCallback(() => {
    setIsVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsVisible(false), 3000);
  }, []);
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  return (
    <div className="relative inline-flex items-center">
      <button onClick={handleShowInfo} className="text-gray-400 hover:text-gray-300 focus:outline-none" aria-label="More information">
        <Info size={14} />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-gray-800 text-xs text-white w-48 text-center shadow-lg z-50">
          <div className="relative">
            {text}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
});
InfoPopup.displayName = "InfoPopup";

/** StationStats component */
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
  const isVirtualCarLocation = isVirtualCarStation || activeStation.properties?.isVirtualCarLocation;
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 space-y-2 border border-gray-700">
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-green-400" />
            <span>Status</span>
          </div>
          <span className="font-medium text-green-400">Ready to Drive</span>
        </div>
      ) : activeStation.properties.waitTime ? (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Est. Wait Time</span>
          </div>
          <span className="font-medium text-white">{activeStation.properties.waitTime} min</span>
        </div>
      ) : null}
      {step === 2 && typeof activeStation.distance === "number" && !isVirtualCarLocation && (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Footprints className="w-3.5 h-3.5 text-blue-400" />
            <span>Distance from You</span>
          </div>
          <span className="font-medium text-white">{activeStation.distance.toFixed(1)} km</span>
        </div>
      )}
      {step === 4 && driveTimeMin && (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <span>Drive Time</span>
          </div>
          <span className="font-medium text-white">{driveTimeMin} min</span>
        </div>
      )}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5 text-gray-300">
          <span>Departure Gate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-white">{isVirtualCarLocation ? "Current Location" : "Contactless"}</span>
          {!isVirtualCarLocation && <InfoPopup />}
        </div>
      </div>
    </div>
  );
});
StationStats.displayName = "StationStats";

/** ConfirmButton component */
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
        "w-full py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
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

/** TouchScrollHandler hook */
function TouchScrollHandler() {
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.currentTarget.dataset.touchY = e.touches[0].clientY.toString();
  }
  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const height = el.clientHeight;
    const delta = e.touches[0].clientY - (el.dataset.touchY ? parseFloat(el.dataset.touchY) : 0);
    if ((scrollTop <= 0 && delta > 0) || (scrollTop + height >= scrollHeight && delta < 0)) {
      e.preventDefault();
    }
    el.dataset.touchY = e.touches[0].clientY.toString();
  }
  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    delete e.currentTarget.dataset.touchY;
  }
  return { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd };
}

/**
 * Main StationDetail component
 */
function StationDetailComponent({
  activeStation,
  stations = [],
  onConfirmDeparture = () => {},
  onOpenSignIn = () => {},
  onDismiss = () => {},
  isQrScanStation = false,
  onClose = () => {},
  isMinimized = false,
}: StationDetailProps) {
  const dispatch = useAppDispatch();

  const step = useAppSelector(selectBookingStep);
  const route = useAppSelector(selectRoute);
  const departureId = useAppSelector(selectDepartureStationId);
  const arrivalId = useAppSelector(selectArrivalStationId);
  const dispatchRoute = useAppSelector(selectDispatchRoute);
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod);
  const scannedCarRedux = useAppSelector(selectScannedCar);

  const isDepartureFlow = useMemo(() => step <= 2, [step]);

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [charging, setCharging] = useState(false);
  const [paymentResultModalOpen, setPaymentResultModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  // Control CarGrid visibility
  const [carGridVisible, setCarGridVisible] = useState(false);
  const lastRenderTimeRef = useRef(0);

  const touchScrollHandlers = TouchScrollHandler();

  const departureStation = useMemo(() => stations.find((s) => s.id === departureId) || null, [stations, departureId]);
  const arrivalStation = useMemo(() => stations.find((s) => s.id === arrivalId) || null, [stations, arrivalId]);

  const parkingValue = useMemo(() => (step === 2 || step === 4 ? "Contactless" : ""), [step]);

  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null;
    return Math.round(route.duration / 60).toString();
  }, [route, departureId, arrivalId]);

  const isVirtualCarLocation = useMemo(() => !!activeStation?.properties?.isVirtualCarLocation, [activeStation]);

  // Debounced route fetching when sheet is expanded
  const routeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isMinimized && step >= 3 && departureId && arrivalId && stations.length > 0) {
      if (routeFetchTimeoutRef.current) clearTimeout(routeFetchTimeoutRef.current);
      routeFetchTimeoutRef.current = setTimeout(() => {
        const depStation = stations.find((s) => s.id === departureId);
        const arrStation = stations.find((s) => s.id === arrivalId);
        if (depStation && arrStation) {
          dispatch(fetchRoute({ departure: depStation, arrival: arrStation }));
        }
      }, 500);
    }
    return () => {
      if (routeFetchTimeoutRef.current) clearTimeout(routeFetchTimeoutRef.current);
    };
  }, [isMinimized, step, departureId, arrivalId, stations, dispatch]);

  // Control CarGrid visibility (single effect)
  useEffect(() => {
    const shouldShow =
      !isMinimized &&
      isDepartureFlow &&
      step === 2 &&
      (!!activeStation || isQrScanStation);
    const timer = setTimeout(() => setCarGridVisible(shouldShow), shouldShow ? 100 : 150);
    return () => clearTimeout(timer);
  }, [isMinimized, isDepartureFlow, step, activeStation, isQrScanStation]);

  // Payment modal handlers
  const handleOpenWalletModal = useCallback(() => setWalletModalOpen(true), []);
  const handleCloseWalletModal = useCallback(() => setWalletModalOpen(false), []);

  const handlePaymentContinue = useCallback(() => {
    setPaymentResultModalOpen(false);
    if (paymentSuccess) {
      dispatch(advanceBookingStep(5));
      dispatch(saveBookingDetails());
    }
  }, [dispatch, paymentSuccess]);

  const handlePaymentRetry = useCallback(() => setPaymentResultModalOpen(false), []);

  const handleConfirm = useCallback(async () => {
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3));
      toast.success(
        isVirtualCarLocation
          ? "Car ready! Now select your dropoff station."
          : "Departure station confirmed! Now choose your arrival station."
      );
      onConfirmDeparture();
      return;
    }
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
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000);
        if (!result.success) throw new Error(result.error || "Charge failed");
        setPaymentSuccess(true);
        setPaymentReference(result.transactionId || "TXN" + Date.now().toString().slice(-8));
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

  const estimatedPickupTime = useMemo(() => {
    if (isVirtualCarLocation || !dispatchRoute?.duration) return null;
    const now = new Date();
    const pickupTime = new Date(now.getTime() + dispatchRoute.duration * 1000);
    const hh = pickupTime.getHours() % 12 || 12;
    const mm = pickupTime.getMinutes();
    const ampm = pickupTime.getHours() >= 12 ? "pm" : "am";
    return `${hh}:${mm < 10 ? "0" + mm : mm}${ampm}`;
  }, [isVirtualCarLocation, dispatchRoute]);

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

  if (!activeStation) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-300">
          {isDepartureFlow
            ? "Select a departure station from the map or list below."
            : "Select an arrival station from the map or list below."}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-gray-800/50 flex items-center gap-1.5 text-gray-300">
            <span>View parking</span>
          </div>
          <div className="p-2 rounded-lg bg-gray-800/50 flex items-center gap-1.5 text-gray-300">
            <span>Check availability</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="p-3 space-y-2 overscroll-contain"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "tween", duration: 0.2 }}
        {...touchScrollHandlers}
      >
        <Suspense fallback={<MapCardFallback />}>
          <div className="pointer-events-auto">
            <MapCard
              coordinates={[activeStation.geometry.coordinates[0], activeStation.geometry.coordinates[1]]}
              name={activeStation.properties.Place}
              address={activeStation.properties.Address}
              className="mt-0 mb-1.5 h-44 w-full"
            />
          </div>
        </Suspense>
        <div className="pointer-events-auto">
          <StationStats
            activeStation={activeStation}
            step={step}
            driveTimeMin={driveTimeMin}
            parkingValue={parkingValue}
            isVirtualCarStation={isVirtualCarLocation}
          />
        </div>
        {isDepartureFlow && step === 2 && (
          <div className="space-y-3 pointer-events-auto">
            <MemoizedCarGrid isVisible={carGridVisible} isQrScanStation={isQrScanStation} scannedCar={scannedCarRedux} />
            <ConfirmButton
              isDepartureFlow={isDepartureFlow}
              charging={charging}
              disabled={charging || !(step === 2 || step === 4)}
              onClick={handleConfirm}
              isVirtualCarLocation={isVirtualCarLocation}
            />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-1.5 pointer-events-auto">
            {isSignedIn ? (
              <>
                <PaymentSummary onOpenWalletModal={handleOpenWalletModal} />
                <ConfirmButton
                  isDepartureFlow={isDepartureFlow}
                  charging={charging}
                  disabled={charging || !(step === 2 || step === 4)}
                  onClick={handleConfirm}
                  isVirtualCarLocation={isVirtualCarLocation}
                />
              </>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="w-full py-2.5 text-sm font-medium rounded-md transition-colors text-white bg-blue-500/80 hover:bg-blue-600/80 flex items-center justify-center"
              >
                Sign In
              </button>
            )}
          </div>
        )}
        <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
      </motion.div>
      <PaymentResultModal
        isOpen={paymentResultModalOpen}
        isSuccess={paymentSuccess}
        amount={5000}
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
