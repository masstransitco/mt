"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import type { StationFeature } from "@/store/stationsSlice"
import StationsOnlineDisplay from "./ui/StationsOnlineDisplay"

interface StationListModalProps {
  stations: StationFeature[]
  userLocation?: { lat: number; lng: number } | null
  isOpen: boolean
  onStationClick?: (station: StationFeature) => void
  onClose: () => void
}

export default function StationListModal({
  stations,
  userLocation,
  isOpen,
  onStationClick,
  onClose,
}: StationListModalProps) {
  // If we aren't open, we can return null
  if (!isOpen) {
    return null
  }

  // The main UI
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1001] backdrop-blur-md bg-black/60 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="bg-[#1a1a1a] w-[90vw] max-w-md h-[75vh] rounded-xl flex flex-col overflow-hidden shadow-md"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white tracking-tight">All Stations</h3>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-[#2a2a2a] hover:bg-[#333333] transition-colors"
              aria-label="Close"
            >
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          <div className="h-[0.5px] bg-[#2a2a2a]" />

          {/* Scrollable station list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 station-list-modal">
            <div className="mb-3">
              <StationsOnlineDisplay stationsCount={stations.length} totalStations={200} />
            </div>
            <div className="space-y-1.5">
              {stations.map((station, index) => (
                <motion.button
                  key={station.id}
                  onClick={() => {
                    onStationClick?.(station)
                    onClose()
                  }}
                  className="w-full text-left p-3 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      delay: index * 0.03,
                      duration: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{station.properties.Place}</div>
                      <div className="text-xs text-gray-400 mt-1">{station.properties.Address || "No address"}</div>
                    </div>
                    {/* Subtle arrow indicator */}
                    <motion.div className="text-gray-500 mt-0.5" whileHover={{ x: 2 }} transition={{ duration: 0.2 }}>
                      <svg width="6" height="10" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L6.5 6.5L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </motion.div>
                  </div>
                </motion.button>
              ))}
            </div>
            <div className="h-4" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

