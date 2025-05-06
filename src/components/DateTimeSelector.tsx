"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, addDays, addMinutes, startOfDay, isSameDay, isAfter, addHours, setHours, setMinutes } from "date-fns"
import { ChevronLeft, ChevronRight, Clock, Calendar, Info, Check, MapPin, Crosshair, X, ArrowLeft } from "lucide-react"
import { toast } from "react-hot-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAppDispatch, useAppSelector } from "@/store/store"
import {
  setDepartureDate,
  setDepartureTime,
  confirmDateTime,
  selectDepartureDate,
  selectDepartureTime,
  selectIsDateTimeConfirmed,
  advanceBookingStep,
  selectBookingStep,
  selectDepartureStation,
} from "@/store/bookingSlice"
import { selectDispatchRoute } from "@/store/dispatchSlice"
import { selectUserLocation, setUserLocation } from "@/store/userSlice"
import { locateUser } from "@/lib/UserLocation"
import StationSelectionManager from "@/lib/stationSelectionManager"
import { selectStationsWithDistance } from "@/store/stationsSlice"

interface DateTimeSelectorProps {
  onDateTimeConfirmed?: () => void
  onCancel?: () => void
  autoAdvanceStep?: boolean
  defaultToQuickPickup?: boolean
}

export default function DateTimeSelector({ 
  onDateTimeConfirmed,
  onCancel,
  autoAdvanceStep = false,
  defaultToQuickPickup = false
}: DateTimeSelectorProps) {
  const dispatch = useAppDispatch()
  const currentStep = useAppSelector(selectBookingStep)

  // Get from Redux store
  const reduxSelectedDate = useAppSelector(selectDepartureDate)
  const reduxSelectedTime = useAppSelector(selectDepartureTime)
  const isConfirmed = useAppSelector(selectIsDateTimeConfirmed)
  
  // Get user location from Redux
  const userLocation = useAppSelector(selectUserLocation)
  
  // Get stations from Redux store
  const stations = useAppSelector(selectStationsWithDistance)
  
  // Location-related state
  const [isLocating, setIsLocating] = useState(false)
  const [nearestStation, setNearestStation] = useState<any>(null)
  const [walkingMinutes, setWalkingMinutes] = useState<number | null>(null)
  
  // Get dispatch route to calculate the minimum pickup time
  const dispatchRoute = useAppSelector(selectDispatchRoute)

  // Calculate dispatch route pickup time and formatted minutes
  const calculatedPickupInfo = useMemo(() => {
    const now = new Date()
    
    if (dispatchRoute?.duration) {
      // Convert seconds to minutes and add 15 minute buffer
      const drivingMins = dispatchRoute.duration / 60
      const totalMins = Math.ceil(drivingMins + 15)
      const calculatedTime = addMinutes(now, totalMins)
      
      return {
        pickupMins: totalMins,
        calculatedTime
      }
    }
    
    // Default to 30 minutes if no dispatch route
    return {
      pickupMins: 30,
      calculatedTime: addMinutes(now, 30)
    }
  }, [dispatchRoute])
  
  // Handle UI reset function is defined below with the useEffect for tracking reset state
  
  // Handle locate me button click
  const handleLocateMe = async () => {
    if (isLocating) return
    
    setIsLocating(true)
    const toastId = toast.loading("Finding your location...")
    
    try {
      // Use the centralized locate function from UserLocation.ts
      const location = await locateUser()
      
      if (location) {
        toast.dismiss(toastId)
        toast.success("Location found!")
        
        // Store location in Redux
        dispatch(setUserLocation(location))
        
        // Find the nearest station
        if (stations && stations.length > 0) {
          // Sort stations by distance to user location
          const sortedStations = StationSelectionManager.sortStationsByDistanceToPoint(
            location, 
            stations
          )
          
          // Get the closest station
          const closest = sortedStations[0]
          setNearestStation(closest)
          
          // Estimate walking time based on distance (rough estimate)
          // In a production app, you'd use the Google Maps Distance Matrix API here
          if (closest) {
            // Rough calculation: 1km = 12 minutes walking
            const [lng, lat] = closest.geometry.coordinates
            const distanceKm = calculateDistance(
              location.lat, 
              location.lng, 
              lat, 
              lng
            )
            const estimatedWalkTime = Math.ceil(distanceKm * 12)
            setWalkingMinutes(estimatedWalkTime)
          }
        }
      } else {
        toast.dismiss(toastId)
        toast.error("Could not determine your location")
      }
    } catch (error) {
      console.error("Error getting location:", error)
      toast.dismiss(toastId)
      toast.error("Unable to get your location")
    } finally {
      setIsLocating(false)
    }
  }
  
  // Function to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
  
  // Handle quick pickup confirm (selects nearest station and advances to step 2)
  const handleQuickPickupWithClosestStation = () => {
    if (!nearestStation) {
      toast.error("No station found nearby")
      return
    }
    
    // Use StationSelectionManager to select the nearest station
    StationSelectionManager.selectStation(nearestStation.id)
    
    // Clear the date/time in Redux (we're using default pickup time)
    dispatch(setDepartureDate(""))
    dispatch(setDepartureTime(""))
    dispatch(confirmDateTime(false))
    
    toast.success(`Pickup from ${nearestStation.properties.Place} in ${calculatedPickupInfo.pickupMins} minutes confirmed`)
    
    // Notify parent component if callback provided
    if (onDateTimeConfirmed) {
      onDateTimeConfirmed()
    }
  }

  // Calculate minimum pickup time based on dispatch route
  const minPickupTime = useMemo(() => {
    const now = new Date()
    
    // If we have a dispatch route, calculate the minimum time based on driving time + buffer
    if (dispatchRoute?.duration) {
      // Use the calculatedTime from above
      const calculatedTime = calculatedPickupInfo.calculatedTime
      
      // Get the next hour after the calculated time
      const nextHour = new Date(calculatedTime)
      nextHour.setMinutes(0)
      nextHour.setSeconds(0)
      nextHour.setMilliseconds(0)
      
      if (nextHour <= calculatedTime) {
        nextHour.setHours(nextHour.getHours() + 1)
      }
      
      console.log('Time calculation:', {
        calculatedTime: format(calculatedTime, 'MMM d, h:mm a'),
        nextHour: format(nextHour, 'MMM d, h:mm a')
      })
      
      return nextHour
    }
    
    // If no dispatch route, use current time + 1 hour as minimum
    const nextHour = new Date(now)
    nextHour.setMinutes(0)
    nextHour.setSeconds(0)
    nextHour.setMilliseconds(0)
    nextHour.setHours(nextHour.getHours() + 1)
    
    return nextHour
  }, [dispatchRoute, calculatedPickupInfo])

  // Local state
  const [selectedDate, setSelectedDate] = useState<Date | null>(reduxSelectedDate)
  const [selectedTime, setSelectedTime] = useState<Date | null>(reduxSelectedTime)
  const [availableDates, setAvailableDates] = useState<Date[]>([])
  const [availableTimes, setAvailableTimes] = useState<Date[]>([])
  const [dateIndex, setDateIndex] = useState(0)
  const [showTimes, setShowTimes] = useState(!!reduxSelectedDate)
  const [showMinTimeInfo, setShowMinTimeInfo] = useState(false)
  
  // Initialize default pickup time based on props and conditions
  // Use defaultToQuickPickup if specified and no date/time is confirmed
  const [useDefaultPickupTime, setUseDefaultPickupTime] = useState(
    defaultToQuickPickup && 
    currentStep > 1 && 
    (!isConfirmed || !reduxSelectedDate || !reduxSelectedTime)
  )

  // Generate available dates (next 7 days)
  useEffect(() => {
    const now = new Date()
    const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(now), i))
    setAvailableDates(dates)

    // Set selected date if not already set from Redux
    if (!selectedDate) {
      setSelectedDate(dates[0])
    } else {
      // Find the index of the previously selected date to maintain correct dateIndex
      const existingDateIndex = dates.findIndex(
        (date) =>
          date.getFullYear() === selectedDate.getFullYear() &&
          date.getMonth() === selectedDate.getMonth() &&
          date.getDate() === selectedDate.getDate(),
      )
      if (existingDateIndex >= 0) {
        setDateIndex(existingDateIndex)
      }
    }
  }, [])
  
  // No need to automatically set useDefaultPickupTime in step 1 anymore
  // We'll now directly use the nearestStation info to display appropriate UI
  
  // Track whether we've manually reset the nearest station
  const [wasReset, setWasReset] = useState(false)
  
  // Modified reset handler to track that a reset occurred
  const handleReset = () => {
    // Reset UI state only - no Redux updates
    setNearestStation(null)
    setWalkingMinutes(null)
    setIsLocating(false)
    setWasReset(true) // Mark that we've manually reset
  }
  
  // If user already has location when component mounts, use it to find nearest station
  // But only if we haven't manually reset
  useEffect(() => {
    if (currentStep === 1 && userLocation && stations.length > 0 && !nearestStation && !wasReset) {
      // Sort stations by distance to user location
      const sortedStations = StationSelectionManager.sortStationsByDistanceToPoint(
        userLocation, 
        stations
      )
      
      // Get the closest station
      const closest = sortedStations[0]
      setNearestStation(closest)
      
      // Estimate walking time based on distance
      if (closest) {
        const [lng, lat] = closest.geometry.coordinates
        const distanceKm = calculateDistance(
          userLocation.lat, 
          userLocation.lng, 
          lat, 
          lng
        )
        const estimatedWalkTime = Math.ceil(distanceKm * 12)
        setWalkingMinutes(estimatedWalkTime)
      }
    }
  }, [currentStep, userLocation, stations, nearestStation, calculateDistance, wasReset])

  // Generate available times for selected date (15-minute increments)
  useEffect(() => {
    if (!selectedDate) return

    const now = new Date()
    const isToday = isSameDay(selectedDate, now)
    const isMinTimeToday = isSameDay(minPickupTime, now)
    
    // Default start time settings
    let startTimeHour = 8 // Start at 8 AM for future days
    let startTimeMinute = 0
    
    // Determine the start time based on different conditions
    if (isToday) {
      if (isMinTimeToday) {
        // If the calculated minimum time is today, use it as the start
        startTimeHour = minPickupTime.getHours()
        startTimeMinute = 0 // Always start at the top of the hour
      } else {
        // If it's today but min time is in the future, default to next hour from now
        const nextHour = addHours(now, 1)
        startTimeHour = nextHour.getHours()
        startTimeMinute = 0
      }
    } else if (isSameDay(selectedDate, minPickupTime)) {
      // If selected date is the same as min pickup date (but not today)
      startTimeHour = minPickupTime.getHours()
      startTimeMinute = 0
    }
    
    // Create a new date with exact time for startTime
    let startTime = new Date(selectedDate)
    startTime.setHours(startTimeHour, startTimeMinute, 0, 0)
    
    // End time (10 PM)
    const endTime = new Date(selectedDate)
    endTime.setHours(22, 0, 0, 0)
    
    const times: Date[] = []

    while (isAfter(endTime, startTime) || endTime.getTime() === startTime.getTime()) {
      times.push(new Date(startTime))
      startTime = addMinutes(startTime, 15)
    }

    console.log('Generated times:', {
      date: format(selectedDate, 'MMM d'),
      minTime: format(minPickupTime, 'MMM d, h:mm a'),
      startTime: times.length > 0 ? format(times[0], 'h:mm a') : 'No times available',
      numTimes: times.length
    })

    setAvailableTimes(times)
    
    // Only reset the selected time if one of these conditions is true:
    // 1. We don't have a time from Redux
    // 2. The date has changed from what's in Redux
    // 3. The selected time is before the minimum allowed time
    if (!reduxSelectedTime || 
        (selectedDate && reduxSelectedDate && !isSameDay(selectedDate, reduxSelectedDate)) ||
        (reduxSelectedTime && isToday && reduxSelectedTime < minPickupTime)) {
      setSelectedTime(null)
    }
  }, [selectedDate, reduxSelectedDate, reduxSelectedTime, minPickupTime])

  const handleDateChange = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? Math.max(0, dateIndex - 1) : Math.min(6, dateIndex + 1)
    setDateIndex(newIndex)
    setSelectedDate(availableDates[newIndex])
    setShowTimes(false)
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    // Send ISO string to Redux instead of Date object to ensure serializability
    dispatch(setDepartureDate(date.toISOString()))
    setShowTimes(true)
  }

  const handleTimeSelect = (time: Date) => {
    // Check if the selected date and time is in the past or before minimum pickup time
    const selectedDateTime = new Date(
      selectedDate!.getFullYear(),
      selectedDate!.getMonth(),
      selectedDate!.getDate(),
      time.getHours(),
      time.getMinutes()
    )
    
    if (selectedDateTime < minPickupTime) {
      toast.error(`The earliest available pickup time is ${format(minPickupTime, 'h:mm a')}`)
      return
    }
    
    setSelectedTime(time)
    // Send ISO string to Redux instead of Date object to ensure serializability
    dispatch(setDepartureTime(time.toISOString()))
  }

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      // Combine date and time
      const dateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes(),
      )
      
      // Validate that the selected time is not in the past
      const now = new Date()
      if (dateTime < now) {
        toast.error("Cannot schedule a pickup time in the past")
        return
      }
      
      // Validate that the selected time is not before the minimum pickup time
      if (dateTime < minPickupTime) {
        toast.error(`The earliest available pickup time is ${format(minPickupTime, 'h:mm a')}`)
        return
      }
      
      console.log("Selected date and time:", dateTime)

      // First ensure we have the date and time in Redux using ISO strings for serializability
      dispatch(setDepartureDate(selectedDate.toISOString()))
      dispatch(setDepartureTime(selectedTime.toISOString()))
      
      // Store in Redux that date/time is confirmed
      dispatch(confirmDateTime(true))
      
      // Log state to help with debugging
      console.log("Confirmed date/time:", {
        date: selectedDate.toISOString(),
        time: selectedTime.toISOString(),
        combined: dateTime.toISOString(),
        isConfirmed: true
      })

      // Only advance booking step if autoAdvanceStep is true
      // and we're in a valid step to advance from (step 2)
      if (autoAdvanceStep && currentStep === 2) {
        dispatch(advanceBookingStep(3))
        // Show success toast for booking flow advancement
        toast.success("Date and time confirmed! Now choose your arrival station.")
      } else {
        // Show a different toast for schedule-only mode with clearer feedback
        toast.success(`Pickup scheduled for ${format(selectedDate, 'MMM d')} at ${format(selectedTime, 'h:mm a')}`)
      }

      // Notify parent component if callback provided
      if (onDateTimeConfirmed) {
        onDateTimeConfirmed()
      }
    }
  }

  // Toggle the info tooltip
  const toggleMinTimeInfo = () => {
    setShowMinTimeInfo(!showMinTimeInfo)
  }
  
  // Toggle between default pickup time and scheduled time
  const toggleUseDefaultPickupTime = () => {
    if (currentStep === 1) {
      // In step 1, we don't allow toggling to default pickup manually
      return
    }
    
    setUseDefaultPickupTime(!useDefaultPickupTime)
    
    if (!useDefaultPickupTime) {
      // User wants to use default pickup time
      // Clear date and time selection
      setSelectedDate(null)
      setSelectedTime(null)
      setShowTimes(false)
    }
  }
  
  // Function to handle confirming default pickup time
  const handleConfirmDefaultPickupTime = () => {
    // Clear date/time in Redux
    dispatch(setDepartureDate(""))
    dispatch(setDepartureTime(""))
    dispatch(confirmDateTime(false))
    
    toast.success(`Pickup in ${calculatedPickupInfo.pickupMins} minutes confirmed`)
    
    // Notify parent component if callback provided
    if (onDateTimeConfirmed) {
      onDateTimeConfirmed()
    }
  }

  return (
    <div className="w-full text-white mt-0 bg-black rounded-2xl border border-zinc-800 shadow-xl overflow-hidden">
      <motion.div
        className="w-full overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800/50">
          <div className="flex flex-col">
            <h2 className="text-xl font-medium font-sfpro tracking-tight">
              {isConfirmed ? "Update pickup time" : "Pickup date and time"}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5 font-sfpro">
              {isConfirmed 
                ? "Modify your previously scheduled pickup time" 
                : "Select when you want to drive"}
            </p>
          </div>
          {selectedDate && selectedTime && !useDefaultPickupTime && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`px-3 py-1.5 rounded-full ${isConfirmed 
                ? "bg-zinc-900 text-blue-400 border border-blue-800/30" 
                : "bg-zinc-900 text-zinc-300 border border-zinc-800"} text-sm font-sfpro`}
            >
              {format(selectedDate, "EEE, MMM d")} • {format(selectedTime, "h:mm a")}
            </motion.div>
          )}
        </div>
        
        {/* Pickup Time Option Selector - only show in steps 2+ */}
        {currentStep > 1 && (
          <div className="px-4 py-4 border-b border-zinc-800/70 bg-gradient-to-r from-zinc-950 to-black">
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                className={cn(
                  "py-3.5 px-4 rounded-2xl text-sm font-sfpro font-medium transition-colors flex flex-col items-center justify-center gap-1.5",
                  !useDefaultPickupTime 
                    ? "bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border border-zinc-700 shadow-lg"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
                onClick={() => setUseDefaultPickupTime(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Calendar className="h-5 w-5 mb-1" />
                <span>Schedule for later</span>
              </motion.button>
              
              <motion.button
                className={cn(
                  "py-3.5 px-4 rounded-2xl text-sm font-sfpro font-medium transition-colors flex flex-col items-center justify-center gap-1.5",
                  useDefaultPickupTime
                    ? "bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border border-zinc-700 shadow-lg"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
                onClick={() => setUseDefaultPickupTime(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Clock className="h-5 w-5 mb-1" />
                <span>Pickup in {calculatedPickupInfo.pickupMins} mins</span>
              </motion.button>
            </div>
          </div>
        )}
        
        {/* In step 1, we just show a simple message */}
        {currentStep === 1 && (
          <div className="px-4 py-5 border-b border-zinc-800/70 bg-gradient-to-b from-zinc-950 to-black">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-zinc-300 text-center font-sfpro">
                Select a date and time for your pickup.
              </p>
            </div>
          </div>
        )}
        
        {/* We've removed the nearest station display in step 1 */}

        {/* Date and Time selectors - show when not using default pickup time or when in step 1 */}
        {(!useDefaultPickupTime || currentStep === 1) && (
          <>
            {/* Date Selector */}
            <div className="px-4 py-5 mt-1 border-b border-zinc-800/70 bg-gradient-to-r from-zinc-950 to-black">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-sfpro font-medium text-zinc-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  SELECT DATE
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 shadow-md transition-colors",
                      dateIndex === 0 ? "text-zinc-600" : "text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
                    )}
                    onClick={() => handleDateChange("prev")}
                    disabled={dateIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 shadow-md transition-colors", 
                      dateIndex === 6 ? "text-zinc-600" : "text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
                    )}
                    onClick={() => handleDateChange("next")}
                    disabled={dateIndex === 6}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {availableDates.map((date, i) => {
                  // Check if this date is before the minimum date
                  const isBeforeMinDate = isSameDay(date, minPickupTime) ? false : date < minPickupTime;
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <motion.button
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl transition-colors shadow-md",
                        selectedDate && isSameDay(date, selectedDate)
                          ? "bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border border-zinc-700"
                          : isBeforeMinDate 
                            ? "bg-zinc-900/50 text-zinc-600 border border-zinc-900 cursor-not-allowed"
                            : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700",
                      )}
                      onClick={() => !isBeforeMinDate && handleDateSelect(date)}
                      whileHover={{ scale: isBeforeMinDate ? 1 : 1.03 }}
                      whileTap={{ scale: isBeforeMinDate ? 1 : 0.97 }}
                      disabled={isBeforeMinDate}
                    >
                      <span className="text-xs font-sfpro mb-0.5">
                        {format(date, "EEE")}
                      </span>
                      <span className="text-xl font-sfpro font-medium">
                        {format(date, "d")}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Time Selector */}
            <AnimatePresence>
              {showTimes && (
                <motion.div
                  className="px-4 py-5 max-h-72 overflow-y-auto scrollbar-hide bg-gradient-to-b from-zinc-950 to-black"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-sfpro font-medium text-zinc-300 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-400" />
                      SELECT TIME
                    </h3>
                    <div className="relative">
                      <button 
                        onClick={toggleMinTimeInfo}
                        className="text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-900 p-1.5 rounded-full border border-zinc-800"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      
                      {/* Time restriction info tooltip */}
                      {showMinTimeInfo && (
                        <div className="absolute right-0 top-8 w-72 p-3 bg-black border border-zinc-800 rounded-xl shadow-xl z-10 text-xs">
                          <div className="flex gap-2 items-start">
                            <Info className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-sfpro text-zinc-300 leading-relaxed">
                                The earliest available pickup time is based on the time needed to prepare your car.
                              </p>
                              <p className="mt-2 font-sfpro text-green-400 font-medium">
                                Earliest time: {format(minPickupTime, 'MMM d, h:mm a')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {availableTimes.map((time, i) => {
                      // Create a combined date-time to check against minimum pickup time
                      const dateTime = new Date(
                        selectedDate!.getFullYear(),
                        selectedDate!.getMonth(),
                        selectedDate!.getDate(),
                        time.getHours(),
                        time.getMinutes(),
                      );
                      
                      // Calculate if this time is unavailable (before min pickup time)
                      const isUnavailable = dateTime < minPickupTime;
                      
                      return (
                        <motion.button
                          key={i}
                          className={cn(
                            "py-2.5 px-1 rounded-xl text-sm font-sfpro font-medium transition-colors whitespace-nowrap w-full h-11 flex items-center justify-center shadow-md border",
                            selectedTime && time.getTime() === selectedTime.getTime()
                              ? "bg-gradient-to-b from-zinc-800 to-zinc-900 text-white border-zinc-700"
                              : isUnavailable
                                ? "bg-zinc-900/50 text-zinc-600 border-zinc-900 cursor-not-allowed"
                                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white hover:border-zinc-700",
                          )}
                          onClick={() => !isUnavailable && handleTimeSelect(time)}
                          whileHover={{ scale: isUnavailable ? 1 : 1.03 }}
                          whileTap={{ scale: isUnavailable ? 1 : 0.97 }}
                          disabled={isUnavailable}
                        >
                          {format(time, "h:mm a")}
                        </motion.button>
                      );
                    })}
                  </div>
                  
                  {/* Add notice about minimum time availability */}
                  <div className="mt-5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-sfpro text-zinc-500 leading-relaxed">
                      Times are available starting from the next hour after the calculated "Pickup in X minutes" time.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        
        {/* Default Pickup Time Details - only show in step 2+ when using default pickup time */}
        {currentStep > 1 && useDefaultPickupTime && (
          <div className="px-4 py-5 border-b border-zinc-800/70 bg-gradient-to-b from-zinc-950 to-black">
            <div className="bg-gradient-to-b from-[#0a1a21] to-[#0b1a1e] p-5 rounded-2xl border border-blue-900/20 shadow-lg">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-gradient-to-b from-[#102631] to-black w-16 h-16 rounded-full flex items-center justify-center border border-blue-900/30 shadow-lg">
                  <Clock className="h-7 w-7 text-blue-400" />
                </div>
              </div>
              <h3 className="text-center text-xl font-sfpro font-medium mb-2">Pickup in {calculatedPickupInfo.pickupMins} minutes</h3>
              <p className="text-center text-sm font-sfpro text-blue-200/70 mb-5">
                Your car will be ready at approximately {format(calculatedPickupInfo.calculatedTime, 'h:mm a')}
              </p>
              
              <div className="flex items-center justify-center gap-2.5 text-zinc-200 text-sm bg-blue-900/20 py-2.5 px-4 rounded-xl border border-blue-900/20 font-sfpro">
                <Check className="h-5 w-5 text-blue-400" />
                <span>Fastest option available</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-5 bg-gradient-to-b from-black to-zinc-950 border-t border-zinc-800/50">
          {/* Confirm Button - different behavior based on step and state */}
          {currentStep === 1 && selectedDate && selectedTime ? (
            // In step 1 without a selected station but with date and time selected
            <Button
              className="w-full rounded-xl py-3.5 transition-all duration-300 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-sfpro shadow-lg shadow-blue-900/20 border border-blue-500/20"
              onClick={handleConfirm}
            >
              <motion.div
                className="flex items-center justify-center gap-2 font-medium"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>Confirm Scheduled Pickup</span>
              </motion.div>
            </Button>
          ) : currentStep > 1 && useDefaultPickupTime ? (
            // In step 2+ with default pickup time
            <Button
              className="w-full rounded-xl py-3.5 transition-all duration-300 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-sfpro shadow-lg shadow-blue-900/20 border border-blue-500/20"
              onClick={handleConfirmDefaultPickupTime}
            >
              <motion.div
                className="flex items-center justify-center gap-2 font-medium"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>Confirm Quick Pickup</span>
              </motion.div>
            </Button>
          ) : (
            // For scheduled pickup (both step 1 and 2+)
            <Button
              className={cn(
                "w-full rounded-xl py-3.5 transition-all duration-300 font-sfpro shadow-lg",
                selectedDate && selectedTime
                  ? "bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-blue-900/20 border border-blue-500/20"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none border border-zinc-700",
              )}
              disabled={!selectedDate || !selectedTime}
              onClick={handleConfirm}
            >
              <motion.div
                className="flex items-center justify-center gap-2 font-medium"
                whileHover={{ scale: selectedDate && selectedTime ? 1.03 : 1 }}
                whileTap={{ scale: selectedDate && selectedTime ? 0.97 : 1 }}
              >
                {isConfirmed ? (
                  <span>Update Pickup Time</span>
                ) : selectedDate && selectedTime ? (
                  <span>Confirm Scheduled Pickup</span>
                ) : (
                  <span>Select Pickup Time</span>
                )}
              </motion.div>
            </Button>
          )}
          
          {/* Cancel Button */}
          {onCancel && (
            <Button
              variant="outline"
              className="w-full rounded-xl py-3.5 mt-3 text-zinc-300 bg-zinc-900/80 font-sfpro border border-zinc-700/70 hover:bg-zinc-800 hover:text-white hover:border-zinc-600 transition-all duration-300"
              onClick={onCancel}
            >
              <motion.div
                className="flex items-center justify-center gap-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Back
              </motion.div>
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
