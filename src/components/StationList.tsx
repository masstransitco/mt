"use client"

import { memo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { StationFeature } from "@/store/stationsSlice"
import ModalPortal from "./ModalPortal"
import StationListModal from "./StationListModal"

export interface StationListProps {
  stations: StationFeature[]
  onStationClick?: (station: StationFeature) => void
  userLocation?: { lat: number; lng: number } | null
  className?: string
}

/**
 * StationList:
 * - Shows the 3 nearest stations initially
 * - Offers a button to view the full list in a modal
 */
function StationList({ stations, onStationClick, userLocation, className = "" }: StationListProps) {
  if (!stations?.length) return null

  const [isModalOpen, setIsModalOpen] = useState(false)

  // Show only the first 3 by default
  const visibleStations = stations.slice(0, 3)
  const hasMoreStations = stations.length > 3

  return (
    <>
      <div className="flex flex-col w-full select-none">
        <motion.div
          className={`${className} w-full`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="space-y-1.5">
            <AnimatePresence>
              {visibleStations.map((station, index) => (
                <motion.button
                  key={station.id}
                  onClick={() => onStationClick?.(station)}
                  className="w-full text-left p-3 bg-[#1a1a1a] rounded-xl shadow-md hover:bg-[#222222] transition-colors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: {
                      delay: index * 0.1,
                      duration: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  }}
                >
                  <div className="text-sm font-medium text-white">{station.properties.Place}</div>
                  <div className="text-xs text-gray-400 mt-1">{station.properties.Address || "No address"}</div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Deemphasized "Show more" button */}
          {hasMoreStations && (
            <motion.button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-2 py-1.5 text-xs font-normal text-gray-400 bg-[#1a1a1a]/50 rounded-lg hover:bg-[#1a1a1a] transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: 0.3,
                  duration: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                },
              }}
            >
              {stations.length - 3} more stations
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* The full-list modal */}
      {isModalOpen && (
        <ModalPortal>
          <StationListModal
            isOpen={isModalOpen}
            stations={stations}
            userLocation={userLocation}
            onStationClick={onStationClick}
            onClose={() => setIsModalOpen(false)}
          />
        </ModalPortal>
      )}
    </>
  )
}

export default memo(StationList)

