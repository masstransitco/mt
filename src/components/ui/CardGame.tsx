"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

// Import your logo component
import { LogoSvg } from "@/components/ui/logo/LogoSvg"

// Named imports for icon files (avoiding default-export errors)
import { MapFlag } from "@/components/ui/icons/MapFlag"
import { AddCard } from "@/components/ui/icons/AddCard"
import { ArrowRight } from "@/components/ui/icons/ArrowRight"
import { CarParkIcon } from "@/components/ui/icons/CarParkIcon"
import { CheckCircle } from "@/components/ui/icons/CheckCircle"
import { QrCodeIcon } from "@/components/ui/icons/QrCodeIcon"

// 1) Create a type for your icon components:
type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>

// 2) Define the MemoryCard type:
type MemoryCard = {
  id: number
  Icon: IconComponent
  isMatched: boolean
  color: string
}

// 3) Create your deck of cards:
const createCards = () => {
  // List each icon and a color. Customize or expand as needed.
  const iconConfigs = [
    { Icon: MapFlag, color: "text-sky-500" },
    { Icon: AddCard, color: "text-sky-500" },
    { Icon: ArrowRight, color: "text-sky-500" },
    { Icon: CarParkIcon, color: "text-sky-500" },
    { Icon: CheckCircle, color: "text-sky-500" },
    { Icon: QrCodeIcon, color: "text-sky-500" },
  ]

  // Duplicate each icon for a pair and shuffle them
  const cards: MemoryCard[] = []
  iconConfigs.forEach(({ Icon, color }, index) => {
    cards.push(
      { id: index * 2, Icon, color, isMatched: false },
      { id: index * 2 + 1, Icon, color, isMatched: false }
    )
  })
  return cards.sort(() => Math.random() - 0.5)
}

export default function MemoryGame() {
  const [cards, setCards] = useState<MemoryCard[]>(createCards())
  const [flippedIndexes, setFlippedIndexes] = useState<number[]>([])
  const [matches, setMatches] = useState(0)
  const [isChecking, setIsChecking] = useState(false)

  const handleCardClick = (clickedIndex: number) => {
    if (isChecking || cards[clickedIndex].isMatched) return
    if (flippedIndexes.includes(clickedIndex)) return
    if (flippedIndexes.length === 2) return

    const newFlipped = [...flippedIndexes, clickedIndex]
    setFlippedIndexes(newFlipped)

    // If two cards are flipped, check for a match
    if (newFlipped.length === 2) {
      setIsChecking(true)
      const [firstIndex, secondIndex] = newFlipped
      const firstCard = cards[firstIndex]
      const secondCard = cards[secondIndex]

      if (firstCard.Icon === secondCard.Icon) {
        // Match
        setTimeout(() => {
          setCards((prevCards) =>
            prevCards.map((card, idx) =>
              idx === firstIndex || idx === secondIndex
                ? { ...card, isMatched: true }
                : card
            )
          )
          setFlippedIndexes([])
          setMatches((m) => m + 1)
          setIsChecking(false)

          // Check for game completion
          if (matches === (cards.length / 2) - 1) {
            toast("🎉 Congratulations! You've found all the matches! 🎈", {
              className: "bg-neutral-800 text-sky-100 border-sky-500",
            })
          }
        }, 500)
      } else {
        // No match
        setTimeout(() => {
          setFlippedIndexes([])
          setIsChecking(false)
        }, 1000)
      }
    }
  }

  const resetGame = () => {
    setCards(createCards())
    setFlippedIndexes([])
    setMatches(0)
    setIsChecking(false)
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4
                 bg-gradient-to-b from-neutral-900 to-neutral-800 text-neutral-50
                 font-sans"
      style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      {/* Top bar with logo */}
      <div className="absolute top-4 left-4 flex items-center space-x-2">
        <LogoSvg className="w-8 h-8 text-sky-500" />
      </div>

      {/* Title & match info */}
      <div className="text-center space-y-2 mb-4 mt-12">
        <h1 className="text-3xl font-bold tracking-tight">
          Mass Transit Cards
        </h1>
        <p className="text-sm text-neutral-300">
          Matches found: {matches} of {cards.length / 2}
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-neutral-800/40 backdrop-blur-sm">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ rotateY: 0 }}
            animate={{
              rotateY: card.isMatched || flippedIndexes.includes(index) ? 180 : 0,
            }}
            transition={{ duration: 0.3 }}
            className="perspective-1000"
          >
            <Card
              className={`relative w-20 h-20 cursor-pointer transform-style-3d 
                          transition-all duration-300 flex items-center justify-center
                          ${
                            card.isMatched
                              ? "bg-neutral-700 border-neutral-500"
                              : flippedIndexes.includes(index)
                              ? "bg-neutral-700 border-sky-500"
                              : "bg-neutral-900 border-neutral-600 hover:border-sky-500"
                          }`}
              onClick={() => handleCardClick(index)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-neutral-500/5 to-white/5" />
              <AnimatePresence>
                {(card.isMatched || flippedIndexes.includes(index)) && (
                  <motion.div
                    initial={{ opacity: 0, rotateY: 180 }}
                    animate={{ opacity: 1, rotateY: 180 }}
                    exit={{ opacity: 0, rotateY: 180 }}
                    className="absolute inset-0 flex items-center justify-center backface-hidden"
                  >
                    <card.Icon
                      className={`w-10 h-10
                        ${
                          card.isMatched
                            ? `${card.color} filter drop-shadow-[0_0_8px_rgba(0,191,255,0.5)]`
                            : card.color
                        }`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Reset button */}
      <Button
        onClick={resetGame}
        variant="outline"
        size="sm"
        className="mt-6 bg-neutral-900 border-neutral-700 text-sky-400
                   hover:bg-neutral-800 hover:border-sky-500 hover:text-sky-200"
      >
        Start New Game
      </Button>
    </div>
  )
}
