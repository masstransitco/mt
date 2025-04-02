"use client"

import { memo, useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight } from "lucide-react"
import type { StationFeature } from "@/store/stationsSlice"
import ModalPortal from "./ModalPortal"
import StationListModal from "./StationListModal"
import NearestStationDisplay from "./ui/NearestStationDisplay"

export interface StationListProps {
  stations: StationFeature[]
  onStationClick?: (station: StationFeature) => void
  userLocation?: { lat: number; lng: number } | null
  className?: string
}

/**
 * StationList:
 * - Shows the 3 nearest stations initially
 * - Allows selection of a station before committing as departure/arrival
 * - Offers a button to view the full list in a modal
 */
function StationList({ stations, onStationClick, userLocation, className = "" }: StationListProps) {
  if (!stations?.length) return null

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null)
  
  // Show only the first 3 by default
  const visibleStations = stations.slice(0, 3)
  const hasMoreStations = stations.length > 3

  // Calculate walking time in minutes for the selected station
  const walkingMinutes = useMemo(() => {
    if (!selectedStationId || !userLocation) return 5 // default value
    
    const selectedStation = stations.find(s => s.id === selectedStationId)
    if (!selectedStation) return 5
    
    // Calculate approx walking time based on distance
    // Assuming average walking speed of 1.4 m/s (5 km/h)
    const [lng, lat] = selectedStation.geometry.coordinates
    
    try {
      // Use Google Maps geometry if available
      if (window?.google?.maps?.geometry?.spherical) {
        const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(lat, lng),
          new window.google.maps.LatLng(userLocation.lat, userLocation.lng)
        )
        // Convert distance (in meters) to walking minutes
        // Walking speed ~5 km/h = ~83 meters per minute
        return Math.max(1, Math.round(distance / 83))
      }
      // Fallback: simplified calculation (less accurate)
      const latDiff = Math.abs(lat - userLocation.lat) 
      const lngDiff = Math.abs(lng - userLocation.lng)
      // Rough distance calculation
      const degree = 111000 // ~111 km per degree = 111000 meters
      const distance = Math.sqrt(
        Math.pow(latDiff * degree, 2) + 
        Math.pow(lngDiff * degree * Math.cos(lat * Math.PI / 180), 2)
      )
      // Convert to minutes (walking ~83 meters per minute)
      return Math.max(1, Math.round(distance / 83))
    } catch (e) {
      return 5
    }
  }, [selectedStationId, stations, userLocation])

  // Set the nearest station as selected by default on first render
  useEffect(() => {
    if (visibleStations.length > 0 && !selectedStationId) {
      setSelectedStationId(visibleStations[0].id)
    }
  }, [visibleStations, selectedStationId])

  const handleStationSelect = (station: StationFeature) => {
    setSelectedStationId(station.id)
  }

  const handleStationConfirm = (station: StationFeature) => {
    // Pass the station to the parent component for departure/arrival selection
    onStationClick?.(station)
  }

  return (
    <>
      <div className="flex flex-col w-full select-none">
        <motion.div
          className={`${className} w-full`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <NearestStationDisplay minutesAway={walkingMinutes} />
          <div className="space-y-1.5 mt-2">
            <AnimatePresence>
              {visibleStations.map((station, index) => (
                <motion.div
                  key={station.id}
                  className={`w-full p-3 bg-[#1a1a1a] rounded-xl shadow-md hover:bg-[#222222] transition-colors ${
                    selectedStationId === station.id ? 'ring-1 ring-gray-500' : ''
                  }`}
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
                  <div 
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => handleStationSelect(station)}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{station.properties.Place}</div>
                      <div className="text-xs text-gray-400 mt-1">{station.properties.Address || "No address"}</div>
                    </div>
                    
                    {selectedStationId === station.id && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="bg-[#2a2a2a] rounded-full p-1.5 hover:bg-[#333333]"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStationConfirm(station)
                        }}
                      >
                        <ChevronRight size={16} className="text-gray-300" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
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

