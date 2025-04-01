"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { X, AlertCircle, Search, Maximize2 } from "lucide-react"
import { toast } from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { useAppDispatch, useAppSelector } from "@/store/store"
import { selectBookingStep, selectDepartureStationId, selectArrivalStationId, selectRoute } from "@/store/bookingSlice"
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
   Icons for departure/arrival
----------------------------------------------------------- */
interface IconProps {
  highlight: boolean
  step: number
}

const DepartureIcon = React.memo(({ highlight, step }: IconProps) => (
  <div className={cn("transition-all duration-300", highlight ? "text-[#10a37f]" : "text-gray-400")}>
    {step === 1 ? (
      <Search className="w-5 h-5 text-gray-200" />
    ) : step >= 3 ? (
      // Green circle indicator for step 3 and beyond
      <div className="w-5 h-5 rounded-full bg-[#10a37f] flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-[#0d8c6d] border border-[#0a7259]"></div>
      </div>
    ) : (
      <MapPinDown className="w-5 h-5" />
    )}
  </div>
))
DepartureIcon.displayName = "DepartureIcon"

const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => (
  <div className={cn("transition-all duration-300", highlight ? "text-[#276EF1]" : "text-gray-400")}>
    {step === 3 ? <Search className="w-5 h-5 text-gray-200" /> : <MapPinUp className="w-5 h-5" />}
  </div>
))
ArrivalIcon.displayName = "ArrivalIcon"

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
          onAddressSelect({ lat: location.lat(), lng: location.lng() })
          setSearchText(prediction.structured_formatting.main_text)
          setPredictions([])
          setIsDropdownOpen(false)
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
        <div className="station-selector z-10 relative">
          <div className="relative">
            <input
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
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto z-[9999]"
              >
                {predictions.map((prediction) => (
                  <motion.button
                    key={prediction.place_id}
                    whileHover={{ backgroundColor: "rgba(42,42,42,0.8)" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(prediction)}
                    className="station-selector rounded-xl w-full px-2.5 py-1.5 text-left text-base text-gray-200 transition-colors border-b border-[#2a2a2a] last:border-b-0 z-[9999]"
                    type="button"
                  >
                    <div className="station-selector font-medium">{prediction.structured_formatting.main_text}</div>
                    <div className="stationselector text-xs text-gray-400">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </motion.button>
                ))}
              </motion.div>
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
}

function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
  onScan,
  isQrScanStation = false,
  virtualStationId = null,
  scannedCar = null,
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
    dispatch(clearDispatchRoute())
    setDepartureMapExpanded(false)
    onClearDeparture?.()
  }, [dispatch, onClearDeparture])

  const handleClearArrival = useCallback(() => {
    setArrivalMapExpanded(false)
    onClearArrival?.()
  }, [onClearArrival])

  // (Optional) handle scanning if needed
  // ...

  return (
    <>
      <div className="station-selector relative z-10 w-full max-w-screen-md mx-auto px-3 pt-3">
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
                highlightDeparture ? "bg-[#222222]" : "bg-[#1a1a1a]",
                arrivalStation ? "border-b border-[#2a2a2a]" : "",
              )}
            >
              <DepartureIcon highlight={highlightDeparture} step={step} />
              <AddressSearch
                onAddressSelect={(location) => {
                  dispatch(setSearchLocation(location))
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
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClearDeparture}
                    className="p-1 hover:bg-[#2a2a2a] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                    type="button"
                    aria-label="Clear departure"
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
                    highlightArrival ? "bg-[#222222]" : "bg-[#1a1a1a]",
                  )}
                >
                  <ArrivalIcon highlight={highlightArrival} step={step} />
                  <AddressSearch
                    onAddressSelect={(location) => {
                      dispatch(setSearchLocation(location))
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
          <div className="inline-flex items-center gap-2 mt-1.5 px-1 w-auto">
            {/* Distance indicator */}
            {departureStation && arrivalStation && distanceInKm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "text-xs font-medium text-white px-2 py-0.5 rounded-lg",
                  step >= 3 ? "bg-[#276EF1]" : "bg-[#10a37f]",
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
                className="text-xs font-medium text-white px-2 py-0.5 rounded-lg bg-[#10a37f]"
              >
                Pickup in {pickupMins} minutes
              </motion.div>
            )}

            {/* Use LocateMeButton at step 1, but pass a callback to replicate old logic */}
            {step === 1 && (
              <LocateMeButton
                onLocateSuccess={(loc) => {
                  // Similar to older handleLocateMe: call parent
                  onAddressSearch(loc)
                }}
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

