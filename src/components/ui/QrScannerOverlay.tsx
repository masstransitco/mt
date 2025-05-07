"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import type { Car } from "@/types/cars";
import { toast } from "react-hot-toast";
import { useAppDispatch } from "@/store/store";
import stationSelectionManager from "@/lib/stationSelectionManager";

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

        // Use the pre-imported stationSelectionManager
        const result = await stationSelectionManager.processQrCode(scannedValue);
        
        if (!result.success) {
          toast.error(result.message);
          onClose();
          return;
        }
        
        // Store the car for callback after closing
        const scannedCar = result.car;
        
        toast.success(result.message);
        
        // Close first
        onClose();
        
        // Then notify parent component of successful scan (after closing)
        if (onScanSuccess && scannedCar) {
          // No setTimeout to avoid hook timing issues
          onScanSuccess(scannedCar);
        }
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
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh] bg-black/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            pointerEvents: "auto",
            touchAction: "auto"
          }}
        >
          <div className="w-full max-w-sm relative mx-4 qr-scanner-container">
            <button
              onClick={handleClose}
              className="absolute -top-12 right-0 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors border border-white/10 backdrop-blur-md"
              aria-label="Close QR Scanner"
              style={{ pointerEvents: "auto", touchAction: "auto" }}
            >
              ✕
            </button>

            <div className="relative p-4 text-center text-white space-y-3 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/50 to-black/90 z-0"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-semibold mb-2">Scan Car QR Code</h2>
                <p className="text-sm text-white/70">
                  Point your camera at the QR code on the car to start driving
                </p>
              </div>

              <div className="relative mt-3 overflow-hidden rounded-lg z-10" style={{ aspectRatio: "4/3" }}>
                {scanning && (
                  <div className="absolute inset-0 z-10">
                    <Scanner
                      onScan={handleScan}
                      onError={handleError}
                      constraints={{
                        facingMode: "environment",
                      }}
                      scanDelay={500}
                      components={{ finder: false }}
                      classNames={{ container: "custom-scanner" }}
                      styles={{
                        container: {
                          position: "relative",
                          borderRadius: "8px",
                          overflow: "hidden",
                          width: "100%",
                          height: "100%",
                        },
                        video: {
                          objectFit: "cover",
                          width: "100%",
                          height: "100%",
                        },
                      }}
                    />
                  </div>
                )}

                {loading && (
                  <div className="p-8 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                  </div>
                )}
                {/* White framing + scan‑light overlay (always on top) */}
                <div className="qr-scan-frame-container absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                  <div className="qr-scan-frame-box">
                    <div className="qr-corner top-left"></div>
                    <div className="qr-corner top-right"></div>
                    <div className="qr-corner bottom-left"></div>
                    <div className="qr-corner bottom-right"></div>

                    <div className="qr-scan-light"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
