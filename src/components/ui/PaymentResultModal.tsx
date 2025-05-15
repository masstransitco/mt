"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, ArrowRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { jsPDF } from "jspdf"
import { createPortal } from "react-dom"

interface PaymentResultModalProps {
  isOpen: boolean
  isSuccess: boolean
  amount: number
  referenceId: string
  cardLast4?: string
  onContinue: () => void
  onRetry?: () => void
  departureStation?: string
  arrivalStation?: string
}

export default function PaymentResultModal({
  isOpen,
  isSuccess,
  amount,
  referenceId,
  cardLast4 = "****",
  onContinue,
  onRetry,
  departureStation = "Pickup Location",
  arrivalStation = "Dropoff Location",
}: PaymentResultModalProps) {
  // Only render on client-side
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  if (!isMounted) return null
  const [showIcon, setShowIcon] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showParticles, setShowParticles] = useState(false)

  // Format the amount as currency
  const formattedAmount = `HK$${(amount / 100).toFixed(2)}`
  
  // Current date for receipt
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  useEffect(() => {
    if (isOpen) {
      // Reset states when modal opens
      setShowIcon(false)
      setShowDetails(false)
      setShowParticles(false)
      
      // Sequence the animations
      const iconTimer = setTimeout(() => setShowIcon(true), 500)
      const detailsTimer = setTimeout(() => setShowDetails(true), 1200)
      const particlesTimer = setTimeout(() => setShowParticles(true), 1000)

      return () => {
        clearTimeout(iconTimer)
        clearTimeout(detailsTimer)
        clearTimeout(particlesTimer)
      }
    }
  }, [isOpen])

  const handleDownloadReceipt = () => {
    // Only allow receipt download for successful payments
    if (!isSuccess) return
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    // Set font and colors
    doc.setFont("helvetica")
    doc.setTextColor(0, 0, 0)

    // Add company logo/name
    doc.setFontSize(24)
    doc.text("RECEIPT", 105, 20, { align: "center" })

    // Add receipt details
    doc.setFontSize(12)
    doc.text("Payment Details", 20, 40)

    doc.setFontSize(10)
    doc.text("Amount:", 20, 50)
    doc.text(formattedAmount, 70, 50)

    doc.text("Date:", 20, 60)
    doc.text(currentDate, 70, 60)

    doc.text("Card:", 20, 70)
    doc.text(`•••• ${cardLast4}`, 70, 70)

    doc.text("Reference:", 20, 80)
    doc.text(referenceId, 70, 80)

    // Add trip details
    doc.text("Trip Details:", 20, 100)
    doc.text("From:", 20, 110)
    doc.text(departureStation, 70, 110)
    doc.text("To:", 20, 120)
    doc.text(arrivalStation, 70, 120)

    // Add footer
    doc.setFontSize(8)
    doc.text("Thank you for your booking", 105, 200, { align: "center" })

    // Save the PDF
    doc.save("trip-receipt.pdf")
  }

  if (!isOpen) return null
  
  // Content of the modal to be rendered in the portal
  const modalContent = (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm payment-modal-container"
        style={{
          touchAction: "manipulation",
          pointerEvents: "auto"
        }}
      />
    
      <div 
        className="fixed inset-0 z-[10001] flex items-center justify-center overflow-y-auto payment-modal-container"
        style={{
          touchAction: "manipulation",
          pointerEvents: "auto"
        }}
      >
        <div className="relative flex w-full max-w-md flex-col items-center justify-center rounded-2xl bg-[#1c1c1e] p-8 shadow-xl mx-5">
          {/* Success/Error circle with icon */}
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute h-24 w-24 rounded-full bg-[#1c1c1e]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className={`absolute inset-0 m-1 rounded-full ${
                  isSuccess 
                    ? "bg-gradient-to-br from-[#34c759] to-[#30d158]" 
                    : "bg-gradient-to-br from-[#ff3b30] to-[#ff453a]"
                }`}
              />
            </motion.div>

            <AnimatePresence>
              {showIcon && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 15,
                    delay: 0.2,
                  }}
                  className="absolute z-10"
                >
                  {isSuccess ? (
                    <Check className="h-12 w-12 text-white" strokeWidth={3} />
                  ) : (
                    <X className="h-12 w-12 text-white" strokeWidth={3} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle particles - only for success */}
            {isSuccess && showParticles && (
              <>
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0.7,
                      scale: 0,
                    }}
                    animate={{
                      x: Math.random() * 60 - 30,
                      y: Math.random() * 60 - 30,
                      opacity: 0,
                      scale: Math.random() * 0.5 + 0.5,
                    }}
                    transition={{
                      duration: Math.random() * 1 + 1,
                      delay: Math.random() * 0.3,
                      ease: "easeOut",
                    }}
                    className="absolute h-1 w-1 rounded-full bg-[#34c759]"
                  />
                ))}
              </>
            )}
          </div>

          {/* Result text */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mb-2 text-center text-2xl font-medium tracking-tight text-white"
          >
            {isSuccess ? "Payment Successful" : "Payment Failed"}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="mb-6 text-center text-sm text-gray-400"
          >
            {isSuccess 
              ? "Your transaction has been processed securely" 
              : "We couldn't process your payment. Please try again."}
          </motion.p>

          {/* Payment details */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="mb-8 w-full space-y-3 rounded-xl bg-[#2c2c2e] p-4"
              >
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Amount</span>
                  <span className="font-medium text-white">{formattedAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Date</span>
                  <span className="font-medium text-white">{currentDate}</span>
                </div>
                {cardLast4 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Card</span>
                    <span className="font-medium text-white">•••• {cardLast4}</span>
                  </div>
                )}
                {isSuccess && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Reference</span>
                    <span className="font-medium text-white">{referenceId}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="w-full"
          >
            {isSuccess ? (
              <Button onClick={onContinue} className="w-full bg-white text-black hover:bg-gray-200">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <Button onClick={onRetry} className="w-full bg-white text-black hover:bg-gray-200">
                  Try Again
                </Button>
                <Button 
                  onClick={onContinue} 
                  variant="outline" 
                  className="w-full border-gray-700 text-white hover:bg-gray-800"
                >
                  Back to Payment Methods
                </Button>
              </div>
            )}
          </motion.div>

          {/* Receipt link - only show for successful payments */}
          {isSuccess && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.5 }}
              onClick={handleDownloadReceipt}
              className="mt-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              <Download className="h-3.5 w-3.5" />
              Download Receipt
            </motion.button>
          )}
        </div>
      </div>
    </>
  )
  
  // Use createPortal to render the modal content at the document body level
  // This ensures it's outside of any stacking context and has the highest possible z-index
  return createPortal(modalContent, document.body)
}
