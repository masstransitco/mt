
"use client"

import { memo, useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react"
import { toast } from "react-hot-toast"
import { motion } from "framer-motion"
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
  },
)

// Map fallback component
function MapCardFallback() {
  return (
    <div className="h-44 w-full bg-gray-800/50 rounded-lg flex items-center justify-center">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )
}

// Lazy-loaded components with improved loading experience
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
 * Persistent wrapper for CarGrid with optimized loading
 * - Only renders when visible
 * - Maintains consistent height during loading
 * - Preserves previous render while loading new one
 */
const MemoizedCarGrid = memo(function MemoizedCarGridWrapper({
  isVisible,
  isQrScanStation,
  scannedCar,
}: {
  isVisible: boolean
  isQrScanStation?: boolean
  scannedCar?: any
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  
  // Delayed rendering for better UI experience
  useEffect(() => {
    if (isVisible) {
      // Small delay before showing the component
      const timer = setTimeout(() => {
        setShouldRender(true)
      }, 100)
      
      return () => clearTimeout(timer)
    } else {
      // Small delay before hiding to allow for animations
      const timer = setTimeout(() => {
        setShouldRender(false)
        setIsLoaded(false)
      }, 150)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible])
  
  // Track when component is fully loaded
  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])
  
  // If not visible at all, return null
  if (!isVisible && !shouldRender) return null
  
  return (
    <Suspense
      fallback={
        <div className="h-32 w-full bg-gray-800/50 rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-xs text-gray-400">Loading vehicles...</div>
        </div>
      }
    >
      {shouldRender && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative"
          onAnimationComplete={handleLoad}
        >
          <CarGrid
            className="h-32 w-full"
            isVisible={true}
            isQrScanStation={isQrScanStation}
            scannedCar={scannedCar}
          />
        </motion.div>
      )}
    </Suspense>
  )
})
MemoizedCarGrid.displayName = "MemoizedCarGrid"

/** InfoPopup component */
const InfoPopup = memo(function InfoPopup({
  text = "Parking entry and exits are contactless and requires no further payments.",
}: {
  text?: string
}) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleShowInfo = useCallback(() => {
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

// Improved touch handling helper
function TouchScrollHandler() {
  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const scrollTop = el.scrollTop
    const scrollHeight = el.scrollHeight
    const height = el.clientHeight
    const delta = e.touches[0].clientY - (el.dataset.touchY ? parseFloat(el.dataset.touchY) : 0)
    
    // Prevent overscroll only at boundaries
    if ((scrollTop <= 0 && delta > 0) || (scrollTop + height >= scrollHeight && delta < 0)) {
      e.preventDefault()
    }
    
    // Update current touch position
    el.dataset.touchY = e.touches[0].clientY.toString()
  }
  
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.currentTarget.dataset.touchY = e.touches[0].clientY.toString()
  }
  
  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    delete e.currentTarget.dataset.touchY
  }
  
  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  }
}

/**
 * Main StationDetail component with improved scroll behavior and optimized CarGrid handling
 */
function StationDetailComponent({
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

  // Flow booleans
  const isDepartureFlow = useMemo(() => step <= 2, [step])

  // Local states
  const [isInitialized, setIsInitialized] = useState(true)
  const [attemptedRender, setAttemptedRender] = useState(true)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [charging, setCharging] = useState(false)
  const [forceRefreshKey, setForceRefreshKey] = useState(0)
  const [paymentResultModalOpen, setPaymentResultModalOpen] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentReference, setPaymentReference] = useState("")
  const [cardLast4, setCardLast4] = useState("")
  
  // Single source of truth for CarGrid visibility
  const [carGridVisible, setCarGridVisible] = useState(false)
  
  // Reference to track last render time to prevent too frequent updates
  const lastRenderTimeRef = useRef(0)

  // Touch scroll handler
  const touchScrollHandlers = TouchScrollHandler()

  // Get stations by ID for the receipt or display
  const departureStation = useMemo(() => stations.find((s) => s.id === departureId) || null, [stations, departureId])
  const arrivalStation = useMemo(() => stations.find((s) => s.id === arrivalId) || null, [stations, arrivalId])

  // For the "Departure Gate" label value
  const parkingValue = useMemo(() => {
    if (step === 2 || step === 4) return "Contactless"
    return ""
  }, [step])

  // Convert route duration => minutes
  const driveTimeMin = useMemo(() => {
    if (!route || !departureId || !arrivalId) return null
    return Math.round(route.duration / 60).toString()
  }, [route, departureId, arrivalId])

  // Identify if station is a "virtual" car location
  const isVirtualCarLocation = useMemo(() => !!activeStation?.properties?.isVirtualCarLocation, [activeStation])

  // Debounce route fetching
  const routeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Combined logic for CarGrid visibility in one place
  useEffect(() => {
    // Determine if CarGrid should be visible based on current state
    const shouldShowCarGrid = 
      !isMinimized && 
      isDepartureFlow && 
      step === 2 && 
      (!!activeStation || isQrScanStation);
      
    // Apply debounce to prevent flickering during transitions
    if (shouldShowCarGrid) {
      // Small delay when showing to ensure smooth transition
      const timer = setTimeout(() => {
        setCarGridVisible(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Delay hiding slightly to avoid flicker during transitions
      const timer = setTimeout(() => {
        setCarGridVisible(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isMinimized, isDepartureFlow, step, activeStation, isQrScanStation]);

  // Handle sheet expansion => force a content refresh, but throttle to avoid excessive renders
  useEffect(() => {
    if (!isMinimized) {
      const now = Date.now();
      // Only refresh if more than 300ms since last refresh
      if (now - lastRenderTimeRef.current > 300) {
        setForceRefreshKey((prev) => prev + 1);
        setIsInitialized(true);
        setAttemptedRender(true);
        lastRenderTimeRef.current = now;
      }

      // If step 3 or 4 => refetch route, but only if sheet is expanded
      if (step >= 3 && departureId && arrivalId && stations.length > 0) {
        // Clear previous debounce
        if (routeFetchTimeoutRef.current) {
          clearTimeout(routeFetchTimeoutRef.current);
        }
        
        routeFetchTimeoutRef.current = setTimeout(() => {
          const depStation = stations.find((s) => s.id === departureId);
          const arrStation = stations.find((s) => s.id === arrivalId);
          if (depStation && arrStation) {
            dispatch(fetchRoute({ departure: depStation, arrival: arrStation }));
          }
        }, 500);
      }
    }
    
    return () => {
      if (routeFetchTimeoutRef.current) {
        clearTimeout(routeFetchTimeoutRef.current);
      }
    };
  }, [isMinimized, step, departureId, arrivalId, stations, dispatch]);

  // Payment modal open/close
  const handleOpenWalletModal = useCallback(() => {
    setWalletModalOpen(true)
  }, [])
  const handleCloseWalletModal = useCallback(() => {
    setWalletModalOpen(false)
  }, [])

  // Payment result modal steps
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

  // Confirm button logic
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

  // Possibly show an "estimated pickup time" if we have a dispatch route
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

  // If we want a loading spinner until fully loaded
  if (!isInitialized) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // If we attempted to render but have no activeStation
  if (!activeStation && attemptedRender) {
    console.error(
      "StationDetail attempted to render but activeStation is null",
      "departureId:",
      departureId,
      "arrivalId:",
      arrivalId,
      "isQrScanStation:",
      isQrScanStation,
    )
  }

  // Default UI, without active / selected station
  if (!activeStation) {
    return null; // Guidance now comes from the sheet header
  }

  // Use forceRefreshKey to force remount of the component
  return (
    <>
      <motion.div
        className="p-3 space-y-2 overscroll-contain touchaction-none"
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
            {/* Always render the MemoizedCarGrid component, but let it handle its visibility internally */}
            <MemoizedCarGrid 
              isVisible={carGridVisible} 
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
{Number(step) === 4 && (
  <div className="space-y-1.5 pointer-events-auto">
    {isSignedIn ? (
      <>
        <PaymentSummary onOpenWalletModal={handleOpenWalletModal} />
        <ConfirmButton
          isDepartureFlow={isDepartureFlow}
          charging={charging}
          disabled={charging || !(Number(step) === 2 || Number(step) === 4)}
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

        {/* Wallet/Payment Modal */}
        <WalletModal isOpen={walletModalOpen} onClose={handleCloseWalletModal} />
      </motion.div>

      {/* Payment Result Modal */}
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

export default memo(StationDetailComponent)
