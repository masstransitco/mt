"use client"

import { memo, useState, useEffect, useMemo, useRef } from "react"
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
    const routeAvailable = walkingRouteStatus === 'succeeded' && !!walkingRoute;
    
    // If a route is available but our UI doesn't show it as active, update the UI
    if (routeAvailable && !isWalkingRouteShown) {
      console.log("[StationList] Walking route is available, updating UI to show it's active");
      setIsWalkingRouteShown(true);
    } 
    // If no route is available but our UI shows one as active, update the UI
    else if (!routeAvailable && isWalkingRouteShown) {
      console.log("[StationList] Walking route is no longer available, updating UI");
      setIsWalkingRouteShown(false);
    }
  }, [walkingRouteStatus, walkingRoute, isWalkingRouteShown]);
  
  // Calculate walking time in minutes - prioritizing showing nearest station time when no route selected
  const walkingMinutes = useMemo((): number => {
    // If we have a real walking route from the API, use that duration
    if (walkingDuration !== null && isWalkingRouteShown) {
      return walkingDuration;
    }
    
    // IMPORTANT: The source location is determined here, making 
    // user location and search location mutually exclusive.
    // 
    // If a search location exists, we ALWAYS use it as the source
    // If no search location exists, we use the user's current location
    // This ensures consistent behavior with the map display
    const referenceLocation = searchLocation || userLocation
    if (!referenceLocation) return 5 // default value when no location available
    
    // If no route is shown, always show time to the nearest station (first in list)
    // This is to ensure we always show the most relevant information
    const stationToUse = isWalkingRouteShown 
      ? stations.find(s => s.id === selectedStationId) // use selected station if route is shown
      : visibleStations[0] // use nearest station if no route is shown
      
    if (!stationToUse) return 5 // default value when no station available
    
    // Calculate approx walking time based on distance
    // Assuming average walking speed of 1.4 m/s (5 km/h)
    const [lng, lat] = stationToUse.geometry.coordinates
    
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
  }, [selectedStationId, stations, visibleStations, userLocation, searchLocation, walkingDuration, isWalkingRouteShown])

  // Simple loading state for transitions
  const [isLoading, setIsLoading] = useState(false);
  
  // Track station array changes and location changes with a simple key comparison
  const prevStationsKey = useRef<string>("");
  const prevLocationKey = useRef<string>("");
  
  // Location change detection - generate a key from current locations
  const locationKey = useMemo(() => {
    const userKey = userLocation ? `${userLocation.lat},${userLocation.lng}` : "null";
    const searchKey = searchLocation ? `${searchLocation.lat},${searchLocation.lng}` : "null";
    return `${userKey}|${searchKey}`;
  }, [userLocation, searchLocation]);
  
  // Station list change detection - create a key from first few station IDs
  const stationsKey = useMemo(() => {
    return stations.slice(0, 3).map(s => s.id).join(",");
  }, [stations]);
  
  // Enhanced effect for detecting changes to stations or location
  // and automatically showing route to nearest station
  useEffect(() => {
    // First, check if this is a real change that affects the list
    const stationsChanged = stationsKey !== prevStationsKey.current;
    const locationChanged = locationKey !== prevLocationKey.current;
    
    if (stationsChanged || locationChanged) {
      console.log("[StationList] Data changed, showing loading state");
      console.log(`Stations changed: ${stationsChanged}, Location changed: ${locationChanged}`);
      
      // Show loading indicator
      setIsLoading(true);
      
      // Update refs to track current state
      prevStationsKey.current = stationsKey;
      prevLocationKey.current = locationKey;
      
      // ALWAYS reset user selection when location changes
      if (locationChanged) {
        console.log('[StationList] Location changed, resetting user selection');
        setUserHasSelected(false);
      }
      
      // ALWAYS select first station when:
      // 1. Location changed (regardless of user selection)
      // 2. We don't have a selected station
      if (visibleStations.length > 0 && (locationChanged || !selectedStationId)) {
        const stationId = visibleStations[0].id;
        console.log(`[StationList] Auto-selecting first station: ${stationId}`);
        setSelectedStationId(stationId);
        dispatch(setListSelectedStation(stationId));
        
        // No automatic route generation when location changes
        // Just clear any existing routes
        if (isWalkingRouteShown) {
          console.log(`[StationList] Location changed, clearing walking route`);
          dispatch(clearWalkingRoute());
          setIsWalkingRouteShown(false);
        }
      } else if (locationChanged && selectedStationId) {
        // If location changed and we have a selected station,
        // just clear any existing route - don't auto-generate a new one
        if (isWalkingRouteShown) {
          console.log(`[StationList] Location changed with selected station, clearing walking route`);
          dispatch(clearWalkingRoute());
          setIsWalkingRouteShown(false);
        }
      }
      
      // Short loading state with no delay
      setIsLoading(false);
    }
  }, [stationsKey, locationKey, visibleStations, selectedStationId, userHasSelected, dispatch, isWalkingRouteShown, stations, searchLocation, userLocation])
  
  // Force an update whenever the component becomes visible (by checking if stations array is non-empty)
  useEffect(() => {
    if (stations.length > 0 && !isLoading) {
      console.log("[StationList] Component visible with stations, ensuring selection");
      
      // If no station is selected yet, select the first one
      if (!selectedStationId && visibleStations.length > 0) {
        const stationId = visibleStations[0].id;
        console.log(`[StationList] Auto-selecting first station after visibility: ${stationId}`);
        setSelectedStationId(stationId);
        dispatch(setListSelectedStation(stationId));
      }
    }
  }, [stations.length, visibleStations, selectedStationId, dispatch, isLoading]);
  
  // Simplified effect to respond to listSelectedStationId changes from Redux
  useEffect(() => {
    if (listSelectedStationId === null && selectedStationId !== null) {
      // Reset local state when list selection is cleared in Redux
      setSelectedStationId(null);
    }
  }, [listSelectedStationId, selectedStationId]);
  
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

  // Simplified to just be a passive display - no toggling
  const handleShowWalkingRoute = () => {
    // No-op - we don't allow toggling anymore
    // Routes are only drawn when a station is selected
    console.log('[StationList] Walking display clicked - no action');
  }

  const handleStationSelect = (station: StationFeature) => {
    console.log('[StationList] Station selected in list:', station.id);
    setSelectedStationId(station.id)
    dispatch(setListSelectedStation(station.id))
    // Mark that user has made a manual selection
    setUserHasSelected(true)
    
    // When user explicitly selects a station from the list, show the walking route
    // Capture fresh references to locations to ensure we use latest data
    const currentSearchLocation = searchLocation;
    const currentUserLocation = userLocation;
    const currentReferenceLocation = currentSearchLocation || currentUserLocation;
    
    // Only when a user clicks on a station, we fetch and show the walking route
    if (currentReferenceLocation) {
      console.log(`[StationList] User selected station, fetching walking route to: ${station.id}`);
      console.log(`[StationList] Using fresh location data:`, currentReferenceLocation);
      
      // First clear any existing route
      dispatch(clearWalkingRoute());
      
      // Then fetch new route with fresh location data
      setTimeout(() => {
        dispatch(fetchWalkingRoute({
          locationFrom: currentReferenceLocation,
          station: station
        }));
        setIsWalkingRouteShown(true);
      }, 150);
    }
  }

  const handleStationConfirm = (station: StationFeature) => {
    console.log('[StationList] Confirming station selection:', station.id);
    
    // Use our centralized manager for station selection
    // The stationSelectionManager will clear the walking route automatically
    import("@/lib/stationSelectionManager").then(module => {
      const stationSelectionManager = module.default;
      stationSelectionManager.selectStation(station.id, false);
    });
    
    // Also pass to parent component for backward compatibility
    onStationClick?.(station)
    
    // Reset flag after user confirms their selection
    setUserHasSelected(false)
    
    // Update the local state to reflect walking route status
    if (isWalkingRouteShown) {
      setIsWalkingRouteShown(false)
    }
  }

  return (
    <>
      <div className="flex flex-col w-full select-none px-4">
        <motion.div
          className={`${className} w-full`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Simple loading indicator during transitions */}
          {isLoading && (
            <div className="w-full p-3 bg-[#1a1a1a] rounded-xl shadow-md mb-2 flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-[#10a37f] border-t-transparent rounded-full mr-2" />
              <span className="text-sm text-gray-400">Updating stations...</span>
            </div>
          )}
          <div className="mb-2">
            <NearestStationDisplay 
              minutesAway={walkingMinutes}
              locationName={
                // When a route is shown, use the selected station name
                isWalkingRouteShown && selectedStationId
                  ? stations.find(s => s.id === selectedStationId)?.properties.Place
                  // Otherwise, show the nearest station name
                  : visibleStations[0]?.properties.Place
              }
              sourceLocationName={searchLocation ? "search location" : "current location"}
              isAccurateTime={isWalkingRouteShown && walkingRouteStatus === 'succeeded'}
              onShowWalkingRoute={handleShowWalkingRoute}
              isWalkingRouteShown={isWalkingRouteShown}
            />
          </div>
          <div className="space-y-1.5 mt-1.5">
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

