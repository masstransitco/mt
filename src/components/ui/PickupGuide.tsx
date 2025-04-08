"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

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
  // Set default text based on isDepartureFlow (maintaining original component's logic)
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
      video: "/videos/output.webm",
    },
    {
      title: "HKD$1 Per Minute",
      description: "Pay only for what you use - freedom at your fingertips",
      video: "/videos/output2.webm",
    },
    {
      title: "HKD$800 Daily Cap",
      description: "Explore all day with peace of mind - no surprise costs",
      video: "/videos/output3.webm",
    },
  ]

  const step3DepartureCards = [
    {
      title: "Go Anywhere",
      description: "Change your mind? Switch destinations anytime during your journey",
      video: "/videos/output4.webm",
    },
    {
      title: "Come Full Circle",
      description: "Return to where you started - perfect for quick errands",
      video: "/videos/output5.webm",
    },
    {
      title: "Never Alone",
      description: "Our team is with you 24/7 - just a tap away whenever you need us",
      video: "/videos/output6.webm",
    },
  ]

  const step3ReturnCards = [
    {
      title: "Drop Off Anywhere",
      description: "End your journey at any station - complete freedom to explore",
      video: "/videos/output4.webm",
    },
    {
      title: "Return Home",
      description: "Back where you started? Perfect for round trips and daily commutes",
      video: "/videos/output5.webm",
    },
    {
      title: "Simple Finish",
      description: "Just park, lock and go - we handle the rest for you",
      video: "/videos/output6.webm",
    },
  ]

  // Default cards for backward compatibility - now with 3 cards
  const defaultDepartureCards = [
    {
      title: finalPrimaryText,
      description: finalPrimaryDesc,
      video: "/videos/output.webm",
    },
    {
      title: finalSecondaryText,
      description: finalSecondaryDesc,
      video: "/videos/output2.webm",
    },
    {
      title: isDepartureFlow ? "We've Got You Covered" : "Effortless Returns",
      description: isDepartureFlow
        ? "24/7 support keeps you moving with confidence"
        : "Complete your journey with a simple tap and walk away",
      video: "/videos/output3.webm",
    },
  ]

  // Determine which cards to show based on booking step and flow
  let cards
  if (bookingStep === 1) {
    cards = step1Cards
  } else if (bookingStep === 3) {
    cards = isDepartureFlow ? step3DepartureCards : step3ReturnCards
  } else {
    // Default behavior when no bookingStep is provided (backward compatibility)
    cards = defaultDepartureCards
  }

  const [activeCard, setActiveCard] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Handle card change
  useEffect(() => {
    if (onCardChange) {
      onCardChange(activeCard)
    }
  }, [activeCard, onCardChange])

  // Handle card navigation
  const handleCardChange = (index: number) => {
    if (index >= 0 && index < cards.length) {
      setActiveCard(index)
      scrollToCard(index)
    }
  }

  // Scroll to specific card
  const scrollToCard = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.offsetWidth
      scrollRef.current.scrollTo({
        left: index * cardWidth,
        behavior: "smooth",
      })
    }
  }

  // Touch/mouse handlers for swiping
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0))
    setScrollLeft(scrollRef.current?.scrollLeft || 0)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].pageX - (scrollRef.current?.offsetLeft || 0))
    setScrollLeft(scrollRef.current?.scrollLeft || 0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0)
    const walk = (x - startX) * 1.5
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const x = e.touches[0].pageX - (scrollRef.current?.offsetLeft || 0)
    const walk = (x - startX) * 1.5
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk
    }
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.offsetWidth
      const newIndex = Math.round(scrollRef.current.scrollLeft / cardWidth)
      setActiveCard(newIndex)
    }
  }

  // Handle scroll events to update active card
  const handleScroll = () => {
    if (isDragging || !scrollRef.current) return
    const cardWidth = scrollRef.current.offsetWidth
    const newIndex = Math.round(scrollRef.current.scrollLeft / cardWidth)
    if (newIndex !== activeCard) {
      setActiveCard(newIndex)
    }
  }

  // Determine title based on props
  const getTitle = () => {
    if (bookingStep === 1) return "Pricing"
    if (bookingStep === 3) return isDepartureFlow ? "Departure Options" : "Return Options"
    return isDepartureFlow ? "Ways To Start" : "Ways to Return" // Default title from original component
  }

  return (
    <div className="w-full select-none">
      {/* Title */}
      <div className="text-gray-400 text-xs uppercase tracking-wider font-medium mb-3 pl-1 flex items-center">
        {getTitle()}
        <div className="ml-2 h-px bg-gradient-to-r from-gray-400/30 to-transparent flex-grow"></div>
      </div>

      {/* Card container */}
      <div className="relative">
        {/* Navigation buttons */}
        {activeCard > 0 && (
          <button
            onClick={() => handleCardChange(activeCard - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 transition-all hover:bg-black/70"
            aria-label="Previous card"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {activeCard < cards.length - 1 && (
          <button
            onClick={() => handleCardChange(activeCard + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 transition-all hover:bg-black/70"
            aria-label="Next card"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Cards scroller */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleDragEnd}
        >
          {cards.map((card, index) => (
            <div key={index} className="min-w-full w-full flex-shrink-0 snap-center">
              <div className="mx-1 h-48 rounded-xl overflow-hidden relative bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg border border-white/5">
                {/* Video background for each card */}
                {card.video ? (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900/30 to-gray-800/30 mix-blend-overlay"></div>
                    <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
                      <source src={card.video} type="video/webm" />
                    </video>
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 w-full h-full"
                    style={{
                      backgroundImage: `url(/placeholder.svg?height=192&width=400)`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}

                {/* Content overlay - simple version with styled text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 flex flex-col justify-end">
                  <h3 className="font-sf-pro-display-medium text-transparent bg-clip-text bg-gradient-to-r from-white to-white/90 text-xl mb-2 drop-shadow-md tracking-tight">
                    {card.title}
                  </h3>
                  <p className="font-sf-pro-display-light text-white/90 text-sm leading-relaxed max-w-[90%] drop-shadow-sm">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className="flex justify-center mt-4 space-x-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => handleCardChange(index)}
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
