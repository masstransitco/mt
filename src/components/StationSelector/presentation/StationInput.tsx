"use client";

import React from "react";
import { motion } from "framer-motion";
import { Maximize2, X, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStationSelector } from "../context/StationSelectorContext";
import StationIcon from "./StationIcon";
import AddressSearch from "./AddressSearch";
import type { StationFeature } from "@/store/stationsSlice";

interface StationInputProps {
  type: "departure" | "arrival";
  station: StationFeature | null;
  highlight: boolean;
  step: number;
  disabled?: boolean;
  placeholder: string;
  onExpand: () => void;
  onClear: () => void;
  onAddressSelect: (location: google.maps.LatLngLiteral) => void;
  onScan?: () => void;
  showActions?: boolean;
  isButtonDisabled?: boolean;
}

/**
 * Combined station input component with icon, search, and action buttons
 */
const StationInput = React.memo(({ 
  type,
  station,
  highlight,
  step,
  disabled = false,
  placeholder,
  onExpand,
  onClear,
  onAddressSelect,
  onScan,
  showActions = true,
  isButtonDisabled = false
}: StationInputProps) => {
  const { theme, inSheet } = useStationSelector();
  
  // Only show QR scan button for departure in early steps
  const showQrScan = type === "departure" && step <= 2 && !!onScan;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        ...theme.containerStyle,
        position: "relative",
        zIndex: type === "departure" ? 20 : 10,
      }}
      className={cn(
        "flex items-center gap-3 transition-all duration-300 rounded-xl",
        inSheet ? theme.sizes.CONTAINER_HEIGHT : theme.sizes.CONTAINER_HEIGHT,
        inSheet ? theme.sizes.CONTAINER_PADDING : theme.sizes.CONTAINER_PADDING,
        type === "departure" && station ? "border-b border-white/10" : "",
      )}
    >
      <StationIcon 
        type={type} 
        highlight={highlight} 
        step={step} 
      />
      
      <AddressSearch
        onAddressSelect={onAddressSelect}
        disabled={disabled}
        placeholder={placeholder}
        selectedStation={station}
        step={step}
      />

      {/* Action buttons (expand and clear) */}
      {showActions && (
        <>
          {/* QR scan button - only for departure */}
          {showQrScan && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onScan}
              className={cn(
                "apple-button flex-shrink-0 bg-[#10A37F]/20 hover:bg-[#10A37F]/30 rounded-full",
                inSheet ? theme.sizes.BUTTON_PADDING : theme.sizes.BUTTON_PADDING,
              )}
              type="button"
              aria-label="Scan QR code"
            >
              <Scan className={inSheet ? "w-3 h-3" : "w-3 h-3"} />
            </motion.button>
          )}
          
          {/* Only show expand/clear buttons if we have a station */}
          {station && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onExpand}
                className={cn(
                  "apple-button flex-shrink-0 bg-white/10 hover:bg-white/20 rounded-full",
                  inSheet ? theme.sizes.BUTTON_PADDING : theme.sizes.BUTTON_PADDING,
                )}
                type="button"
                aria-label={`Expand map for ${type}`}
              >
                <Maximize2 className={inSheet ? "w-3 h-3" : "w-3 h-3"} />
              </motion.button>

              <motion.button
                whileTap={isButtonDisabled ? {} : { scale: 0.9 }}
                onClick={onClear}
                className={cn(
                  "apple-button flex-shrink-0 bg-white/10 hover:bg-white/20 rounded-full",
                  inSheet ? theme.sizes.BUTTON_PADDING : theme.sizes.BUTTON_PADDING,
                  isButtonDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                )}
                type="button"
                aria-label={`Clear ${type}`}
                disabled={isButtonDisabled}
              >
                <X className={inSheet ? "w-3 h-3" : "w-3 h-3"} />
              </motion.button>
            </>
          )}
        </>
      )}
    </motion.div>
  );
});

StationInput.displayName = "StationInput";

export default StationInput;