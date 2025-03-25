"use client";

import { memo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/store";
import { selectBookingStep } from "@/store/bookingSlice";

// The same UI components you already had
import { PaymentSummary } from "@/components/ui/PaymentComponents"; // adjust path if needed

// Types
import type { StationFeature } from "@/store/stationsSlice";
import type { Car } from "@/types/cars";

// Lazy-load CarGrid
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: () => (
    <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicles...</div>
    </div>
  ),
  ssr: false,
});

// Optionally show a static map snippet for the station
const MapCard = dynamic(() => import("./MapCard"), {
  loading: () => (
    <div className="h-44 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  ),
  ssr: false,
});

/** Simple info popup icon for tooltips. */
const InfoPopup = memo(function InfoPopup({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false);

  const handleShowInfo = useCallback(() => {
    setIsVisible(true);
    setTimeout(() => setIsVisible(false), 3000);
  }, []);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleShowInfo}
        className="text-gray-400 hover:text-gray-300 focus:outline-none"
        aria-label="More information"
      >
        <Info size={14} />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-gray-800 text-xs text-white w-48 text-center shadow-lg z-50">
          {text}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
});
InfoPopup.displayName = "InfoPopup";

/** StationStats: small block with station info. */
const StationStats = memo(function StationStats({
  activeStation,
  isVirtualCarLocation,
}: {
  activeStation: StationFeature;
  isVirtualCarLocation?: boolean;
}) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 space-y-2 border border-gray-700">
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-300">Status</span>
          <span className="font-medium text-green-400">Ready to Drive</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-300">Departure Gate</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-white">Contactless</span>
            <InfoPopup text="Parking entry and exits are contactless." />
          </div>
        </div>
      )}
    </div>
  );
});
StationStats.displayName = "StationStats";

/** A simple confirm button. */
function ConfirmButton({
  label,
  onConfirm,
  disabled,
  buttonClassName,
}: {
  label: string;
  onConfirm?: () => void;
  disabled?: boolean;
  buttonClassName?: string;
}) {
  return (
    <button
      onClick={() => onConfirm?.()}
      disabled={disabled}
      className={cn(
        "w-full py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
        buttonClassName
      )}
    >
      {label}
    </button>
  );
}

/** StationDetail props */
export interface StationDetailProps {
  /** The currently viewed station, or null if none. */
  activeStation: StationFeature | null;
  /** Whether the CarGrid should show. */
  showCarGrid?: boolean;
  /** Called when user taps the 'Confirm' button. */
  onConfirm?: () => void;
  /** If this station is a special 'virtual' location. */
  isVirtualCarLocation?: boolean;
  /** Currently scanned car (if any). */
  scannedCar?: Car | null;
  /** Text for the confirm button. */
  confirmLabel?: string;
}

/**
 * StationDetail:
 * - Renders station info (map snippet, stats).
 * - Optionally shows a CarGrid if requested.
 * - Uses bookingStep from Redux for final-step fare/payment.
 */
function StationDetail({
  activeStation,
  showCarGrid = false,
  onConfirm,
  isVirtualCarLocation = false,
  scannedCar,
  confirmLabel = "Confirm",
}: StationDetailProps) {
  // Pull the bookingStep from Redux
  const bookingStep = useAppSelector(selectBookingStep);

  // If no station, simply render nothing.
  if (!activeStation) return null;

  return (
    <motion.div
      className="p-3 space-y-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "tween", duration: 0.2 }}
    >
      {/* Station map preview */}
      <MapCard
        coordinates={[
          activeStation.geometry.coordinates[0],
          activeStation.geometry.coordinates[1],
        ]}
        name={activeStation.properties.Place}
        address={activeStation.properties.Address}
        className="h-44 w-full"
      />

      {/* Station info/stats */}
      <StationStats
        activeStation={activeStation}
        isVirtualCarLocation={isVirtualCarLocation}
      />

      {/* Step 4: Show fare/payment; otherwise show CarGrid (if requested) */}
      {bookingStep === 4 ? (
        <PaymentSummary onOpenWalletModal={() => {
          // Implement or reference your wallet modal
        }} />
      ) : (
        showCarGrid && (
          <CarGrid
            className="h-32 w-full"
            isVisible={true}
            scannedCar={scannedCar}
          />
        )
      )}

      {/* Confirm button if there's an action to perform */}
      {onConfirm && (() => {
        let dynamicLabel = confirmLabel;
        let dynamicClasses = "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:cursor-not-allowed";

        if (bookingStep === 2) {
          dynamicLabel = "Pickup Car Here";
          dynamicClasses = "text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800/40 disabled:cursor-not-allowed";
        } else if (bookingStep === 4) {
          dynamicLabel = "Confirm Trip";
          // keep the original color
          dynamicClasses = "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:cursor-not-allowed";
        }

        return (
          <ConfirmButton
            label={dynamicLabel}
            onConfirm={onConfirm}
            buttonClassName={dynamicClasses}
          />
        );
      })()}
    </motion.div>
  );
}

export default memo(StationDetail);