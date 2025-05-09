"use client"

import { memo, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppSelector, useAppDispatch } from "@/store/store"
import { selectBookingStep, selectIsDateTimeConfirmed, advanceBookingStep } from "@/store/bookingSlice"
import type { StationFeature } from "@/store/stationsSlice"
import type { Car } from "@/types/cars"
import { PaymentSummary } from "@/components/ui/PaymentComponents"
import FareDisplay from "@/components/ui/FareDisplay"
import DateTimeSelector from "@/components/DateTimeSelector"
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
  const dispatch = useAppDispatch()
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)

  if (!activeStation) return null

  // Click handler for step 4 confirm
  const handleConfirmClick = useCallback(() => {
    if (bookingStep === 4 && !isSignedIn) {
      onOpenSignInModal?.()
      return
    }
    
    if (bookingStep === 2) {
      // In step 2, directly advance to step 3 
      // instead of opening DateTimeSelector
      dispatch(advanceBookingStep(3))
      onConfirm?.()
      return
    }
    
    onConfirm?.()
  }, [bookingStep, isSignedIn, onOpenSignInModal, onConfirm, dispatch])

  // Handle DateTimeSelector when user cancels
  const handleDateTimeCancel = () => {
    setShowDateTimePicker(false)
  }

  // Handle DateTimeSelector confirmation
  const handleDateTimeConfirmed = () => {
    setShowDateTimePicker(false)
    // After date/time selection is confirmed, advance to step 3
    dispatch(advanceBookingStep(3))
    // Call the parent's onConfirm callback if provided to ensure proper navigation
    onConfirm?.()
  }

  // We show confirm button in step 2 (to select station) and in step 4 (to confirm trip)
  let showConfirmButton = false
  let dynamicLabel = confirmLabel
  let dynamicClasses = ""

  if (bookingStep === 2) {
    // In step 2, always show the button
    showConfirmButton = true
    dynamicLabel = "PICKUP CAR HERE"
    dynamicClasses =
      "text-gray-900 bg-[#c4c4c4] btn-select-location disabled:opacity-50 disabled:cursor-not-allowed"
  } else if (bookingStep === 4) {
    // Always show confirm button in step 4
    showConfirmButton = true
    dynamicLabel = "Confirm Trip"
    dynamicClasses =
      "text-white bg-[#276EF1] hover:bg-[#1d5bc9] disabled:bg-[#276EF1]/40 disabled:cursor-not-allowed"
  }

  return (
    <motion.div 
      className={cn(
        "overflow-visible w-full",
        bookingStep === 2 && showCarGrid ? "space-y-2" : "space-y-3.5 px-4" // Remove vertical spacing for car grid
      )}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      <div className={cn(
        bookingStep === 2 && showCarGrid ? "px-0" : "px-0" // Handle padding differently based on content
      )}>
        {/* If step 4 => FareDisplay or PaymentSummary; else if step 2 => CarGrid, etc. */}
        {bookingStep === 4 ? (
          <>
            {/* Always show FareDisplay in step 4 for non-signed in users */}
            {!isSignedIn && (
              <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md mb-4">
                <FareDisplay baseFare={50} currency="HKD" perMinuteRate={1} maxDailyFare={800} />
              </div>
            )}
            
            {/* Always show PaymentSummary for signed in users */}
            {isSignedIn && (
              <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
                <PaymentSummary onOpenWalletModal={() => {}} />
              </div>
            )}
          </>
        ) : (
          // For step 2 or other steps needing a vehicle list
          showCarGrid && (
            <div className={cn(
              "w-full",
              bookingStep === 2 ? "pt-0" : "" // No padding top for step 2
            )}>
              {/* IMPORTANT: Create stable render paths with conditional rendering */}
              {/* For QR scanned car path - use a guaranteed stable rendering path with key */}
              {isVirtualCarLocation && scannedCar ? (
                <div key="qr-scanned-path" className="bg-[#1a1a1a] rounded-xl shadow-md overflow-hidden w-full mb-4 mx-4">
                  <div className="w-full flex flex-col items-center">
                    <div className="text-sm text-[#10A37F] font-medium my-2">QR Scanned Vehicle</div>
                    
                    {/* Import and use the CarCard component */}
                    <div className="w-full h-full">
                      {/* Ensure hooks are called in the same order by using a value prop 
                          instead of conditionally rendering the component */}
                      <LazyCarCard
                        car={scannedCar}
                        selected={true}
                        onClick={() => {}}
                        isVisible={true}
                        isQrScanStation={true}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Regular car grid for normal stations */
                <div 
                  key="regular-path"
                  className={cn(
                    "overflow-visible bg-[#111111] w-full",
                    bookingStep === 2 ? "mb-0 rounded-none" : "mb-4 mx-auto px-0 rounded-xl"
                  )}
                >
                  <CarGridWithScene 
                    className="w-full h-full" 
                    isVisible={true}
                    scannedCar={scannedCar} 
                    isQrScanStation={isVirtualCarLocation} 
                  />
                </div>
              )}
              
              {/* Confirm button always appears in step 2 for reliability */}
              {bookingStep === 2 && (
                <div className="mx-4 mt-4">
                  <ConfirmButton
                    label={dynamicLabel}
                    onConfirm={handleConfirmClick}
                    buttonClassName={dynamicClasses}
                  />
                  <p className="text-xs text-gray-400 text-center mt-2">
                    You can also schedule your pickup time from the time indicator above
                  </p>
                </div>
              )}
            </div>
          )
        )}

        {/* Confirm button always appears in step 4 - keep outside car grid wrapper */}
        {showConfirmButton && bookingStep === 4 && (
          <div className="mx-4 mt-4">
            <ConfirmButton
              label={dynamicLabel}
              onConfirm={handleConfirmClick}
              buttonClassName={dynamicClasses}
            />
          </div>
        )}
      </div>

      {/* DateTimeSelector rendered centered */}
      {showDateTimePicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="w-full max-w-md px-4">
            <DateTimeSelector 
              onDateTimeConfirmed={handleDateTimeConfirmed}
              onCancel={handleDateTimeCancel}
              autoAdvanceStep={true}
            />
          </div>
        </div>
      )}
      
      {/* Hide the rest of the content when DateTimePicker is visible */}
      {showDateTimePicker && (
        <div className="fixed inset-0 bg-transparent" style={{ zIndex: 40 }} />
      )}
    </motion.div>
  )
}

export default memo(StationDetail)