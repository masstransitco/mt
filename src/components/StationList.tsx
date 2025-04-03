"use client"

import { memo, useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight } from "lucide-react"
import type { StationFeature } from "@/store/stationsSlice"
import ModalPortal from "./ModalPortal"
import StationListModal from "./StationListModal"
import NearestStationDisplay from "./ui/NearestStationDisplay"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { 
  selectListSelectedStationId, 
  setListSelectedStation,
  selectWalkingRouteStatus,
  selectWalkingDuration,
  fetchWalkingRoute,
  clearWalkingRoute,
  selectWalkingRoute
} from "@/store/userSlice"

export interface StationListProps {
  stations: StationFeature[]
  onStationClick?: (station: StationFeature) => void
  userLocation?: { lat: number; lng: number } | null
  searchLocation?: { lat: number; lng: number } | null
  className?: string
}

/**
 * StationList:
 * - Shows the 3 nearest stations initially
 * - Allows selection of a station before committing as departure/arrival
 * - Offers a button to view the full list in a modal
 */
function StationList({ stations, onStationClick, userLocation, searchLocation, className = "" }: StationListProps) {
  if (!stations?.length) return null

  const dispatch = useAppDispatch()
  const listSelectedStationId = useAppSelector(selectListSelectedStationId)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStationId, setSelectedStationId] = useState<number | null>(listSelectedStationId)
  // Track if user has manually selected a station
  const [userHasSelected, setUserHasSelected] = useState(false)
  
  // Show only the first 3 by default
  const visibleStations = stations.slice(0, 3)
  const hasMoreStations = stations.length > 3

  // Get walking route data from Redux
  const walkingDuration = useAppSelector(selectWalkingDuration);
  const walkingRouteStatus = useAppSelector(selectWalkingRouteStatus);
  const walkingRoute = useAppSelector(selectWalkingRoute);
  
  // Track if the walking route is currently shown
  const [isWalkingRouteShown, setIsWalkingRouteShown] = useState(false);
  
  // Sync with Redux - if walkingRoute exists, route is shown
  useEffect(() => {
    setIsWalkingRouteShown(walkingRouteStatus === 'succeeded' && !!walkingRoute);
  }, [walkingRouteStatus, walkingRoute]);
  
  // Calculate walking time in minutes for the selected station
  const walkingMinutes = useMemo((): number => {
    // If we have a real walking route from the API, use that duration
    if (walkingDuration !== null) {
      return walkingDuration;
    }
    
    // Otherwise, fall back to the estimation
    if (!selectedStationId) return 5 // default value
    
    // IMPORTANT: The source location is determined here, making 
    // user location and search location mutually exclusive.
    // 
    // If a search location exists, we ALWAYS use it as the source
    // If no search location exists, we use the user's current location
    // This ensures consistent behavior with the map display
    const referenceLocation = searchLocation || userLocation
    if (!referenceLocation) return 5
    
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
          new window.google.maps.LatLng(referenceLocation.lat, referenceLocation.lng)
        )
        // Convert distance (in meters) to walking minutes
        // Walking speed ~5 km/h = ~83 meters per minute
        return Math.max(1, Math.round(distance / 83))
      }
      // Fallback: simplified calculation (less accurate)
      const latDiff = Math.abs(lat - referenceLocation.lat) 
      const lngDiff = Math.abs(lng - referenceLocation.lng)
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
  }, [selectedStationId, stations, userLocation, searchLocation, walkingDuration])

  // Set the nearest station as selected only on first render
  // OR when location changes AND user hasn't manually selected a station
  useEffect(() => {
    if (visibleStations.length > 0) {
      // Only auto-select the nearest station if:
      // 1. No station is currently selected, OR
      // 2. Location changed BUT user hasn't made a manual selection
      if (!selectedStationId || !userHasSelected) {
        const stationId = visibleStations[0].id
        setSelectedStationId(stationId)
        dispatch(setListSelectedStation(stationId))
      }
    }
  }, [visibleStations, selectedStationId, dispatch, userLocation, searchLocation, userHasSelected])
  
  // Sync local state with Redux state
  useEffect(() => {
    if (listSelectedStationId !== selectedStationId && listSelectedStationId !== null) {
      setSelectedStationId(listSelectedStationId)
    }
  }, [listSelectedStationId, selectedStationId])
  
  // Reset user selection flag when stations are completely different
  // This handles cases like new searches where the entire dataset changes
  useEffect(() => {
    // Check if the previous selected station still exists in the list
    if (selectedStationId && !stations.some(s => s.id === selectedStationId)) {
      // If not, reset the user selection flag
      setUserHasSelected(false)
    }
  }, [stations, selectedStationId])

  // Handle showing walking route when user clicks on the walking display
  const handleShowWalkingRoute = () => {
    if (isWalkingRouteShown) {
      // Toggle off - clear walking route
      dispatch(clearWalkingRoute())
      setIsWalkingRouteShown(false)
    } else if (selectedStationId) {
      // Toggle on - fetch walking route
      const selectedStation = stations.find(s => s.id === selectedStationId)
      const referenceLocation = searchLocation || userLocation
      
      if (selectedStation && referenceLocation) {
        // Request the walking route from the API
        dispatch(fetchWalkingRoute({
          locationFrom: referenceLocation,
          station: selectedStation
        }))
        setIsWalkingRouteShown(true)
      }
    }
  }

  const handleStationSelect = (station: StationFeature) => {
    setSelectedStationId(station.id)
    dispatch(setListSelectedStation(station.id))
    // Mark that user has made a manual selection
    setUserHasSelected(true)
    
    // Clear walking route when user selects a new station
    if (isWalkingRouteShown) {
      dispatch(clearWalkingRoute())
      setIsWalkingRouteShown(false)
    }
  }

  const handleStationConfirm = (station: StationFeature) => {
    // Use our centralized manager for station selection
    import("@/lib/stationSelectionManager").then(module => {
      const stationSelectionManager = module.default;
      stationSelectionManager.selectStation(station.id, false);
    });
    
    // Also pass to parent component for backward compatibility
    onStationClick?.(station)
    
    // Reset flag after user confirms their selection
    setUserHasSelected(false)
    
    // Clear any walking route when station is confirmed
    if (isWalkingRouteShown) {
      dispatch(clearWalkingRoute())
      setIsWalkingRouteShown(false)
    }
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
          <NearestStationDisplay 
            minutesAway={walkingMinutes}
            locationName={selectedStationId ? stations.find(s => s.id === selectedStationId)?.properties.Place : undefined}
            sourceLocationName={searchLocation ? "search location" : "current location"}
            isAccurateTime={walkingRouteStatus === 'succeeded'}
            onShowWalkingRoute={handleShowWalkingRoute}
            isWalkingRouteShown={isWalkingRouteShown}
          />
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
            onStationClick={(station) => {
              // No need to duplicate stationSelectionManager call here
              // as we've added it directly in the modal
              onStationClick?.(station);
            }}
            onClose={() => setIsModalOpen(false)}
          />
        </ModalPortal>
      )}
    </>
  )
}

export default memo(StationList)

