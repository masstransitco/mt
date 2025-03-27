"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MenuIcon, ChevronDown } from "lucide-react"
import { QrCodeIcon } from "@/components/ui/icons/QrCodeIcon"
import { LogoSvg } from "@/components/ui/logo/LogoSvg"

interface DraggableHeaderProps {
  onToggleMenu: () => void
  onScannerOpen: () => void
}

export function DraggableHeader({ onToggleMenu, onScannerOpen }: DraggableHeaderProps) {
  // State for header visibility
  const [isCollapsed, setIsCollapsed] = useState(false)
  const headerHeight = 50 // Default header height

  // Toggle header visibility when tab is clicked
  const toggleHeader = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className="relative">
      <motion.header
        className="main-header fixed top-0 left-0 right-0 select-none"
        style={{
          zIndex: 9999,
        }}
        initial={{ y: 0 }}
        animate={{ y: isCollapsed ? -headerHeight : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Main header content */}
        <div className="bg-[#1a1a1a]/90 border-b border-[#2a2a2a] backdrop-blur-md h-[50px]">
          <div className="h-full flex items-center justify-between px-3">
            {/* Left: Logo */}
            <div className="flex items-center">
              <LogoSvg aria-label="Logo" width={50} height={50} className="object-contain" />
            </div>

            {/* Right Icons */}
            <div className="flex items-center space-x-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onScannerOpen()
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full text-gray-300 hover:text-white active:scale-95 transition-all duration-200"
              >
                <QrCodeIcon className="w-5 h-5" />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-[#2a2a2a]" />

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleMenu()
                }}
                className="flex items-center justify-center w-9 h-9 rounded-full text-gray-300 hover:text-white active:scale-95 transition-all duration-200"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Pull tab indicator */}
        <div
          className="absolute bottom-[-15px] left-1/2 transform -translate-x-1/2 cursor-pointer"
          onClick={toggleHeader}
        >
          <div className="bg-[#1a1a1a] w-12 h-4 rounded-b-lg border-b border-l border-r border-[#2a2a2a] flex items-center justify-center">
            <motion.div animate={{ rotateX: isCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </motion.div>
          </div>
        </div>
      </motion.header>
    </div>
  )
}

