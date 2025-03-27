"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PhoneInput } from "@/components/ui/phone-input"

interface NotifyModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (phoneNumber: string) => Promise<void>
}

export function NotifyModal({ isOpen, onClose, onSubmit }: NotifyModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!phoneNumber.trim() || phoneNumber.replace(/[^\d]/g, "").length < 8) {
      setError("Please enter a valid phone number")
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await onSubmit(phoneNumber)
      setIsSuccess(true)
      setTimeout(() => {
        onClose()
        // Reset after closing
        setTimeout(() => {
          setIsSuccess(false)
          setPhoneNumber("")
        }, 300)
      }, 2000)
    } catch (err) {
      setError("Failed to submit. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-50"
          >
            <div className="bg-[#1a1a1a] rounded-xl shadow-xl border border-[#2a2a2a] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <div className="bg-[#10a37f]/10 p-2 rounded-full">
                    <Bell className="w-5 h-5 text-[#10a37f]" />
                  </div>
                  <h2 className="text-lg font-medium text-white">Get notified</h2>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {isSuccess ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="bg-[#10a37f]/10 p-3 rounded-full mb-4">
                      <Check className="w-6 h-6 text-[#10a37f]" />
                    </div>
                    <p className="text-white text-center">We'll notify you when a car becomes available.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <p className="text-gray-300 mb-4">
                      We'll send you a notification when a car becomes available in your area.
                    </p>
                    <PhoneInput
                      id="phone"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="(123) 456-7890"
                      error={error || undefined}
                    />
                    <div className="mt-6">
                      <Button
                        type="submit"
                        className="w-full bg-[#10a37f] hover:bg-[#0d8c6d] text-white"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Submitting...</span>
                          </div>
                        ) : (
                          "Notify me"
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

