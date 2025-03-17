"use client"

import { memo, useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react"
import { toast } from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { Clock, Footprints, Info } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/store"
import {
  selectBookingStep,
  advanceBookingStep,
  selectRoute,
  selectDepartureStationId,
  selectArrivalStationId,
  fetchRoute,
} from "@/store/bookingSlice"
import { saveBookingDetails } from "@/store/bookingThunks"
import { selectDispatchRoute } from "@/store/dispatchSlice"
import type { StationFeature } from "@/store/stationsSlice"
import { cn } from "@/lib/utils"
import { selectIsSignedIn, selectHasDefaultPaymentMethod } from "@/store/userSlice"
import { chargeUserForTrip } from "@/lib/stripe"
import { auth } from "@/lib/firebase"
import { selectScannedCar } from "@/store/carSlice"
import TripSheet from "./TripSheet"
import WalletModal from "@/components/ui/WalletModal"
import PaymentResultModal from "@/components/ui/PaymentResultModal"

/**
 * Dynamically import PaymentSummary
 */
const PaymentSummary = dynamic(
  () => import("@/components/ui/PaymentComponents").then((mod) => ({ default: mod.PaymentSummary })),
  {
    loading: () => <div className="text-sm text-gray-400">Loading payment...</div>,
    ssr: false,
  }
)

// Map fallback component
function MapCardFallback() {
  return (
    <div className="h-44 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
}

// Lazy-loaded components with progressive loading and caching strategy
const CarGrid = dynamic(() => import("./booking/CarGrid"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading vehicles</div>
    if (isLoading && pastDelay) {
      return (
        <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      )
    }
    return null
  },
  ssr: false,
})

const MapCard = dynamic(() => import("./MapCard"), {
  loading: ({ error, isLoading, pastDelay }) => {
    if (error) return <div>Error loading map</div>
    if (isLoading && pastDelay) {
      return <MapCardFallback />
    }
    return null
  },
  ssr: false,
})

/** StationDetailProps interface */
interface StationDetailProps {
  activeStation: StationFeature | null
  stations?: StationFeature[]
  onConfirmDeparture?: () => void
  onOpenSignIn: () => void
  onDismiss?: () => void
  isQrScanStation?: boolean
  onClose?: () => void
  isMinimized?: boolean
}

/**
 * Enhanced persistent CarGrid with smart loading
 * - Maintains loaded state across renders
 * - Uses caching to avoid reloading
 * - Only renders when actually needed
 */
const PersistentCarGrid = memo(function PersistentCarGrid({
  isVisible,
  isQrScanStation,
  scannedCar,
}: {
  isVisible: boolean
  isQrScanStation?: boolean
  scannedCar?: any
}) {
  // Track component state
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded'>('idle')
  const mountRef = useRef(false)
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Use this to prevent flash of loading state when quickly toggling visibility
  useEffect(() => {
    // Component mounted
    mountRef.current = true
    
    // When component becomes visible
    if (isVisible) {
      // Cancel any pending hide timeout
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
        visibilityTimeoutRef.current = null
      }
      
      // If not already loading/loaded, start loading
      if (status === 'idle') {
        setStatus('loading')
      }
    } 
    // When component becomes invisible
    else {
      // Delay hiding to avoid flicker with quick toggles
      visibilityTimeoutRef.current = setTimeout(() => {
        if (mountRef.current && status !== 'idle') {
          // Reset to idle only if not visible for a while
          setStatus('idle')
        }
      }, 300) // Longer delay to keep component alive for a bit
    }
    
    // Clean up on unmount
    return () => {
      mountRef.current = false
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }
    }
  }, [isVisible, status])
  
  // When loading completes
  const handleLoadComplete = useCallback(() => {
    if (mountRef.current) {
      setStatus('loaded')
    }
  }, [])
  
  // If the component is idle, render nothing
  if (status === 'idle') return null
  
  // Show skeleton during initial load
  if (status === 'loading') {
    return (
      <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-xs text-gray-400">Loading vehicles...</div>
      </div>
    )
  }
  
  // Show the actual grid once loaded
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onAnimationComplete={handleLoadComplete}
        >
          <CarGrid
            className="h-32 w-full"
            isVisible={true}
            isQrScanStation={isQrScanStation}
            scannedCar={scannedCar}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
})
PersistentCarGrid.displayName = "PersistentCarGrid"

/** InfoPopup component */
const InfoPopup = memo(function InfoPopup({
  text = "Parking entry and exits are contactless and requires no further payments.",
}: {
  text?: string
}) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleShowInfo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation() // Prevent click propagation
    setIsVisible(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleShowInfo}
        className="text-gray-400 hover:text-gray-300 focus:outline-none"
        aria-label="More information"
      >
        <Info size={14} />
      </button>

      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-gray-800 text-xs text-white w-48 text-center shadow-lg z-50">
          <div className="relative">
            {text}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  )
})
InfoPopup.displayName = "InfoPopup"

/** StationStats component */
const StationStats = memo(function StationStats({
  activeStation,
  step,
  driveTimeMin,
  parkingValue,
  isVirtualCarStation,
}: {
  activeStation: StationFeature
  step: number
  driveTimeMin: string | null
  parkingValue: string
  isVirtualCarStation: boolean
}) {
  const isVirtualCarLocation = isVirtualCarStation || activeStation.properties?.isVirtualCarLocation

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 space-y-2 border border-gray-700">
      {isVirtualCarLocation ? (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-green-400" />
            <span>Status</span>
          </div>
          <span className="font-medium text-green-400">Ready to Drive</span>
        </div>
      ) : activeStation.properties.waitTime ? (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Est. Wait Time</span>
          </div>
          <span className="font-medium text-white">{activeStation.properties.waitTime} min</span>
        </div>
      ) : null}

      {step === 2 && typeof activeStation.distance === "number" && !isVirtualCarLocation && (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Footprints className="w-3.5 h-3.5 text-blue-400" />
            <span>Distance from You</span>
          </div>
          <span className="font-medium text-white">{activeStation.distance.toFixed(1)} km</span>
        </div>
      )}

      {step === 4 && driveTimeMin && (
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-gray-300">
            <span>Drive Time</span>
          </div>
          <span className="font-medium text-white">{driveTimeMin} min</span>
        </div>
      )}

      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5 text-gray-300">
          <span>Departure Gate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-white">{isVirtualCarLocation ? "Current Location" : "Contactless"}</span>
          {!isVirtualCarLocation && <InfoPopup />}
        </div>
      </div>
    </div>
  )
})
StationStats.displayName = "StationStats"

/** Confirm button component */
const ConfirmButton = memo(function ConfirmButton({
  isDepartureFlow,
  charging,
  disabled,
  onClick,
  isVirtualCarLocation,
}: {
  isDepartureFlow: boolean
  charging: boolean
  disabled: boolean
  onClick: () => void
  isVirtualCarLocation?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center",
        "text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-blue-100/50 disabled:cursor-not-allowed",
        isVirtualCarLocation && "bg-green-600 hover:bg-green-700",
      )}
    >
      {charging ? (
        <>
          <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
          Processing...
        </>
      ) : isDepartureFlow ? (
        isVirtualCarLocation ? (
          "Start Driving Now"
        ) : (
          "Choose Return"
        )
      ) : (
        "Confirm Trip"
      )}
    </button>
  )
})
ConfirmButton.displayName = "ConfirmButton"

// Improved touch handling helper with passive support
function useTouchScrollHandler() {
  const touchStartHandler = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.currentTarget.dataset.touchY = e.touches[0].clientY.toString()
  }, [])
  
  const touchMoveHandler = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const scrollTop = el.scrollTop
    const scrollHeight = el.scrollHeight
    const height = el.clientHeight
    const touchY = el.dataset.touchY ? parseFloat(el.dataset.touchY) : 0
    const currentY = e.touches[0].clientY
    const delta = currentY - touchY
    
    // Prevent overscroll only at boundaries
    if ((scrollTop <= 0 && delta > 0) || (scrollTop + height >= scrollHeight && delta < 0)) {
      e.preventDefault()
    }
    
    // Update current touch position
    el.dataset.touchY = currentY.toString()
  }, [])
  
  const touchEndHandler = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.touchY
  }, [])
  
  return {
    onTouchStart: touchStartHandler,
    onTouchMove: touchMoveHandler,
    onTouchEnd: touchEndHandler
  }
}

/**
 * Main StationDetail component with enhanced performance and caching
 */
function StationDetail({
  activeStation,
  stations = [],
  onConfirmDeparture = () => {},
  onOpenSignIn = () => {},
  onDismiss = () => {},
  isQrScanStation = false,
  onClose = () => {},
  isMinimized = false,
}: StationDetailProps) {
  const dispatch = useAppDispatch()

  // Redux states
  const step = useAppSelector(selectBookingStep)
  const route = useAppSelector(selectRoute)
  const departureId = useAppSelector(selectDepartureStationId)
  const arrivalId = useAppSelector(selectArrivalStationId)
  const dispatchRoute = useAppSelector(selectDispatchRoute)
  const isSignedIn = useAppSelector(selectIsSignedIn)
  const hasDefaultPaymentMethod = useAppSelector(selectHasDefaultPaymentMethod)
  const scannedCarRedux = useAppSelector(selectScannedCar)

  // Flow booleans - memoized once
  const isDepartureFlow = useMemo(() => step <= 2, [step])

  // Local states
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [charging, setCharging] = useState(false)
  const [paymentResultModalOpen, setPaymentResultModalOpen] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentReference, setPaymentReference] = useState("")
  const [cardLast4, setCardLast4] = useState("")
  
  // State that controls actual CarGrid visibility with debouncing
  const [shouldShowCarGrid, setShouldShowCarGrid] = useState(false)
  
  // Refs for throttling and debouncing
  const routeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastRenderTimeRef = useRef(Date.now())
  const lastRouteUpdateRef = useRef(Date.now())
  const carGridVisibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Store the render status to prevent unnecessary checks
  const renderStatusRef = useRef({
    initialized: true,
    attempted: true
  })

  // Custom touch scroll handler
  const touchScrollHandlers = useTouchScrollHandler()

  // Get stations by ID for the receipt or display - memoized
  const departureStation = useMemo(() => 
    stations.find((s) => s.id === departureId) || null, 
    [stations, departureId]
  )
  
  const arrivalStation = useMemo(() => 
    stations.find((s) => s.id === arrivalId) || null, 
    [stations, arrivalId]
  )

  // For the "Departure Gate" label value - memoized
  const parkingValue = useMemo(() => {
    if (step === 2 || step === 4) return "Contactless"
    return ""
  }, [step])

  // Convert route duration => minutes - memoized
  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null
    return Math.round(route.duration / 60).toString()
  }, [route, departureId, arrivalId])

  // Identify if station is a "virtual" car location
  const isVirtualCarLocation = useMemo(() => 
    !!activeStation?.properties?.isVirtualCarLocation, 
    [activeStation]
  )
  
  // Optimized logic for CarGrid visibility with debouncing
  useEffect(() => {
    // Determine if CarGrid should be visible based on current state
    const shouldShow = 
      !isMinimized && 
      isDepartureFlow && 
      step === 2 && 
      (!!activeStation || isQrScanStation);
    
    // Clear any existing visibility timeout
    if (carGridVisibilityTimeoutRef.current) {
      clearTimeout(carGridVisibilityTimeoutRef.current);
      carGridVisibilityTimeoutRef.current = null;
    }
    
    // Use different timing strategies for showing vs hiding
    if (shouldShow) {
      // When showing, use a shorter delay to feel responsive
      carGridVisibilityTimeoutRef.current = setTimeout(() => {
        setShouldShowCarGrid(true);
      }, 50);
    } else {
      // When hiding, use a longer delay to avoid flicker
      carGridVisibilityTimeoutRef.current = setTimeout(() => {
        setShouldShowCarGrid(false);
      }, 250);
    }
    
    // Clean up on unmount
    return () => {
      if (carGridVisibilityTimeoutRef.current) {
        clearTimeout(carGridVisibilityTimeoutRef.current);
      }
    };
  }, [isMinimized, isDepartureFlow, step, activeStation, isQrScanStation]);

  // Efficient route fetching with throttling - only fetch when needed
  useEffect(() => {
    // Only proceed if the sheet is expanded and we have the needed data
    if (!isMinimized && step >= 3 && departureId && arrivalId && stations.length > 0) {
      // Get timestamps for throttling
      const now = Date.now();
      const timeSinceLastUpdate = now - lastRouteUpdateRef.current;
      
      // Skip if we recently updated (throttle to once per second)
      if (timeSinceLastUpdate < 1000) {
        return;
      }
      
      // Clear previous timeout
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
      
      // Fetch with a slight delay to avoid excessive API calls during transitions
      routeFetchTimeoutRef.current = setTimeout(() => {
        // Find the needed stations
        const depStation = stations.find((s) => s.id === departureId);
        const arrStation = stations.find((s) => s.id === arrivalId);
        
        if (depStation && arrStation) {
          // Update the timestamp and dispatch the action
          lastRouteUpdateRef.current = Date.now();
          dispatch(fetchRoute({ departure: depStation, arrival: arrStation }));
        }
      }, 250);
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [isMinimized, step, departureId, arrivalId, stations, dispatch]);

  // Wallet modal handlers
  const handleOpenWalletModal = useCallback(() => {
    setWalletModalOpen(true)
  }, [])
  
  const handleCloseWalletModal = useCallback(() => {
    setWalletModalOpen(false)
  }, [])

  // Payment result handlers
  const handlePaymentContinue = useCallback(() => {
    setPaymentResultModalOpen(false)
    if (paymentSuccess) {
      dispatch(advanceBookingStep(5))
      dispatch(saveBookingDetails())
    }
  }, [dispatch, paymentSuccess])

  const handlePaymentRetry = useCallback(() => {
    setPaymentResultModalOpen(false)
  }, [])

  // Confirm button logic - memoized to prevent recreations
  const handleConfirm = useCallback(async () => {
    // Step 2 => proceed to step 3 (choose arrival)
    if (isDepartureFlow && step === 2) {
      dispatch(advanceBookingStep(3))
      if (isVirtualCarLocation) {
        toast.success("Car ready! Now select your dropoff station.")
      } else {
        toast.success("Departure station confirmed! Now choose your arrival station.")
      }
      onConfirmDeparture()
      return
    }

    // Step 4 => handle payment
    if (!isDepartureFlow && step === 4) {
      if (!isSignedIn) {
        onOpenSignIn()
        return
      }
      if (!hasDefaultPaymentMethod) {
        toast.error("Please add/set a default payment method first.")
        handleOpenWalletModal()
        return
      }

      try {
        setCharging(true)
        // Example charge of $50 => 5000 cents
        const result = await chargeUserForTrip(auth.currentUser!.uid, 5000)

        if (!result.success) {
          throw new Error(result.error || "Charge failed")
        }
        // Payment succeeded
        setPaymentSuccess(true)
        setPaymentReference(result.transactionId || "TXN" + Date.now().toString().slice(-8))
        setCardLast4(result.cardLast4 || "4242")
        setPaymentResultModalOpen(true)
      } catch (err) {
        console.error("Failed to charge trip =>", err)
        setPaymentSuccess(false)
        setPaymentResultModalOpen(true)
      } finally {
        setCharging(false)
      }
    }
  }, [
    isDepartureFlow,
    step,
    isVirtualCarLocation,
    dispatch,
    onConfirmDeparture,
    isSignedIn,
    onOpenSignIn,
    hasDefaultPaymentMethod,
    handleOpenWalletModal,
  ])

  // Calculate estimated pickup time - memoized
  const estimatedPickupTime = useMemo(() => {
    if (isVirtualCarLocation || !dispatchRoute?.duration) return null
    const now = new Date()
    const pickupTime = new Date(now.getTime() + dispatchRoute.duration * 1000)
    const hh = pickupTime.getHours() % 12 || 12
    const mm = pickupTime.getMinutes()
    const ampm = pickupTime.getHours() >= 12 ? "pm" : "am"
    return `${hh}:${mm < 10 ? "0" + mm : mm}${ampm}`
  }, [isVirtualCarLocation, dispatchRoute])

  // If user is already in final step (5), show TripSheet
  if (step === 5) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40 pointer-events-auto" />
        <div className="fixed inset-0 z-50 flex flex-col">
          <TripSheet />
        </div>
      </>
    )
  }

  // If not initialized yet
  if (!renderStatusRef.current.initialized) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // If no active station, show a helpful message
  if (!activeStation) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs text-gray-300">
          {isDepartureFlow
            ? "Select a departure station from the map or list below."
            : "Select an arrival station from the map or list below."}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-gray-800/50 flex items-center gap-1.5 text-gray-300">
            <span>View parking</span>
          </div>
          <div className="p-2 rounded-lg bg-gray-800/50 flex items-center gap-1.5 text-gray-300">
            <span>Check availability</span>
          </div>
        </div>
      </div>
    )
  }

  // Calculate a unique key for forcing remount when needed
  const renderKey = `station-detail-${departureId || 0}-${arrivalId || 0}-${step}`

  return (
    <>
      <motion.div
        key={renderKey}
        className="p-3 space-y-2 overscroll-contain"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "tween", duration: 0.2 }}
        {...touchScrollHandlers}
      >
        {/* Map preview with proper touch handling */}
        <Suspense fallback={<MapCardFallback />}>
          <div className="pointer-events-auto">
            <MapCard
              coordinates={[activeStation.geometry.coordinates[0], activeStation.geometry.coordinates[1]]}
              name={activeStation.properties.Place}
              address={activeStation.properties.Address}
              className="mt-0 mb-1.5 h-44 w-full"
            />
          </div>
        </Suspense>

        {/* Station Stats */}
        <div className="pointer-events-auto">
          <StationStats
            activeStation={activeStation}
            step={step}
            driveTimeMin={driveTimeMin}
            parkingValue={parkingValue}
            isVirtualCarStation={isVirtualCarLocation}
          />
        </div>

        {/* CarGrid + Confirm Button for step=2 with reduced space between */}
        {isDepartureFlow && step === 2 && (
          <div className="space-y-3 pointer-events-auto">
            {/* Enhanced persistent car grid component */}
            <PersistentCarGrid 
              isVisible={shouldShowCarGrid} 
              isQrScanStation={isQrScanStation} 
              scannedCar={scannedCarRedux} 
            />
            
            <ConfirmButton
              isDepartureFlow={isDepartureFlow}
              charging={charging}
              disabled={charging || !(step === 2 || step === 4)}
              onClick={handleConfirm}
              isVirtualCarLocation={isVirtualCarLocation}
            />
          </div>
        )}

        {/* PaymentSummary if step=4 and user is signed in */}
        {step === 4 && (
          <div className="space-y-1.5 pointer-events-auto">
            {isSignedIn ? (
              <>
                <PaymentSummary onOpenWalletModal={handleOpenWalletModal} />
                <ConfirmButton
                  isDepartureFlow={isDepartureFlow}
                  charging={charging}
                  disabled={charging || !(step === 2 || step === 4)}
                  onClick={handleConfirm}
                  isVirtualCarLocation={isVirtualCarLocation}
                />
              </>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="w-full py-2.5 text-sm font-medium rounded-md transition-colors
                          text-white bg-blue-500/80 hover:bg-blue-600/80 flex items-center justify-center"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Modals - kept outside the motion div */}
      <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
      
      <PaymentResultModal
        isOpen={paymentResultModalOpen}
        isSuccess={paymentSuccess}
        amount={5000} // e.g. HK$50.00 in cents
        referenceId={paymentReference}
        cardLast4={cardLast4}
        onContinue={handlePaymentContinue}
        onRetry={handlePaymentRetry}
        departureStation={departureStation?.properties.Place}
        arrivalStation={arrivalStation?.properties.Place}
      />
    </>
  )
}

export default memo(StationDetail)