"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, addDays, addMinutes, startOfDay, isSameDay, isAfter } from "date-fns"
import { ChevronLeft, ChevronRight, Clock, Calendar } from "lucide-react"
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
} from "@/store/bookingSlice"

interface DateTimeSelectorProps {
  onDateTimeConfirmed?: () => void
}

export default function DateTimeSelector({ onDateTimeConfirmed }: DateTimeSelectorProps) {
  const dispatch = useAppDispatch()

  // Get from Redux store
  const reduxSelectedDate = useAppSelector(selectDepartureDate)
  const reduxSelectedTime = useAppSelector(selectDepartureTime)
  const isConfirmed = useAppSelector(selectIsDateTimeConfirmed)

  // Local state
  const [selectedDate, setSelectedDate] = useState<Date | null>(reduxSelectedDate)
  const [selectedTime, setSelectedTime] = useState<Date | null>(reduxSelectedTime)
  const [availableDates, setAvailableDates] = useState<Date[]>([])
  const [availableTimes, setAvailableTimes] = useState<Date[]>([])
  const [dateIndex, setDateIndex] = useState(0)
  const [showTimes, setShowTimes] = useState(!!reduxSelectedDate)

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

  // Generate available times for selected date (15-minute increments)
  useEffect(() => {
    if (!selectedDate) return

    const now = new Date()
    const isToday = isSameDay(selectedDate, now)

    // Start from current time (rounded up to next 15 min) if today, otherwise start from beginning of day
    let startTime = isToday
      ? addMinutes(now, 15 - (now.getMinutes() % 15))
      : new Date(selectedDate.setHours(8, 0, 0, 0)) // Start at 8 AM for other days

    const endTime = new Date(selectedDate.setHours(22, 0, 0, 0)) // End at 10 PM
    const times: Date[] = []

    while (isAfter(endTime, startTime) || endTime.getTime() === startTime.getTime()) {
      times.push(new Date(startTime))
      startTime = addMinutes(startTime, 15)
    }

    setAvailableTimes(times)
    setSelectedTime(null)
  }, [selectedDate])

  const handleDateChange = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? Math.max(0, dateIndex - 1) : Math.min(6, dateIndex + 1)
    setDateIndex(newIndex)
    setSelectedDate(availableDates[newIndex])
    setShowTimes(false)
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    dispatch(setDepartureDate(date))
    setShowTimes(true)
  }

  const handleTimeSelect = (time: Date) => {
    setSelectedTime(time)
    dispatch(setDepartureTime(time))
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
      console.log("Selected date and time:", dateTime)

      // Store in Redux that date/time is confirmed
      dispatch(confirmDateTime(true))

      // Advance to booking step 3 after date/time is confirmed
      dispatch(advanceBookingStep(3))

      // Show success toast
      toast.success("Date and time confirmed! Now choose your arrival station.")

      // Notify parent component if callback provided
      if (onDateTimeConfirmed) {
        onDateTimeConfirmed()
      }
    }
  }

  return (
    <div className="w-full text-white">
      <motion.div
        className="w-full rounded-xl bg-[#1a1a1a] overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
      >
        {/* Header */}
        <div className="bg-[#111111] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">Pickup date and time</h2>
          </div>
          {selectedDate && selectedTime && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-sm text-zinc-400"
            >
              {format(selectedDate, "EEE, MMM d")} • {format(selectedTime, "h:mm a")}
            </motion.div>
          )}
        </div>

        {/* Date Selector */}
        <div className="p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              DATE
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                onClick={() => handleDateChange("prev")}
                disabled={dateIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                onClick={() => handleDateChange("next")}
                disabled={dateIndex === 6}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {availableDates.map((date, i) => (
              <motion.button
                key={i}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-colors",
                  selectedDate && isSameDay(date, selectedDate)
                    ? "bg-[#276EF1] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
                )}
                onClick={() => handleDateSelect(date)}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-xs">{format(date, "EEE")}</span>
                <span className="text-xl font-medium">{format(date, "d")}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Time Selector */}
        <AnimatePresence>
          {showTimes && (
            <motion.div
              className="p-6 max-h-64 overflow-y-auto scrollbar-hide"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                TIME
              </h3>

              <div className="grid grid-cols-4 gap-2">
                {availableTimes.map((time, i) => (
                  <motion.button
                    key={i}
                    className={cn(
                      "py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap w-full h-10 flex items-center justify-center",
                      selectedTime && time.getTime() === selectedTime.getTime()
                        ? "bg-[#276EF1] text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white",
                    )}
                    onClick={() => handleTimeSelect(time)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {format(time, "h:mm a")}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm Button */}
        <div className="p-4 bg-[#1a1a1a]">
          <Button
            className={cn(
              "w-full rounded-xl py-3 transition-all duration-300",
              selectedDate && selectedTime && !isConfirmed
                ? "bg-[#276EF1] hover:bg-[#1d5bc9] text-white"
                : isConfirmed
                  ? "bg-green-600 text-white cursor-not-allowed"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed",
            )}
            disabled={!selectedDate || !selectedTime || isConfirmed}
            onClick={handleConfirm}
          >
            <motion.div
              className="flex items-center justify-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isConfirmed ? (
                <span>Selection Confirmed</span>
              ) : selectedDate && selectedTime ? (
                <span>Confirm Pickup</span>
              ) : (
                <span>Select Pickup Time</span>
              )}
            </motion.div>
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
