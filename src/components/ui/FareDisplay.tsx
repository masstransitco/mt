"use client"

import { memo, useMemo } from "react"
import { motion } from "framer-motion"
import { useAppSelector } from "@/store/store"
import { selectRoute } from "@/store/bookingSlice"

interface FareDisplayProps {
  baseFare?: number
  currency?: string
  perMinuteRate?: number
  maxDailyFare?: number
}

const FareDisplay = memo(function FareDisplay({
  baseFare = 50.0,
  currency = "HKD",
  perMinuteRate = 1,
  maxDailyFare = 600.0,
}: FareDisplayProps) {
  // Get route from Redux to calculate estimated duration
  const route = useAppSelector(selectRoute)
  
  // Calculate estimated fare based on route duration
  const { estimatedFare, estimatedDuration } = useMemo(() => {
    if (!route) {
      return { 
        estimatedFare: baseFare, 
        estimatedDuration: 0 
      }
    }
    
    // Convert seconds to minutes and round up
    const durationInMinutes = Math.ceil(route.duration / 60)
    // Calculate fare: base fare + (minutes * rate)
    const fare = baseFare + (durationInMinutes * perMinuteRate)
    
    return {
      estimatedFare: Math.min(fare, maxDailyFare), // Cap at max daily fare
      estimatedDuration: durationInMinutes
    }
  }, [route, baseFare, perMinuteRate, maxDailyFare])

  return (
    <div className="flex flex-col w-full select-none">
      {/* Title with subtle fade-in */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-gray-400 text-xs uppercase tracking-wider font-normal mb-2 text-center w-full"
      >
        Estimated Fare
      </motion.div>

      {/* Main fare display container */}
      <div className="w-full flex items-center justify-center">
        <div className="flex flex-col items-center bg-black/80 backdrop-blur-md px-6 py-4 rounded-xl border border-white/5 shadow-lg">
          
          {/* Top row - main fare amount */}
          <div className="flex items-center mb-2">
            <span className="text-gray-400 text-lg font-medium mr-2 font-['SF_Pro_Display']">
              {currency}
            </span>
            <span className="text-white font-['SF_Pro_Display'] font-light text-3xl tracking-tight">
              ${estimatedFare.toFixed(2)}
            </span>
          </div>
          
          {/* Bottom row - fare calculation breakdown */}
          <div className="flex items-center justify-center text-xs text-gray-400 space-x-1">
            <span className="font-medium text-gray-300">${baseFare.toFixed(2)}</span>
            <span>base</span>
            {estimatedDuration > 0 && (
              <>
                <span>+</span>
                <span className="font-medium text-gray-300">${(estimatedDuration * perMinuteRate).toFixed(2)}</span>
                <span>for</span>
                <span className="font-medium text-blue-400">{estimatedDuration}</span>
                <span>min</span>
              </>
            )}
          </div>
          
          {/* Max daily fare note */}
          <div className="mt-2 text-xs text-gray-500">
            Max daily fare: ${maxDailyFare.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
})

export default FareDisplay