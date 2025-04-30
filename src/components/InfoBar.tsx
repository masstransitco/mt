"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import DateTimeSelector from "@/components/DateTimeSelector";
import { SimplePickupTime } from "@/components/ui/PickupTime";
import { useAppSelector } from "@/store/store";
import { selectDepartureDate, selectDepartureTime, selectIsDateTimeConfirmed } from "@/store/bookingSlice";
import { selectDispatchRoute } from "@/store/dispatchSlice";

/**
 * Info bar component showing distance and pickup time 
 * Now decoupled from StationSelector to be used in multiple places
 */
interface InfoBarProps {
  distanceInKm?: string | null;
  pickupMins?: number | null;
  currentStep?: number;
  inSheet?: boolean; 
  onDateTimePickerVisibilityChange?: (isVisible: boolean) => void;
  className?: string;
}

const InfoBar = React.memo(({ 
  distanceInKm, 
  pickupMins: externalPickupMins,
  currentStep = 1, 
  inSheet = false,
  onDateTimePickerVisibilityChange,
  className,
}: InfoBarProps) => {
  // Get scheduled date/time and confirmation status from Redux
  const departureDate = useAppSelector(selectDepartureDate);
  const departureTime = useAppSelector(selectDepartureTime);
  const isDateTimeConfirmed = useAppSelector(selectIsDateTimeConfirmed);
  
  // Get the dispatch route from Redux to calculate default pickup time
  const dispatchRoute = useAppSelector(selectDispatchRoute);

  // Calculate pickup minutes based on dispatch route if not provided externally
  const calculatedPickupMins = useMemo(() => {
    if (dispatchRoute?.duration) {
      const drivingMins = dispatchRoute.duration / 60;
      return Math.ceil(drivingMins + 15);
    }
    return null;
  }, [dispatchRoute]);
  
  // Use external pickup mins if provided, otherwise use calculated value
  const pickupMins = externalPickupMins !== undefined ? externalPickupMins : calculatedPickupMins;
  
  // Console log to debug what's happening with date/time values
  console.log('InfoBar rendering with:', {
    hasDate: !!departureDate,
    hasTime: !!departureTime,
    isConfirmed: isDateTimeConfirmed,
    effectivePickupMins: pickupMins,
    step: currentStep,
    departureDate: departureDate ? departureDate.toISOString() : null,
    departureTime: departureTime ? departureTime.toISOString() : null,
  });

  // State for picker visibility
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  // Notify parent when DateTimePicker visibility changes
  const updatePickerVisibility = (isVisible: boolean) => {
    setShowDateTimePicker(isVisible);
    onDateTimePickerVisibilityChange?.(isVisible);
  };

  // Handler for cancel
  const handleDateTimeCancel = () => {
    updatePickerVisibility(false);
  };

  // Handle time confirmed callback
  const handleTimeConfirmed = () => {
    updatePickerVisibility(false);
  };

  return (
    <div 
      className={cn(
        "flex items-center justify-end flex-wrap gap-2 w-full", 
        inSheet ? "mt-1 mx-4" : "mt-2", 
        className
      )}
    >
      <div className="flex items-center flex-wrap gap-2">
        {/* Pickup time indicator/button shown in steps 2, 3, and 4 */}
        {(currentStep === 2 || currentStep === 3 || currentStep === 4) && (
          <>
            {/* Always make the InfoBar clickable to open DateTimeSelector, regardless of state */}
            <div
              onClick={() => updatePickerVisibility(true)}
              className={cn(
                "apple-accent-button cursor-pointer hover:opacity-90 active:opacity-70",
                inSheet ? "py-1 px-2 text-sm" : "py-1 px-2.5 text-sm",
                isDateTimeConfirmed && departureDate && departureTime 
                  ? "bg-black/80 border border-green-600/30 text-white rounded-full"
                  : "bg-black/80 border border-white/20 text-white rounded-full"
              )}
            >
              {isDateTimeConfirmed && departureDate && departureTime ? (
                <span>✓ Pickup on {format(departureDate, 'MMM d')} at {format(departureTime, 'h:mm a')}</span>
              ) : pickupMins ? (
                <span>Pickup in {pickupMins} minutes</span>
              ) : (
                <span>Schedule pickup</span>
              )}
            </div>
          </>
        )}
        
        {/* Distance indicator */}
        {distanceInKm && (
          <div
            className={cn(
              "apple-accent-button",
              inSheet ? "py-1 px-2 text-sm" : "py-1 px-2.5 text-sm",
              "bg-black/80 border border-white/20 text-white rounded-full"
            )}
          >
            {distanceInKm} km
          </div>
        )}
      </div>

      {/* DateTimeSelector rendered centered */}
      {showDateTimePicker && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="w-full max-w-md px-4">
            <DateTimeSelector 
              onDateTimeConfirmed={handleTimeConfirmed}
              onCancel={handleDateTimeCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
});

InfoBar.displayName = "InfoBar";

export default InfoBar;