"use client"

import React from "react"
import { motion } from "framer-motion"
import { CornerUpLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export type ReturnToSameStationPosition = "sheet" | "bottom" | "inline"

interface ReturnToSameStationProps {
  // Position variant for styling/placement
  position?: ReturnToSameStationPosition
  // Optional callback for component-specific behavior
  onClick?: () => void
  // Whether the button is disabled
  disabled?: boolean
}

export default function ReturnToSameStation({
  position = "inline",
  onClick,
  disabled = false,
}: ReturnToSameStationProps) {
  const handleClick = () => {
    if (disabled) return;
    console.log("[ReturnToSameStation] Button clicked")
    onClick?.()
  }

  // Position-based styling
  const buttonStyles = {
    sheet: "px-3 py-1.5 h-[30px] w-full", // Full width with reduced height
    bottom: "px-3 py-1.5 h-[30px] w-auto", 
    inline: "px-3 py-1.5 h-[30px] w-auto"
  }

  return (
    <motion.button
      onClick={handleClick}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={cn(`
        relative flex items-center justify-center gap-2
        text-xs font-medium
        border rounded-xl
        backdrop-blur-md
        transition-all duration-200 shadow-lg z-10
      `, 
      disabled 
        ? "text-gray-500 border-gray-800/20 bg-black/70 cursor-not-allowed" 
        : "text-white border-white/10 bg-black/90 hover:bg-black hover:border-white/20",
      buttonStyles[position])}
      type="button"
      disabled={disabled}
    >
      <CornerUpLeft className="w-3.5 h-3.5" />
      <span>Return to same</span>
    </motion.button>
  )
}