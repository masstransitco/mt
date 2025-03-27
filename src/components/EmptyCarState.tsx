"use client"

import { useState, memo } from "react"
import { motion } from "framer-motion"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotifyModal } from "@/components/NotifyModal"

interface EmptyCarStateProps {
  isQrScanStation: boolean
  message?: string
}

const EmptyCarState = memo(({ isQrScanStation, message }: EmptyCarStateProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const defaultMessage = isQrScanStation ? "Car not found or not in range" : "No cars available right now"

  const handleNotifySubmit = async (phoneNumber: string) => {
    // In a real app, this would call an API to register for notifications
    console.log("Notify when available:", phoneNumber)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex flex-col items-center justify-center h-32"
      >
        <div className="text-center space-y-3">
          <p className="text-gray-300 text-sm">{message || defaultMessage}</p>
          {!isQrScanStation && (
            <Button
              variant="outline"
              size="sm"
              className="bg-[#222222] border-[#2a2a2a] hover:bg-[#2a2a2a] text-white"
              onClick={() => setIsModalOpen(true)}
            >
              <Bell className="w-3.5 h-3.5 mr-2 text-[#10a37f]" />
              Notify me when available
            </Button>
          )}
        </div>
      </motion.div>

      <NotifyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleNotifySubmit} />
    </>
  )
})
EmptyCarState.displayName = "EmptyCarState"

export default EmptyCarState

