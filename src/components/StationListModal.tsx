"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import type { StationFeature } from "@/store/stationsSlice"

/** Optional utility for distance display */
function computeDistanceDisplay(
  userLocation: { lat: number; lng: number } | null,
  station: StationFeature,
): string | null {
  if (!userLocation) return null
  const [stationLng, stationLat] = station.geometry.coordinates
  const dx = stationLng - userLocation.lng
  const dy = stationLat - userLocation.lat
  const distanceInDegrees = Math.sqrt(dx * dx + dy * dy)
  // Roughly convert degrees to meters (111 km per degree).
  const distanceInMeters = distanceInDegrees * 111000
  if (distanceInMeters < 1000) {
    return `${distanceInMeters.toFixed(0)}m away`
  } else {
    const distanceInKm = distanceInMeters / 1000
    return `${distanceInKm.toFixed(1)}km away`
  }
}

export interface StationListModalProps {
  stations: StationFeature[]
  userLocation?: { lat: number; lng: number } | null
  onStationClick?: (station: StationFeature) => void
  onClose: () => void
}

/**
 * A full-screen modal that displays all stations in a scrollable list.
 * Apple-inspired dark theme with blur effects and elegant animations.
 */
export default function StationListModal({ stations, userLocation, onStationClick, onClose }: StationListModalProps) {
  return (
    <AnimatePresence>
      {stations && (
        <motion.div
          className="fixed inset-0 z-[1001] backdrop-blur-md bg-black/60 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className="bg-gradient-to-b from-[#1c1c1e] to-[#2c2c2e] w-[90vw] max-w-md h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-[#38383a]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.23, 1, 0.32, 1], // Apple's cubic-bezier easing
            }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-white tracking-tight">All Stations</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#3a3a3c] hover:bg-[#48484a] active:bg-[#545456] transition-colors"
                aria-label="Close"
              >
                <X size={16} className="text-[#a1a1a6]" />
              </button>
            </div>

            {/* Subtle divider */}
            <div className="h-[0.5px] bg-[#38383a]" />

            {/* Scrollable Station List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 station-list-modal">
              <div className="space-y-[2px]">
                {stations.map((station, index) => {
                  const distanceDisplay = computeDistanceDisplay(userLocation ?? null, station)

                  return (
                    <motion.button
                      key={station.id}
                      onClick={() => {
                        onStationClick?.(station)
                        onClose()
                      }}
                      className="w-full text-left p-3.5 rounded-xl bg-[#2c2c2e] hover:bg-[#3a3a3c] active:bg-[#48484a] transition-colors"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        transition: {
                          delay: index * 0.03,
                          duration: 0.3,
                        },
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-[15px] font-medium text-white mb-0.5">{station.properties.Place}</div>
                          <div className="text-[13px] text-[#a1a1a6]">
                            {station.properties.Address || "No address"}
                            {distanceDisplay && ` • ${distanceDisplay}`}
                          </div>
                        </div>
                        <motion.div
                          className="text-[#0a84ff] mt-0.5"
                          whileHover={{ x: 2 }}
                          transition={{ duration: 0.2 }}
                        >
                          <svg width="8" height="13" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L6.5 6.5L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </motion.div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* Bottom padding for list */}
              <div className="h-4" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

