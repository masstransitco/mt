"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import type { Car } from "@/types/cars";
import { toast } from "react-hot-toast";
import { useAppDispatch } from "@/store/store";

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when QR scanning is successful, passing the found car. */
  onScanSuccess?: (car: Car) => void;
  /** Currently active virtual station ID (if any). */
  currentVirtualStationId?: number | null;
}

export default function QrScannerOverlay({
  isOpen,
  onClose,
  onScanSuccess,
  currentVirtualStationId,
}: QrScannerOverlayProps) {
  const dispatch = useAppDispatch();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  // Reset scanning state when the overlay is toggled
  useEffect(() => {
    if (isOpen) {
      setScanning(true);
      setLoading(false);
    }
  }, [isOpen]);

  const handleScan = useCallback(
    async (detectedCodes: IDetectedBarcode[]) => {
      if (!detectedCodes.length || !detectedCodes[0].rawValue || loading) return;

      setScanning(false);
      setLoading(true);

      try {
        const scannedValue = detectedCodes[0].rawValue;
        console.log("QR Code Scanned:", scannedValue);

        // Use the centralized stationSelectionManager to process the QR code
        const stationSelectionManager = (await import("@/lib/stationSelectionManager")).default;
        const result = await stationSelectionManager.processQrCode(scannedValue);
        
        if (!result.success) {
          toast.error(result.message);
          onClose();
          return;
        }
        
        // Notify parent component of successful scan
        if (onScanSuccess && result.car) {
          setTimeout(() => {
            onScanSuccess(result.car!);
          }, 500);
        }

        toast.success(result.message);
        // Close the scanner on successful scan
        onClose();
      } catch (error) {
        console.error("Error processing QR code:", error);
        toast.error("Failed to process the car QR code");
        // Intentionally not closing so user can re-try if there's a camera/network glitch
      } finally {
        setLoading(false);
      }
    },
    [onClose, onScanSuccess, loading]
  );

  const handleError = useCallback(
    (error: unknown) => {
      console.error("QR Scanner Error:", error);
      toast.error("Camera error. Please try again.");
      onClose();
    },
    [onClose]
  );

  const handleClose = useCallback(() => {
    setScanning(false);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-sm relative m-4">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close QR Scanner"
            >
              ✕
            </button>

            <div className="p-4 text-center text-white space-y-3 bg-black bg-opacity-50 rounded-lg">
              <h2 className="text-xl font-bold">Scan Car QR Code</h2>
              <p className="text-sm">
                Point your camera at the QR code on the car to start driving
              </p>

              <div className="mt-3 overflow-hidden rounded-lg">
                {scanning && (
                  <Scanner
                    onScan={handleScan}
                    onError={handleError}
                    constraints={{
                      facingMode: "environment",
                    }}
                  />
                )}

                {loading && (
                  <div className="p-8 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
