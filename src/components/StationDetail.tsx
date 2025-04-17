"use client"

import { memo, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppSelector } from "@/store/store"
import { selectBookingStep, selectIsDateTimeConfirmed } from "@/store/bookingSlice"
import type { StationFeature } from "@/store/stationsSlice"
import type { Car } from "@/types/cars"
import { PaymentSummary } from "@/components/ui/PaymentComponents"
import FareDisplay from "@/components/ui/FareDisplay"
import React from "react"

// Lazy-load components
const CarPlate = dynamic(() => import("@/components/ui/CarPlate"), {
  loading: () => (
    <div className="h-16 w-full bg-[#1a1a1a] rounded-md flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading...</div>
    </div>
  ),
  ssr: false,
})

// Import our safe dynamic components
import { DynamicCarCardScene } from "@/components/booking/CarComponents"

// Loading placeholder component
const LoadingPlaceholder = ({ height = '280px', text = 'Loading...' }) => (
  <div 
    className="w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center"
    style={{ height }}
  >
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="w-6 h-6 border-2 border-white/10 border-t-green-500 rounded-full animate-spin" />
      <div className="text-xs text-gray-400">{text}</div>
    </div>
  </div>
);

// Safely lazy-load CarCard for scanned cars with safe import handling
const LazyCarCard = dynamic(
  async () => {
    // Only import on client side
    if (typeof window === 'undefined') {
      return { default: () => <LoadingPlaceholder /> };
    }
    try {
      return await import("./booking/CarCard");
    } catch (error) {
      console.error("Failed to load CarCard:", error);
      return { default: () => <LoadingPlaceholder text="Error loading vehicle" /> };
    }
  },
  {
    loading: () => <LoadingPlaceholder text="Loading vehicle..." />,
    ssr: false,
  }
);

// Simplified, safer loading for the CarGridWithScene component
const CarGridWithScene = dynamic(
  () => import("./booking/CarGridWithScene"),
  {
    loading: () => (
      <div className="w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center h-60">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-white/10 border-t-green-500 rounded-full animate-spin" />
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      </div>
    ),
    ssr: false,
  }
)

/** Tooltip icon that opens to the left */
const InfoPopup = memo(function InfoPopup({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false)

  const handleShowInfo = useCallback(() => {
    setIsVisible(true)
    // Auto-close after 3s
    setTimeout(() => setIsVisible(false), 3000)
  }, [])

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
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-full right-0 mb-2 px-3 py-2 rounded-md bg-[#2a2a2a] text-xs text-white w-48 text-left shadow-lg z-50"
        >
          {text}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-[#2a2a2a]" />
        </motion.div>
      )}
    </div>
  )
})
InfoPopup.displayName = "InfoPopup"


/** Generic confirm button */
function ConfirmButton({
  label,
  onConfirm,
  disabled,
  buttonClassName,
}: {
  label: string
  onConfirm?: () => void
  disabled?: boolean
  buttonClassName?: string
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onConfirm}
      disabled={disabled}
      className={cn(
        "w-full py-2.5 text-sm font-medium rounded-xl transition-colors flex items-center justify-center",
        buttonClassName
      )}
    >
      {label}
    </motion.button>
  )
}

/** StationDetail props */
export interface StationDetailProps {
  activeStation: StationFeature | null
  showCarGrid?: boolean
  onConfirm?: () => void
  isVirtualCarLocation?: boolean
  scannedCar?: Car | null
  confirmLabel?: string

  /** 
   * Needed for sign-in gating logic in step 4:
   *  - If not signed in, hide PaymentSummary
   *  - If user presses "Confirm Trip" while not signed in, open modal
   */
  isSignedIn?: boolean
  onOpenSignInModal?: () => void
}

/**
 * Primary StationDetail component
 */
function StationDetail({
  activeStation,
  showCarGrid = false,
  onConfirm,
  isVirtualCarLocation = false,
  scannedCar,
  confirmLabel = "Confirm",
  isSignedIn = false,
  onOpenSignInModal,
}: StationDetailProps) {
  const bookingStep = useAppSelector(selectBookingStep)
  const isDateTimeConfirmed = useAppSelector(selectIsDateTimeConfirmed)

  if (!activeStation) return null

  // Click handler for step 4 confirm
  const handleConfirmClick = useCallback(() => {
    if (bookingStep === 4 && !isSignedIn) {
      onOpenSignInModal?.()
      return
    }
    onConfirm?.()
  }, [bookingStep, isSignedIn, onOpenSignInModal, onConfirm])

  // We show confirm button in step 2 (to select station) and in step 4 (to confirm trip)
  let showConfirmButton = false
  let dynamicLabel = confirmLabel
  let dynamicClasses = ""

  if (bookingStep === 2) {
    showConfirmButton = true
    dynamicLabel = "PICKUP CAR HERE"
    dynamicClasses =
      "text-gray-900 bg-[#c4c4c4] btn-select-location disabled:opacity-50 disabled:cursor-not-allowed"
  } else if (bookingStep === 4) {
    // Only show confirm button if date/time have been confirmed
    showConfirmButton = isDateTimeConfirmed
    dynamicLabel = "Confirm Trip"
    dynamicClasses =
      "text-white bg-[#276EF1] hover:bg-[#1d5bc9] disabled:bg-[#276EF1]/40 disabled:cursor-not-allowed"
  }

  return (
    <motion.div
      className="p-3 space-y-3.5"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >

      {/* If step 4 and signed in => PaymentSummary; else if date/time confirmed => FareDisplay; else if step 2 => CarGrid, etc. */}
      {bookingStep === 4 && isSignedIn ? (
        <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
          <PaymentSummary onOpenWalletModal={() => {}} />
        </div>
      ) : bookingStep === 4 && isDateTimeConfirmed ? (
        <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md mb-4">
          <FareDisplay baseFare={50} currency="HKD" perMinuteRate={1} maxDailyFare={800} />
        </div>
      ) : (
        // For step 2 or other steps needing a vehicle list
        showCarGrid && (
          <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md h-auto">
            {isVirtualCarLocation && scannedCar ? (
              // Use CarCard for scanned car display
              <div className="w-full flex flex-col items-center space-y-4">
                <div className="text-sm text-[#10A37F] font-medium">QR Scanned Vehicle</div>
                
                {/* Import and use the CarCard component */}
                <div className="w-full h-full">
                  <LazyCarCard
                    car={scannedCar}
                    selected={true}
                    onClick={() => {}}
                    isVisible={true}
                    isQrScanStation={true}
                  />
                </div>
              </div>
            ) : (
              // Regular car grid for normal stations
              <CarGridWithScene className="w-full h-full" isVisible scannedCar={scannedCar} isQrScanStation={isVirtualCarLocation} />
            )}
          </div>
        )
      )}

      {/* Confirm button appears in step 2 or step 4 */}
      {showConfirmButton && (
        <ConfirmButton
          label={dynamicLabel}
          onConfirm={handleConfirmClick}
          buttonClassName={dynamicClasses}
        />
      )}
    </motion.div>
  )
}

export default memo(StationDetail)