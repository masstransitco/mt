"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { X, AlertCircle, Search, Maximize2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { 
  selectBookingStep, 
  selectDepartureStationId, 
  selectArrivalStationId, 
  selectRoute,
  selectIsQrScanStation
} from "@/store/bookingSlice"
import { selectStationsWithDistance, type StationFeature } from "@/store/stationsSlice"
import { selectScannedCar } from "@/store/carSlice"
import { clearDispatchRoute } from "@/store/dispatchSlice"
import { setSearchLocation } from "@/store/userSlice"
import { MapPinDown } from "@/components/ui/icons/MapPinDown"
import { MapPinUp } from "@/components/ui/icons/MapPinUp"
import { cn } from "@/lib/utils"
import { ensureGoogleMapsLoaded, createGeocoder, createAutocompleteService } from "@/lib/googleMaps"
import type { Car } from "@/types/cars"
import { selectDispatchRoute } from "@/store/dispatchSlice"
import { createVirtualStationFromCar } from "@/lib/stationUtils"
import ModalPortal from "@/components/ModalPortal"

// Import the new LocateMeButton
import LocateMeButton from "@/components/ui/LocateMeButton"

// Lazy-load Google3DMapCard so we don't bundle the script in SSR
const Google3DMapCard = dynamic(() => import("@/components/3DMapCard"), {
  ssr: false,
  loading: () => (
    <div className="h-52 w-full bg-[#1a1a1a] rounded-xl flex items-center justify-center">
      <div className="animate-spin w-6 h-6 border-2 border-[#10a37f] border-t-transparent rounded-full" />
    </div>
  ),
})

/* -----------------------------------------------------------
   Circle markers for departure/arrival - Tesla style
----------------------------------------------------------- */
interface IconProps {
  highlight: boolean
  step: number
}

const DepartureIcon = React.memo(({ highlight, step }: IconProps & { isQrScan?: boolean }) => {
  // Get QR status from Redux
  const isQrScanStation = useAppSelector(selectIsQrScanStation);
  
  // BLUE for regular departure, GREEN for QR scanned departure
  const borderColor = isQrScanStation ? "#10A37F" : "#3E6AE1";
  const glowColor = isQrScanStation ? "rgba(16, 163, 127, 0.4)" : "rgba(62, 106, 225, 0.4)";
  const dotColor = isQrScanStation ? "#10A37F" : "#3E6AE1";
  
  return (
    <div className="transition-all duration-300">
      {step === 1 ? (
        // Search state
        <Search className="w-5 h-5 text-gray-200" />
      ) : (
        // Circle with border using our new color scheme
        <div 
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center",
            "border-2 transition-all duration-300",
            highlight ? `border-[${borderColor}]` : "border-gray-500"
          )}
          style={{
            background: "rgba(23, 23, 23, 0.95)",
            boxShadow: highlight ? `0 0 6px ${glowColor}` : "none",
            borderColor: highlight ? borderColor : "rgb(107, 114, 128)"
          }}
        >
          {step >= 3 && (
            // Inner dot for selected state
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }}></div>
          )}
        </div>
      )}
    </div>
  );
})
DepartureIcon.displayName = "DepartureIcon"

const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => {
  // RED for arrival
  const borderColor = "#E82127";
  const glowColor = "rgba(232, 33, 39, 0.4)";
  const dotColor = "#E82127";
  
  return (
    <div className="transition-all duration-300">
      {step === 3 ? (
        // Search state
        <Search className="w-5 h-5 text-gray-200" />
      ) : (
        // Circle with border for arrival (RED)
        <div 
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center", 
            "border-2 transition-all duration-300",
            highlight ? `border-[${borderColor}]` : "border-gray-500"
          )}
          style={{
            background: "rgba(23, 23, 23, 0.95)",
            boxShadow: highlight ? `0 0 6px ${glowColor}` : "none",
            borderColor: highlight ? borderColor : "rgb(107, 114, 128)"
          }}
        >
          {step >= 4 && (
            // Inner dot for selected state
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }}></div>
          )}
        </div>
      )}
    </div>
  );
})
ArrivalIcon.displayName = "ArrivalIcon"

/* -----------------------------------------------------------
   PredictionsDropdown Component
----------------------------------------------------------- */
interface PredictionsDropdownProps {
  predictions: google.maps.places.AutocompletePrediction[]
  inputRef: React.RefObject<HTMLInputElement>
  onSelect: (prediction: google.maps.places.AutocompletePrediction) => void
}

const PredictionsDropdown = React.memo(({ predictions, inputRef, onSelect }: PredictionsDropdownProps) => {
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({ 
    top: 0, 
    left: 0, 
    width: 0 
  })

  // Calculate position based on input element
  useEffect(() => {
    if (!inputRef.current) return;
    
    // Initial position calculation
    const calculatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect()
        
        // Position below the input
        setDropdownPosition({
          top: rect.bottom + 5, // Position slightly below the input
          left: rect.left,
          width: rect.width
        })
      }
    }
    
    // Calculate position immediately
    calculatePosition()
    
    // Recalculate on resize or scroll
    window.addEventListener('resize', calculatePosition)
    window.addEventListener('scroll', calculatePosition)
    
    return () => {
      window.removeEventListener('resize', calculatePosition)
      window.removeEventListener('scroll', calculatePosition)
    }
  }, [inputRef])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        // Click was outside the dropdown and input
        // We don't need to handle closing here as the input's onBlur does that
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [inputRef])

  // Prevent clicks from bubbling to avoid closing the dropdown
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 9999,
        transformOrigin: 'top',
      }}
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl max-h-60 overflow-y-auto"
    >
      {predictions.map((prediction) => (
        <motion.button
          key={prediction.place_id}
          whileHover={{ backgroundColor: "rgba(42,42,42,0.8)" }}
          onMouseDown={handleMouseDown}
          onClick={() => onSelect(prediction)}
          className="w-full px-2.5 py-1.5 text-left text-base text-gray-200 transition-colors border-b border-[#2a2a2a] last:border-b-0"
          type="button"
        >
          <div className="font-medium">{prediction.structured_formatting.main_text}</div>
          <div className="text-xs text-gray-400">
            {prediction.structured_formatting.secondary_text}
          </div>
        </motion.button>
      ))}
    </motion.div>
  )
})
PredictionsDropdown.displayName = "PredictionsDropdown"

/* -----------------------------------------------------------
   AddressSearch Component
----------------------------------------------------------- */
interface AddressSearchProps {
  onAddressSelect: (location: google.maps.LatLngLiteral) => void
  disabled?: boolean
  placeholder: string
  selectedStation?: StationFeature
}

const AddressSearch = React.memo(function AddressSearch({
  onAddressSelect,
  disabled,
  placeholder,
  selectedStation,
}: AddressSearchProps) {
  const [searchText, setSearchText] = useState("")
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mapsLoadedRef = useRef<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionInProgressRef = useRef<boolean>(false)

  // Initialize Google Maps services
  useEffect(() => {
    let isMounted = true
    const initServices = async () => {
      try {
        if (!mapsLoadedRef.current) {
          await ensureGoogleMapsLoaded()
          if (!isMounted) return
          mapsLoadedRef.current = true
        }
        if (!autocompleteService.current) {
          autocompleteService.current = await createAutocompleteService()
        }
        if (!geocoder.current) {
          geocoder.current = await createGeocoder()
        }
      } catch (error) {
        if (!isMounted) return
        console.error("Failed to initialize Maps services:", error)
        toast.error("Map services unavailable. Please refresh.")
      }
    }

    initServices()
    return () => {
      isMounted = false
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const isStationSelected = !!selectedStation
  
  // Clear search text when a station is selected externally (e.g., clicked on map)
  useEffect(() => {
    if (selectedStation && !selectionInProgressRef.current) {
      // Only clear if not already in the process of selecting via the dropdown
      setSearchText("")
    }
  }, [selectedStation])

  const searchPlaces = useCallback((input: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (!input.trim()) {
      setPredictions([])
      return
    }
    setIsLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (!autocompleteService.current) {
          await ensureGoogleMapsLoaded()
          autocompleteService.current = await createAutocompleteService()
        }
        const request: google.maps.places.AutocompleteRequest = {
          input,
          // @ts-ignore
          types: ["establishment", "geocode"],
          componentRestrictions: { country: "HK" },
        }
        const result = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve, reject) => {
          autocompleteService.current!.getPlacePredictions(request, (preds, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
              resolve(preds)
            } else {
              reject(new Error(`Places API error: ${status}`))
            }
          })
        })
        setPredictions(result.slice(0, 5))
        setIsDropdownOpen(result.length > 0)
      } catch (error) {
        console.error("Error fetching predictions:", error)
        setPredictions([])
        setIsDropdownOpen(false)
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }, [])

  const handleSelect = useCallback(
    async (prediction: google.maps.places.AutocompletePrediction) => {
      try {
        if (!geocoder.current) {
          await ensureGoogleMapsLoaded()
          geocoder.current = await createGeocoder()
        }
        const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.current!.geocode({ placeId: prediction.place_id }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
              resolve(results)
            } else {
              reject(new Error(`Geocoder error: ${status}`))
            }
          })
        })
        const location = result[0]?.geometry?.location
        if (location) {
          // Mark that a selection is in progress
          selectionInProgressRef.current = true
          
          // Set the text briefly to show what was selected
          setSearchText(prediction.structured_formatting.main_text)
          
          // Clear predictions and close dropdown
          setPredictions([])
          setIsDropdownOpen(false)
          
          // Call the callback to trigger station selection
          onAddressSelect({ lat: location.lat(), lng: location.lng() })
          
          // Clear the search text after a brief delay to allow the user to see what was selected
          setTimeout(() => {
            setSearchText("")
            selectionInProgressRef.current = false
          }, 200)
        } else {
          throw new Error("No location found in geocoder result")
        }
      } catch (error) {
        console.error("Geocoding error:", error)
        toast.error("Unable to locate address")
      }
    },
    [onAddressSelect],
  )

  return (
    <div className="station-selector rounded-xl z-99 flex-1">
      {isStationSelected ? (
        <div className="px-1 py-0.5 text-white text-base font-medium">{selectedStation!.properties.Place}</div>
      ) : (
        <div className="station-selector z-30 relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                searchPlaces(e.target.value)
              }}
              onFocus={() => setIsDropdownOpen(predictions.length > 0)}
              onBlur={() => {
                // small delay so user can click on dropdown
                setTimeout(() => setIsDropdownOpen(false), 150)
              }}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                "w-full bg-transparent text-white text-base",
                "focus:outline-none",
                "placeholder:text-gray-500 disabled:cursor-not-allowed p-0 transition-colors",
              )}
            />
            {isLoading ? (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[#10a37f] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchText ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setSearchText("")
                  setPredictions([])
                  setIsDropdownOpen(false)
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full transition-colors"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            ) : null}
          </div>
          <AnimatePresence>
            {isDropdownOpen && predictions.length > 0 && (
              <ModalPortal>
                <PredictionsDropdown 
                  predictions={predictions}
                  inputRef={inputRef}
                  onSelect={handleSelect}
                />
              </ModalPortal>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
})
AddressSearch.displayName = "AddressSearch"

/* -----------------------------------------------------------
   Main StationSelector
----------------------------------------------------------- */
interface StationSelectorProps {
  onAddressSearch: (location: google.maps.LatLngLiteral) => void
  onClearDeparture?: () => void
  onClearArrival?: () => void
  onScan?: () => void // for QR scanning
  isQrScanStation?: boolean
  virtualStationId?: number | null
  scannedCar?: Car | null
  animateToLocation?: (loc: google.maps.LatLngLiteral, zoom?: number) => void // for camera animation
}

function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
  onScan,
  isQrScanStation = false,
  virtualStationId = null,
  scannedCar = null,
  animateToLocation,
}: StationSelectorProps) {
  const dispatch = useAppDispatch()
  const step = useAppSelector(selectBookingStep)
  const departureId = useAppSelector(selectDepartureStationId)
  const arrivalId = useAppSelector(selectArrivalStationId)
  const stations = useAppSelector(selectStationsWithDistance)
  const bookingRoute = useAppSelector(selectRoute)
  const reduxScannedCar = useAppSelector(selectScannedCar)
  const dispatchRoute = useAppSelector(selectDispatchRoute)

  // Expand states for each station's map
  const [departureMapExpanded, setDepartureMapExpanded] = useState(false)
  const [arrivalMapExpanded, setArrivalMapExpanded] = useState(false)
  // Track animation state to disable clear button during animations
  const [isAnimating, setIsAnimating] = useState(false)
  const [animatingStationId, setAnimatingStationId] = useState<number | null>(null)

  // Subscribe to animation state manager
  useEffect(() => {
    import("@/lib/animationStateManager").then(module => {
      const animationStateManager = module.default;
      
      // Initialize state based on current animation status
      const initialState = animationStateManager.getState();
      setIsAnimating(initialState.isAnimating);
      setAnimatingStationId(initialState.targetId);
      
      // Subscribe to animation state changes
      const unsubscribe = animationStateManager.subscribe((state) => {
        setIsAnimating(state.isAnimating);
        setAnimatingStationId(state.targetId);
      });
      
      return unsubscribe;
    });
  }, []);

  // Possibly create a virtual station if departure is from a QR car
  const actualScannedCar = scannedCar || reduxScannedCar
  const departureStation = useMemo(() => {
    const isVirtualStation =
      isQrScanStation &&
      actualScannedCar &&
      departureId &&
      (virtualStationId === departureId || departureId === 1000000 + actualScannedCar.id)

    if (isVirtualStation && actualScannedCar) {
      const vStationId = virtualStationId || 1000000 + actualScannedCar.id
      return createVirtualStationFromCar(actualScannedCar, vStationId)
    }
    return stations.find((s) => s.id === departureId)
  }, [stations, departureId, isQrScanStation, virtualStationId, actualScannedCar])

  const arrivalStation = useMemo(() => stations.find((s) => s.id === arrivalId), [stations, arrivalId])

  // Compute route distance
  const distanceInKm = useMemo(() => (bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null), [bookingRoute])

  // highlight logic
  const highlightDeparture = useMemo(() => step <= 2, [step])
  const highlightArrival = useMemo(() => step >= 3, [step])

  // Compute pickup in X minutes = dispatchRoute.duration/60 + 15
  const pickupMins = useMemo(() => {
    if (!dispatchRoute?.duration) return null
    const drivingMins = dispatchRoute.duration / 60
    return Math.ceil(drivingMins + 15)
  }, [dispatchRoute])

  // Handlers to clear departure/arrival
  const handleClearDeparture = useCallback(() => {
    // Only allow clearing if not currently animating
    if (!isAnimating || animatingStationId !== departureId) {
      dispatch(clearDispatchRoute())
      setDepartureMapExpanded(false)
      onClearDeparture?.()
    } else {
      toast.success("Please wait for animation to complete")
    }
  }, [dispatch, onClearDeparture, isAnimating, animatingStationId, departureId])

  const handleClearArrival = useCallback(() => {
    // No animation restriction needed for arrival
    setArrivalMapExpanded(false)
    onClearArrival?.()
  }, [onClearArrival])

  // (Optional) handle scanning if needed
  // ...

  return (
    <>
      <div className="station-selector relative z-40 w-full max-w-screen-md mx-auto px-3 pt-3">
        <div className="flex flex-col w-full select-none">
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#1a1a1a] rounded-xl overflow-visible shadow-md"
            style={{ overscrollBehavior: "none", touchAction: "none" }}
          >
            {/* If departure & arrival are the same, show error */}
            <AnimatePresence>
              {departureId && arrivalId && departureId === arrivalId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 bg-red-900/20 border-b border-red-800/50"
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Departure and arrival stations cannot be the same</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* DEPARTURE input */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 transition-all duration-300 rounded-xl",
                highlightDeparture ? (isQrScanStation ? "bg-[rgba(16,163,127,0.08)]" : "bg-[rgba(62,106,225,0.08)]") : "bg-[#1a1a1a]",
                arrivalStation ? "border-b border-[#2a2a2a]" : "",
              )}
            >
              <DepartureIcon highlight={highlightDeparture} step={step} />
              <AddressSearch
                onAddressSelect={(location) => {
                  console.log(`[StationSelector] Address selected for departure (step ${step}), updating location:`, location);
                  // Dispatch to Redux first (important order)
                  dispatch(setSearchLocation(location))
                  // Then inform parent component to update UI
                  onAddressSearch(location)
                }}
                disabled={step >= 3}
                placeholder="Where from?"
                selectedStation={departureStation}
              />

              {/* Expand icon + clear button when we have a departureStation */}
              {departureStation && step <= 3 && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setDepartureMapExpanded(true)}
                    className="p-1 hover:bg-[#2a2a2a] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                    type="button"
                    aria-label="Expand map for departure"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </motion.button>

                  <motion.button
                    whileTap={isAnimating && animatingStationId === departureId ? {} : { scale: 0.9 }}
                    onClick={handleClearDeparture}
                    className={`p-1 ${isAnimating && animatingStationId === departureId 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-[#2a2a2a] hover:text-white cursor-pointer'
                    } transition-colors flex-shrink-0 rounded-full text-gray-400`}
                    type="button"
                    aria-label="Clear departure"
                    disabled={isAnimating && animatingStationId === departureId}
                  >
                    <X className="w-3 h-3" />
                  </motion.button>
                </>
              )}
            </motion.div>

            {/* ARRIVAL input (only if step>=3) */}
            <AnimatePresence>
              {step >= 3 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 transition-all duration-300 rounded-xl",
                    highlightArrival ? "bg-[rgba(232,33,39,0.08)]" : "bg-[#1a1a1a]",
                  )}
                >
                  <ArrivalIcon highlight={highlightArrival} step={step} />
                  <AddressSearch
                    onAddressSelect={(location) => {
                      console.log(`[StationSelector] Address selected for arrival (step ${step}), updating location:`, location);
                      // Dispatch to Redux first (important order)
                      dispatch(setSearchLocation(location))
                      // Then inform parent component to update UI
                      onAddressSearch(location)
                    }}
                    disabled={step < 3}
                    placeholder="Where to?"
                    selectedStation={arrivalStation}
                  />
                  {arrivalStation && step <= 4 && (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setArrivalMapExpanded(true)}
                        className="p-1 hover:bg-[#2a2a2a] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                        type="button"
                        aria-label="Expand map for arrival"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </motion.button>

                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleClearArrival}
                        className="p-1 hover:bg-[#2a2a2a] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                        type="button"
                        aria-label="Clear arrival"
                      >
                        <X className="w-3 h-3" />
                      </motion.button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Info Bar: distance + pickup time + locate me */}
          <div className="flex items-center justify-between gap-2 mt-1.5 px-1 w-full">
            <div className="flex items-center gap-2">
              {/* Distance indicator */}
              {departureStation && arrivalStation && distanceInKm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "text-xs font-medium text-white px-2 py-0.5 rounded-lg",
                    step >= 3 ? "bg-[#E82127]" : (isQrScanStation ? "bg-[#10A37F]" : "bg-[#3E6AE1]"),
                  )}
                >
                  {distanceInKm} km
                </motion.div>
              )}

              {/* Pickup time indicator on step 2 */}
              {step === 2 && pickupMins !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`text-xs font-medium text-white px-2 py-0.5 rounded-lg ${isQrScanStation ? "bg-[#10A37F]" : "bg-[#3E6AE1]"}`}
                >
                  Pickup in {pickupMins} minutes
                </motion.div>
              )}
            </div>

            {/* Show LocateMeButton in step 1 or 3 (whenever selecting a location is relevant) */}
            {(step === 1 || step === 3) && (
              <LocateMeButton 
                // Update Redux state and ensure search location is synchronized
                updateReduxState={true}
                animateToLocation={true}
                updateSearchLocation={true}
                onLocationFound={(loc) => {
                  console.log("[StationSelector] LocateMeButton found location:", loc);
                  // This directly calls the parent component's handler
                  onAddressSearch(loc);
                }}
                // Pass the direct animation function
                onAnimateToLocation={animateToLocation}
              />
            )}
          </div>
        </div>
      </div>

      {/* DEPARTURE MapCard expanded view */}
      {departureMapExpanded && departureStation && (
        <Google3DMapCard
          coordinates={[departureStation.geometry.coordinates[0], departureStation.geometry.coordinates[1]]}
          name={departureStation.properties.Place}
          address={departureStation.properties.Address}
          expanded={departureMapExpanded}
          onToggleExpanded={setDepartureMapExpanded}
          hideDefaultExpandButton
        />
      )}

      {/* ARRIVAL MapCard expanded view */}
      {arrivalMapExpanded && arrivalStation && (
        <Google3DMapCard
          coordinates={[arrivalStation.geometry.coordinates[0], arrivalStation.geometry.coordinates[1]]}
          name={arrivalStation.properties.Place}
          address={arrivalStation.properties.Address}
          expanded={arrivalMapExpanded}
          onToggleExpanded={setArrivalMapExpanded}
          hideDefaultExpandButton
        />
      )}
    </>
  )
}

export default React.memo(StationSelector)

