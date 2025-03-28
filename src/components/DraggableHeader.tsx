"use client"
import { MenuIcon, Upload } from "lucide-react"
import { motion } from "framer-motion"
import { QrCodeIcon } from "@/components/ui/icons/QrCodeIcon"

interface SideButtonsPanelProps {
  onToggleMenu: () => void
  onScannerOpen: () => void
  onDragDropOpen?: () => void
}

export function SideButtonsPanel({ onToggleMenu, onScannerOpen, onDragDropOpen }: SideButtonsPanelProps) {
  // Function to log button clicks for debugging
  const logButtonClick = (name: string) => {
    console.log(`Side panel button clicked: ${name}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-0 top-1/4 z-[9999]"
      style={{
        pointerEvents: "auto",
        touchAction: "auto",
      }}
    >
      <div className="bg-[#1a1a1a]/90 backdrop-blur-md border border-[#2a2a2a] rounded-l-xl py-4 px-2 shadow-lg">
        <div className="flex flex-col items-center space-y-4">
          {/* Menu Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              logButtonClick("Menu")
              onToggleMenu()
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white bg-[#2a2a2a]/60 hover:bg-[#333333]/80 active:scale-95 transition-all duration-200"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </motion.button>

          {/* QR Scanner Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              logButtonClick("Scanner")
              onScannerOpen()
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white bg-[#2a2a2a]/60 hover:bg-[#333333]/80 active:scale-95 transition-all duration-200"
            aria-label="Open QR scanner"
          >
            <QrCodeIcon className="w-5 h-5" />
          </motion.button>

          {/* Drag and Drop Button (Placeholder) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              logButtonClick("DragDrop")
              onDragDropOpen?.()
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white bg-[#276EF1]/80 hover:bg-[#276EF1] active:scale-95 transition-all duration-200"
            aria-label="Drag and drop"
          >
            <Upload className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

