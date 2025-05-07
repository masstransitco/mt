"use client";

import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import { RouteIcon } from "@/components/ui/icons/RouteIcon";
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
  
  // Determine if we should default to quick pickup mode based on current state
  const shouldDefaultToQuickPickup = currentStep >= 2 && !isDateTimeConfirmed;
  
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
  
  // Always create a ref to document.body for portal rendering
  // This ensures consistent hook pattern even when portal is not shown
  const portalTargetRef = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

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

  // Determine which icon to show for pickup time
  const PickupIcon = useMemo(() => {
    return isDateTimeConfirmed && departureDate && departureTime ? Calendar : Clock;
  }, [isDateTimeConfirmed, departureDate, departureTime]);

  return (
    <div 
      className={cn(
        "flex items-center justify-start flex-wrap gap-2 w-full", 
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
                "cursor-pointer relative flex items-center justify-center gap-2",
                "text-xs text-zinc-900 font-medium",
                "px-3 py-1.5 h-[30px]",
                "border border-white/50 rounded-xl",
                "bg-white/90 backdrop-blur-md",
                "hover:bg-white hover:border-white",
                "transition-all duration-200 shadow-sm"
              )}
            >
              <PickupIcon className="w-3.5 h-3.5 text-zinc-900" />
              {isDateTimeConfirmed && departureDate && departureTime ? (
                <span>Pickup on {format(departureDate, 'MMM d')} at {format(departureTime, 'h:mm a')}</span>
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
              "flex items-center justify-center gap-2",
              "text-xs text-white font-medium",
              "px-3 py-1.5 h-[30px]",
              "border border-white/10 rounded-xl",
              "bg-black/90 backdrop-blur-md"
            )}
          >
            <RouteIcon className="w-3.5 h-3.5" />
            <span>{distanceInKm} km</span>
          </div>
        )}
      </div>

      {/* Portal-based DateTimeSelector - ALWAYS render the portal to maintain consistent hook count */}
      {portalTargetRef && 
        createPortal(
          // Use a higher z-index than any other element in the application
          <div 
            className={`fixed inset-0 flex items-center justify-center transition-opacity duration-300 ${showDateTimePicker ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
            style={{ zIndex: 9999 }}
          >
            {/* Background overlay */}
            <div className="fixed inset-0 bg-black/70" onClick={handleDateTimeCancel} />
            
            {/* DateTimeSelector container */}
            <div className="w-full max-w-md px-4 relative">
              <DateTimeSelector 
                onDateTimeConfirmed={handleTimeConfirmed}
                onCancel={handleDateTimeCancel}
                defaultToQuickPickup={shouldDefaultToQuickPickup}
              />
            </div>
          </div>,
          portalTargetRef
        )
      }
    </div>
  );
});

InfoBar.displayName = "InfoBar";

export default InfoBar;