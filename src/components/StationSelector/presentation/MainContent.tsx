"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStationSelector } from "../context/StationSelectorContext";
import StationInput from "./StationInput";
import InfoBar from "@/components/InfoBar";

/**
 * Main content component for the StationSelector
 */
const MainContent = React.memo(() => {
  const {
    inSheet,
    currentStep,
    departureStation,
    arrivalStation,
    departureId,
    arrivalId,
    highlightDeparture,
    highlightArrival,
    isAnimating,
    animatingStationId,
    onAddressSearch,
    onClearDeparture,
    onClearArrival,
    onScan,
    setDepartureMapExpanded,
    setArrivalMapExpanded,
  } = useStationSelector();
  
  // DateTimePicker visibility is now managed in GMap

  // Add a tiny upward adjustment specifically for step 4 when not in sheet
  const step4Adjustment = !inSheet && currentStep === 4 ? { marginTop: "-1.5px" } : {};

  return (
    <div
      className={cn(
        "station-selector relative w-full z-10",
        inSheet ? "pt-0 pb-0" : "px-4 pt-2 pb-1",
      )}
      style={step4Adjustment}
    >
      <div className="flex flex-col w-full select-none">
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "apple-container overflow-visible backdrop-blur-md w-full",
            inSheet ? "!min-h-0 !py-0" : "",
            "bg-black/90 border border-white/10 shadow-lg",
          )}
          style={{
            overscrollBehavior: "none",
            touchAction: "none",
            height: inSheet ? "auto" : undefined,
            position: "relative",
          }}
        >
          {/* If departure & arrival are the same, show error */}
          <AnimatePresence>
            {departureId && arrivalId && departureId === arrivalId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2 text-xs text-red-400 bg-red-900/20 border-b border-red-800/50"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Departure and arrival stations cannot be the same</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DEPARTURE input */}
          <StationInput
            type="departure"
            station={departureStation}
            highlight={highlightDeparture}
            step={currentStep}
            disabled={currentStep >= 3}
            placeholder="Where from?"
            onExpand={() => setDepartureMapExpanded(true)}
            onClear={onClearDeparture}
            onAddressSelect={onAddressSearch}
            showActions={currentStep <= 3}
            isButtonDisabled={isAnimating && animatingStationId === departureId}
            onScan={onScan}
          />

          {/* ARRIVAL input (only if step>=3) */}
          <AnimatePresence>
            {currentStep >= 3 && (
              <StationInput
                type="arrival"
                station={arrivalStation}
                highlight={highlightArrival}
                step={currentStep}
                disabled={currentStep < 3}
                placeholder="Where to?"
                onExpand={() => setArrivalMapExpanded(true)}
                onClear={onClearArrival}
                onAddressSelect={onAddressSearch}
                showActions={currentStep <= 4}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* InfoBar is now shown in GMap for consistency */}
      </div>
      
      {/* DateTimePicker overlay removed, now managed in GMap */}
    </div>
  );
});

MainContent.displayName = "MainContent";

export default MainContent;