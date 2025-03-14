"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { X, AlertCircle, Search } from "lucide-react"
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
import { NearPin } from "@/components/ui/icons/NearPin"
import { cn } from "@/lib/utils"
import { ensureGoogleMapsLoaded, createGeocoder, createAutocompleteService } from "@/lib/googleMaps"
import { createVirtualStationFromCar } from "@/lib/stationUtils"
import type { Car } from "@/types/cars"

/* -----------------------------------------------------------
   Departure / Arrival Icons
----------------------------------------------------------- */
interface IconProps {
  highlight: boolean
  step: number
}

const DepartureIcon = React.memo(({ highlight, step }: IconProps) => {
  return (
    <div className={cn("transition-all duration-300", highlight ? "text-blue-500" : "text-gray-400")}>
      {step === 1 ? <Search className="w-5 h-5 text-gray-200" /> : <MapPinDown className="w-6 h-6" />}
    </div>
  )
})
DepartureIcon.displayName = "DepartureIcon"

const ArrivalIcon = React.memo(({ highlight, step }: IconProps) => {
  return (
    <div className={cn("transition-all duration-300", highlight ? "text-blue-500" : "text-gray-400")}>
      {step === 3 ? <Search className="w-5 h-5 text-gray-200" /> : <MapPinUp className="w-6 h-6" />}
    </div>
  )
})
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

  // Initialize Google Maps services safely
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
        console.error("Failed to initialize Google Maps services:", error)
        toast.error("Map services unavailable. Please refresh the page.")
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

  const isStationSelected = Boolean(selectedStation)

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
    <div className="flex-1">
      {isStationSelected ? (
        <div className="px-1 py-1 text-white font-medium">{selectedStation!.properties.Place}</div>
      ) : (
        <div className="relative">
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
                // Small delay to allow clicking on dropdown items
                setTimeout(() => setIsDropdownOpen(false), 150)
              }}
              disabled={disabled}
              placeholder={placeholder}
              className={cn(
                "w-full bg-transparent text-white",
                "focus:outline-none",
                "placeholder:text-gray-500 disabled:cursor-not-allowed p-0 text-base transition-colors",
              )}
            />
            {isLoading ? (
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchText ? (
              <motion.button
                whileHover={{ scale: 1.1 }}
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
                className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
              >
                {predictions.map((prediction) => (
                  <motion.button
                    key={prediction.place_id}
                    whileHover={{ backgroundColor: "rgba(42, 42, 42, 0.8)" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(prediction)}
                    className="w-full px-2.5 py-1.5 text-left text-sm text-gray-200 transition-colors border-b border-[#2A2A2A] last:border-b-0"
                    type="button"
                  >
                    <div className="font-medium">{prediction.structured_formatting.main_text}</div>
                    <div className="text-xs text-gray-400">{prediction.structured_formatting.secondary_text}</div>
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
  onLocateMe?: () => void
  onScan?: () => void // For QR scanning
  isQrScanStation?: boolean
  virtualStationId?: number | null
  scannedCar?: Car | null
}

function StationSelector({
  onAddressSearch,
  onClearDeparture,
  onClearArrival,
  onLocateMe,
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

  // Use either passed scannedCar or get it from Redux
  const actualScannedCar = scannedCar || reduxScannedCar

  // Possibly create a "virtual station" if departure is from QR
  // Memoize the departure and arrival stations to prevent unnecessary recalculations
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

  // Memoize the distance calculation
  const distanceInKm = useMemo(() => (bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null), [bookingRoute])

  // Memoize the highlight states
  const highlightDeparture = useMemo(() => step <= 2, [step])
  const highlightArrival = useMemo(() => step >= 3, [step])

  // If route is present, show distance in KM
  // const distanceInKm = useMemo(() => (bookingRoute ? (bookingRoute.distance / 1000).toFixed(1) : null), [bookingRoute])

  // Step-based highlight
  // const highlightDeparture = step <= 2
  // const highlightArrival = step >= 3

  // "Locate me" logic
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.")
      return
    }

    const toastId = toast.loading("Finding your location...")

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(toastId)
        toast.success("Location found!")
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        dispatch(setSearchLocation(loc))
        onAddressSearch(loc)
      },
      (err) => {
        console.error("Geolocation error:", err)
        toast.dismiss(toastId)
        toast.error("Unable to retrieve location.")
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 },
    )
  }, [dispatch, onAddressSearch])

  const handleAddressSearch = useCallback(
    (location: google.maps.LatLngLiteral) => {
      dispatch(setSearchLocation(location))
      onAddressSearch(location)
    },
    [dispatch, onAddressSearch],
  )

  const handleClearDeparture = useCallback(() => {
    // Clear any dispatch route, also handle parent's onClear
    dispatch(clearDispatchRoute())
    onClearDeparture?.()
  }, [dispatch, onClearDeparture])

  const handleClearArrival = useCallback(() => {
    onClearArrival?.()
  }, [onClearArrival])

  const handleScan = useCallback(() => {
    onScan?.()
  }, [onScan])

  return (
    <div className="relative z-10 w-full max-w-screen-md mx-auto px-1">
      {/* Station Inputs Container */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="bg-[#1A1A1A]/90 backdrop-blur-xl rounded-xl px-2 py-2 space-y-1.5 border border-[#2A2A2A] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        style={{ overscrollBehavior: "none", touchAction: "none" }}
      >
        {/* If departure & arrival are the same, show an error */}
        <AnimatePresence>
          {departureId && arrivalId && departureId === arrivalId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 bg-red-900/20 rounded-lg border border-red-800/50"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
            "flex items-center gap-2 rounded-xl p-2 border transition-all duration-300",
            highlightDeparture
              ? "border-blue-500/30 bg-[#1D1D1D] shadow-[0_0_12px_rgba(59,130,246,0.15)]"
              : "border-[#2A2A2A] bg-[#1D1D1D]/50",
          )}
        >
          <DepartureIcon highlight={highlightDeparture} step={step} />
          <AddressSearch
            onAddressSelect={handleAddressSearch}
            disabled={step >= 3}
            placeholder="Where from?"
            selectedStation={departureStation}
          />
          {departureStation && step <= 3 && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClearDeparture}
              className="p-1 hover:bg-[#2A2A2A] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
              type="button"
              aria-label="Clear departure"
            >
              <X className="w-3 h-3" />
            </motion.button>
          )}
        </motion.div>

        {/* ARRIVAL input (only if step≥3) */}
        <AnimatePresence>
          {step >= 3 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2 border transition-all duration-300",
                highlightArrival
                  ? "border-blue-500/30 bg-[#1D1D1D] shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "border-[#2A2A2A] bg-[#1D1D1D]/50",
              )}
            >
              <ArrivalIcon highlight={highlightArrival} step={step} />
              <AddressSearch
                onAddressSelect={handleAddressSearch}
                disabled={step < 3}
                placeholder="Where to?"
                selectedStation={arrivalStation}
              />
              {arrivalStation && step <= 4 && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClearArrival}
                  className="p-1 hover:bg-[#2A2A2A] transition-colors flex-shrink-0 rounded-full text-gray-400 hover:text-white"
                  type="button"
                  aria-label="Clear arrival"
                >
                  <X className="w-3 h-3" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Info Bar and Action Buttons */}
      <div className="mt-1.5">
        <div className="flex items-center justify-between px-1">
          {/* Left side - Static Info Text */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/90 px-2.5 py-1 bg-[#1A1A1A]/80 backdrop-blur-md rounded-lg border border-[#2A2A2A]/50"
          >
            {step < 3 ? "Choose pick-up station" : "Select arrival station"}
          </motion.span>

          {/* Right side - Distance and Locate Me */}
          <div className="flex items-center gap-2">
            {departureStation && arrivalStation && distanceInKm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xs font-medium text-white px-2.5 py-1 bg-gradient-to-r from-blue-600 to-blue-500 backdrop-blur-md rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                {distanceInKm} km
              </motion.div>
            )}

            {/* Only show locate me button in steps 1 or 2 */}
            {(step === 1 || step === 2) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLocateMe || handleLocateMe}
                className="w-8 h-8 bg-[#1D1D1D] text-white rounded-full hover:bg-blue-600 transition-all duration-300 shadow-lg flex items-center justify-center border border-[#2A2A2A] hover:border-blue-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                type="button"
                aria-label="Find stations near me"
              >
                <NearPin className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(StationSelector)

