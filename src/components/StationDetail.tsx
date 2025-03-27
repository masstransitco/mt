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

// If you need CarGrid:
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: () => (
    <div className="h-32 w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center">
      <div className="text-xs text-gray-400">Loading vehicles...</div>
    </div>
  ),
  ssr: false,
})

// Simple info popup icon for tooltips
const InfoPopup = memo(function InfoPopup({ text }: { text: string }) {
  const [isVisible, setIsVisible] = React.useState(false)

  const handleShowInfo = React.useCallback(() => {
    setIsVisible(true)
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
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-[#2a2a2a] text-xs text-white w-48 text-center shadow-lg z-50"
        >
          {text}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#2a2a2a]" />
        </motion.div>
      )}
    </div>
  )
})
InfoPopup.displayName = "InfoPopup"

// Station stats block
const StationStats = memo(function StationStats({
  activeStation,
  isVirtualCarLocation
}: {
  activeStation: StationFeature
  isVirtualCarLocation?: boolean
}) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Status</span>
          <span className="font-medium text-[#10a37f]">Ready to Drive</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Departure Gate</span>
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

// Generic confirm button
function ConfirmButton({
  label,
  onConfirm,
  disabled,
  buttonClassName
}: {
  label: string
  onConfirm?: () => void
  disabled?: boolean
  buttonClassName?: string
}) {
  return (
    <motion.button
      onClick={() => onConfirm?.()}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full py-2.5 text-sm font-medium rounded-xl transition-colors flex items-center justify-center",
        buttonClassName
      )}
    >
      {label}
    </motion.button>
  )
}

// Props
export interface StationDetailProps {
  activeStation: StationFeature | null
  showCarGrid?: boolean
  onConfirm?: () => void
  isVirtualCarLocation?: boolean
  scannedCar?: Car | null
  confirmLabel?: string
}

function StationDetail({
  activeStation,
  showCarGrid = false,
  onConfirm,
  isVirtualCarLocation = false,
  scannedCar,
  confirmLabel = "Confirm"
}: StationDetailProps) {
  const bookingStep = useAppSelector(selectBookingStep)

  if (!activeStation) return null

  return (
    <motion.div
      className="p-3 space-y-3.5"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      {/* Removed the MapCard entirely */}

      {/* Station stats */}
      <StationStats activeStation={activeStation} isVirtualCarLocation={isVirtualCarLocation} />

      {/* Step 4: PaymentSummary; else CarGrid */}
      {bookingStep === 4 ? (
        <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
          <PaymentSummary
            onOpenWalletModal={() => {
              // do something
            }}
          />
        </div>
      ) : (
        showCarGrid && (
          <div className="bg-[#1a1a1a] rounded-xl p-3 shadow-md">
            <CarGrid className="w-full" isVisible scannedCar={scannedCar} />
          </div>
        )
      )}

      {/* Confirm button, if any */}
      {onConfirm &&
        (() => {
          let dynamicLabel = confirmLabel
          let dynamicClasses = ""

          if (bookingStep === 2) {
            dynamicLabel = "Pickup Car Here"
            dynamicClasses = "text-white bg-[#10a37f] hover:bg-[#0d8c6d] disabled:bg-[#10a37f]/40 disabled:cursor-not-allowed"
          } else if (bookingStep === 4) {
            dynamicLabel = "Confirm Trip"
            dynamicClasses = "text-white bg-[#276EF1] hover:bg-[#1d5bc9] disabled:bg-[#276EF1]/40 disabled:cursor-not-allowed"
          } else {
            dynamicClasses = "text-white bg-[#10a37f] hover:bg-[#0d8c6d] disabled:bg-[#10a37f]/40 disabled:cursor-not-allowed"
          }

          return (
            <ConfirmButton
              label={dynamicLabel}
              onConfirm={onConfirm}
              buttonClassName={dynamicClasses}
            />
          )
        })()}
    </motion.div>
  )
}

export default memo(StationDetail)