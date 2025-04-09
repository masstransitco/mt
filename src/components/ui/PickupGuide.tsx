"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useDeviceDetection } from "@/hooks/useDeviceDetection"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface CardData {
  title: string
  description: string
  video: string
}

interface CardProps {
  card: CardData
  isActive: boolean
}

// Simple card skeleton for loading state
const CardSkeleton = () => (
  <div className="mx-1 h-48 rounded-xl overflow-hidden relative bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg border border-white/5 animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 flex flex-col justify-end">
      <div className="h-6 bg-gray-700/50 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-700/50 rounded w-2/3"></div>
    </div>
  </div>
);

// Simplified card component
const Card = ({ card, isActive }: CardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const { os } = useDeviceDetection()
  const isIOS = os === 'iOS'

  // Wait until we have both the video element and it's active before manipulating
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    // Set required attributes
    video.muted = true
    video.playsInline = true
    
    if (isActive && !videoLoaded) {
      // For new video loads, ensure it plays
      video.play().catch(err => {
        // Silently catch error, don't log to avoid console spam
      })
      setVideoLoaded(true)
    }
  }, [isActive, videoLoaded])

  // Handle video errors
  const handleError = () => {
    console.error("Video failed to load:", card.video)
    setHasError(true)
  }
  
  // Handle video loaded
  const handleLoaded = () => {
    setVideoLoaded(true)
    
    // Play the video if this card is active
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Silent catch
      })
    }
  }

  return (
    <div 
      className="mx-1 h-48 rounded-xl overflow-hidden relative bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg border border-white/5"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/30 to-gray-800/30 mix-blend-overlay"></div>
      
      {/* Video background - simplified approach */}
      {!hasError && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={card.video}
          muted
          playsInline
          loop
          autoPlay
          poster="" // Empty poster to avoid flash
          preload="auto"
          onError={handleError}
          onLoadedData={handleLoaded}
          disablePictureInPicture
        />
      )}
      
      {/* No play button - removed to allow continuous playback */}
      
      {/* Fallback for video errors */}
      {hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900 to-gray-800 flex items-center justify-center">
          <span className="text-white text-opacity-80 text-sm">Video unavailable</span>
        </div>
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 flex flex-col justify-end">
        <h3 className="font-sf-pro-display-medium text-transparent bg-clip-text bg-gradient-to-r from-white to-white/90 text-xl mb-2 drop-shadow-md tracking-tight">
          {card.title}
        </h3>
        <p className="font-sf-pro-display-light text-white/90 text-sm leading-relaxed max-w-[90%] drop-shadow-sm">
          {card.description}
        </p>
      </div>
    </div>
  )
};

interface PickupGuideProps {
  bookingStep?: number
  isDepartureFlow?: boolean
  primaryText?: string
  secondaryText?: string
  primaryDescription?: string
  secondaryDescription?: string
  compact?: boolean
  showCarGrid?: boolean
  scannedCar?: any | null
  onCardChange?: (index: number) => void
}

export default function PickupGuide({
  bookingStep,
  isDepartureFlow = true,
  primaryText,
  secondaryText,
  primaryDescription,
  secondaryDescription,
  compact = false,
  showCarGrid = false,
  scannedCar = null,
  onCardChange,
}: PickupGuideProps) {
  // Set default text based on isDepartureFlow
  const defaultPrimaryText = isDepartureFlow ? "Pickup from station" : "Choose dropoff station"
  const defaultSecondaryText = isDepartureFlow ? "Scan a car directly" : "Return to any station"
  const defaultPrimaryDesc = isDepartureFlow ? "Choose station on the map" : "Select destination on map"
  const defaultSecondaryDesc = isDepartureFlow ? "Use QR code on windscreen" : "Park at any station"

  // Use provided text or defaults
  const finalPrimaryText = primaryText || defaultPrimaryText
  const finalSecondaryText = secondaryText || defaultSecondaryText
  const finalPrimaryDesc = primaryDescription || defaultPrimaryDesc
  const finalSecondaryDesc = secondaryDescription || defaultSecondaryDesc

  // Content for different booking steps
  const step1Cards = [
    {
      title: "Just HKD$50 to Start",
      description: "Affordable access to your city adventure",
      video: "/videos/card1.mp4",
    },
    {
      title: "HKD$1 Per Minute",
      description: "Pay only for what you use - freedom at your fingertips",
      video: "/videos/card2.mp4",
    },
    {
      title: "HKD$800 Daily Cap",
      description: "Explore all day with peace of mind - no surprise costs",
      video: "/videos/card3.mp4",
    },
  ]

  const step3DepartureCards = [
    {
      title: "Go Anywhere",
      description: "Change your mind? Switch destinations anytime during your journey",
      video: "/videos/card4.mp4",
    },
    {
      title: "Come Full Circle",
      description: "Return to where you started - perfect for quick errands",
      video: "/videos/card5.mp4",
    },
    {
      title: "Never Alone",
      description: "Our team is with you 24/7 - just a tap away whenever you need us",
      video: "/videos/card6.mp4",
    },
  ]

  const step3ReturnCards = [
    {
      title: "Drop Off Anywhere",
      description: "End your journey at any station - complete freedom to explore",
      video: "/videos/card4.mp4",
    },
    {
      title: "Return Home",
      description: "Back where you started? Perfect for round trips and daily commutes",
      video: "/videos/card5.mp4",
    },
    {
      title: "Simple Finish",
      description: "Just park, lock and go - we handle the rest for you",
      video: "/videos/card6.mp4",
    },
  ]

  // Default cards for backward compatibility
  const defaultDepartureCards = [
    {
      title: finalPrimaryText,
      description: finalPrimaryDesc,
      video: "/videos/card1.mp4",
    },
    {
      title: finalSecondaryText,
      description: finalSecondaryDesc,
      video: "/videos/card2.mp4",
    },
    {
      title: isDepartureFlow ? "We've Got You Covered" : "Effortless Returns",
      description: isDepartureFlow
        ? "24/7 support keeps you moving with confidence"
        : "Complete your journey with a simple tap and walk away",
      video: "/videos/card3.mp4",
    },
  ]

  // Determine which cards to show based on booking step and flow
  let cards
  if (bookingStep === 1) {
    cards = step1Cards
  } else if (bookingStep === 3) {
    cards = isDepartureFlow ? step3DepartureCards : step3ReturnCards
  } else {
    cards = defaultDepartureCards
  }

  const [activeCard, setActiveCard] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Handle card change notification
  useEffect(() => {
    if (onCardChange) {
      onCardChange(activeCard)
    }
  }, [activeCard, onCardChange])

  // Simplified navigation
  const goToCard = (index: number) => {
    if (index >= 0 && index < cards.length) {
      // Let scrollToCard handle setting activeCard
      scrollToCard(index)
    }
  }

  // Scroll to specific card
  const scrollToCard = (index: number) => {
    if (scrollRef.current) {
      // Set activeCard first to trigger card content update before scrolling
      setActiveCard(index)
      
      // Use setTimeout to ensure we scroll after state update and rerender
      setTimeout(() => {
        if (scrollRef.current) {
          const cardWidth = scrollRef.current.offsetWidth
          scrollRef.current.scrollTo({
            left: index * cardWidth,
            behavior: "smooth",
          })
        }
      }, 10)
    }
  }

  // Handle scroll detection for active card
  const handleScroll = () => {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.offsetWidth
    const newIndex = Math.round(scrollRef.current.scrollLeft / cardWidth)
    
    if (newIndex !== activeCard && newIndex >= 0 && newIndex < cards.length) {
      // Add a slight delay to avoid rapid state updates during scroll
      setTimeout(() => {
        setActiveCard(newIndex)
      }, 50)
    }
  }

  // Get section title based on context
  const getTitle = () => {
    if (bookingStep === 1) return "Pricing"
    if (bookingStep === 3) return isDepartureFlow ? "Departure Options" : "Return Options"
    return isDepartureFlow ? "Ways To Start" : "Ways to Return"
  }

  return (
    <div className="w-full select-none">
      {/* Title */}
      <div className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-3 pl-1 flex items-center">
        {getTitle()}
        <div className="ml-2 h-px bg-gradient-to-r from-gray-400/30 to-transparent flex-grow"></div>
      </div>

      {/* Card carousel */}
      <div className="relative">
        {/* Navigation buttons */}
        {activeCard > 0 && (
          <button
            onClick={() => goToCard(activeCard - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 transition-all hover:bg-black/70"
            aria-label="Previous card"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        
        {activeCard < cards.length - 1 && (
          <button
            onClick={() => goToCard(activeCard + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 transition-all hover:bg-black/70"
            aria-label="Next card"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Simplified scroll container - uses CSS snap points for smooth scrolling */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={handleScroll}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className="min-w-full w-full flex-shrink-0 snap-center"
            >
              {/* Always render all cards */}
              {Math.abs(index - activeCard) < 2 ? (
                <Card 
                  card={card}
                  isActive={index === activeCard} 
                />
              ) : (
                <CardSkeleton />
              )}
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className="flex justify-center mt-4 space-x-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => goToCard(index)}
              className="group focus:outline-none"
              aria-label={`Go to card ${index + 1}`}
            >
              <motion.div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeCard === index ? "w-4 bg-white" : "w-1.5 bg-gray-600"
                } group-hover:bg-gray-400`}
                animate={{
                  scale: activeCard === index ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}