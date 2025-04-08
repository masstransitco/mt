"use client"

import { memo, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppSelector } from "@/store/store"
import { selectBookingStep } from "@/store/bookingSlice"
import type { StationFeature } from "@/store/stationsSlice"
import type { Car } from "@/types/cars"
import { PaymentSummary } from "@/components/ui/PaymentComponents"
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

// Lazy-load CarCard for scanned cars
const LazyCarCard = dynamic(() => import("./booking/CarCard"), {
  loading: () => (
    <div className="h-28 w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicle...</div>
    </div>
  ),
  ssr: false,
})

// Lazy-load the CarGrid
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: () => (
    <div className="h-32 w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicles...</div>
    </div>
  ),
  ssr: false,
})

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

/** Station details (contactless, gate label) */
const StationStats = memo(function StationStats({
  activeStation,
  bookingStep,
  isVirtualCarLocation,
}: {
  activeStation: StationFeature
  bookingStep: number
  isVirtualCarLocation?: boolean
}) {
  // Step 4 => "Arrival Gate", otherwise => "Departure Gate"
  const gateLabel = bookingStep === 4 ? "Arrival Gate" : "Departure Gate"

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Status</span>
          <span className="font-medium text-[#10a37f]">Ready to Drive</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">{gateLabel}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-white">Contactless</span>
            <InfoPopup text="Parking entry and exits are contactless." />
          </div>
        </div>
      )}
    </div>
  )
})
StationStats.displayName = "StationStats"

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

  if (!activeStation) return null

  // Click handler for step 4 confirm
  const handleConfirmClick = useCallback(() => {
    if (bookingStep === 4 && !isSignedIn) {
      onOpenSignInModal?.()
      return
    }
    onConfirm?.()
  }, [bookingStep, isSignedIn, onOpenSignInModal, onConfirm])

  // We only show a confirm button in step 4 now (no button at step 2)
  let showConfirmButton = false
  let dynamicLabel = confirmLabel
  let dynamicClasses = ""

  if (bookingStep === 4) {
    showConfirmButton = true
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
      {/* Station stats */}
      <StationStats
        activeStation={activeStation}
        bookingStep={bookingStep}
        isVirtualCarLocation={isVirtualCarLocation}
      />

      {/* If step 4 and signed in => PaymentSummary; else if step 2 => CarGrid, etc. */}
      {bookingStep === 4 && isSignedIn ? (
        <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
          <PaymentSummary onOpenWalletModal={() => {}} />
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
              <CarGrid className="w-full h-full" isVisible scannedCar={scannedCar} isQrScanStation={isVirtualCarLocation} />
            )}
          </div>
        )
      )}

      {/* Confirm button only appears in step 4 */}
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