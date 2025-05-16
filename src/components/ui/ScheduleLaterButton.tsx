"use client"

import React, { useState, useMemo } from "react"
import { Calendar, Clock } from "lucide-react"
import { useAppSelector } from "@/store/store"
import { selectDepartureDate, selectDepartureTime, selectIsDateTimeConfirmed, selectBookingStep } from "@/store/bookingSlice"
import { selectDispatchRoute } from "@/store/dispatchSlice"
import DateTimeSelector from "@/components/DateTimeSelector"
import ModalPortal from "@/components/ModalPortal"
import { format, isValid } from "date-fns"

/**
 * ScheduleLaterButton is a focused button specifically for scheduling a later pickup time
 * In step 1, this button only shows "Schedule for Later" functionality
 * In step 3, it can show pickup time estimate if no date/time is selected
 */
interface ScheduleLaterButtonProps {
  onClick?: () => void
}

export default function ScheduleLaterButton({
  onClick
}: ScheduleLaterButtonProps) {
  // Get booking state
  const departureDate = useAppSelector(selectDepartureDate)
  const departureTime = useAppSelector(selectDepartureTime)
  const isDateTimeConfirmed = useAppSelector(selectIsDateTimeConfirmed)
  const currentStep = useAppSelector(selectBookingStep)
  
  // Get dispatch route for calculating pickup time
  const dispatchRoute = useAppSelector(selectDispatchRoute)
  
  // Date time picker visibility
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  
  // Calculate pickup minutes based on dispatch route
  const pickupMins = useMemo(() => {
    if (dispatchRoute?.duration) {
      const drivingMins = dispatchRoute.duration / 60
      return Math.ceil(drivingMins + 15)
    }
    return null
  }, [dispatchRoute])
  
  // Handler for when button is clicked
  const handleButtonClick = () => {
    setShowDateTimePicker(true)
    onClick?.()
  }
  
  // Cancel handler
  const handleDateTimeCancel = () => {
    setShowDateTimePicker(false)
  }
  
  // Confirmation handler
  const handleTimeConfirmed = () => {
    setShowDateTimePicker(false)
  }
  
  // Determine button text based on the state
  const buttonText = useMemo(() => {
    // If user has explicitly confirmed a date and time, show that
    if (isDateTimeConfirmed && departureDate && departureTime) {
      try {
        // Verify that departureDate and departureTime are valid dates using date-fns isValid
        if (!isValid(departureDate) || !isValid(departureTime)) {
          console.error('Invalid date/time values:', { departureDate, departureTime });
          return "Schedule for later";
        }
        
        // Additional defensive check to ensure we're working with valid date objects
        if (Object.prototype.toString.call(departureDate) !== '[object Date]' || 
            Object.prototype.toString.call(departureTime) !== '[object Date]') {
          console.error('Values are not Date objects:', { departureDate, departureTime });
          return "Schedule for later";
        }
        
        return `Pickup on ${format(departureDate, 'MMM d')} at ${format(departureTime, 'h:mm a')}`
      } catch (error) {
        console.error('Error formatting date/time:', error);
        return "Schedule for later";
      }
    }
    
    // For step 3, if we have pickup time estimate, show it
    if (currentStep === 3 && pickupMins) {
      return `Pickup in ${pickupMins} minutes`
    }
    
    // Default text
    return "Schedule for later"
  }, [isDateTimeConfirmed, departureDate, departureTime, currentStep, pickupMins])
  
  // Determine which icon to show
  const ButtonIcon = useMemo(() => {
    // Always use Calendar icon in step 1
    if (currentStep === 1) {
      return Calendar;
    }
    
    // For step 2+, use Calendar if date/time is confirmed, otherwise Clock
    if (isDateTimeConfirmed && departureDate && departureTime) {
      return Calendar;
    } else {
      return Clock;
    }
  }, [currentStep, isDateTimeConfirmed, departureDate, departureTime]);

  return (
    <div className="flex flex-col">
      <div 
        onClick={handleButtonClick}
        className="cursor-pointer relative flex items-center justify-center gap-2 text-xs text-white font-medium px-3 py-1.5 h-[30px] w-full border border-white/10 rounded-xl bg-black/90 backdrop-blur-md hover:bg-black hover:border-white/20 transition-all duration-200"
      >
        <ButtonIcon className="w-3.5 h-3.5" />
        <span>{buttonText}</span>
      </div>
      
      {/* DateTimeSelector Modal - rendered through portal to escape the sheet's DOM hierarchy */}
      {showDateTimePicker && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/70 z-[1001] flex items-center justify-center overflow-auto py-8">
            <div className="w-full max-w-md px-4">
              <DateTimeSelector 
                onDateTimeConfirmed={handleTimeConfirmed}
                onCancel={handleDateTimeCancel}
                defaultToQuickPickup={currentStep >= 2 && !isDateTimeConfirmed}
              />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}