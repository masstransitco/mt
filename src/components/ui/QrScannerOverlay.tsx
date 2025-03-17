"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { fetchCarByRegistration, setScannedCar } from "@/store/carSlice";
import type { Car } from "@/types/cars";

import {
  selectStationsWithDistance,
} from "@/store/stationsSlice";
import { toast } from "react-hot-toast";

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when QR scanning is successful (used to open a detail sheet, for example). */
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
  const stations = useAppSelector(selectStationsWithDistance);

  // Reset scanning state when overlay is toggled
  useEffect(() => {
    if (isOpen) {
      setScanning(true);
      setLoading(false);
    }
  }, [isOpen]);


  /**
   * Main handler for successful QR scans.
   */
  const handleScan = useCallback(
    async (detectedCodes: IDetectedBarcode[]) => {
      if (!detectedCodes.length || !detectedCodes[0].rawValue || loading) return;

      setScanning(false);
      setLoading(true);

      try {
        const scannedValue = detectedCodes[0].rawValue;
        console.log("QR Code Scanned:", scannedValue);

        // Extract car registration from QR code
        const match = scannedValue.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
        if (!match) {
          toast.error("Invalid QR code format");
          onClose();
          return;
        }

        const registration = match[1].toUpperCase();
        console.log("Car registration:", registration);

        // Fetch car details from the backend
        const carResult = await dispatch(
          fetchCarByRegistration(registration)
        ).unwrap();
        if (!carResult) {
          toast.error(`Car ${registration} not found`);
          onClose();
          return;
        }

        // Update Redux with the scanned car
        await dispatch(setScannedCar(carResult));

        // Inform parent component with the car result
        if (onScanSuccess) {
          setTimeout(() => {
            onScanSuccess(carResult);
          }, 500);
        }

        toast.success(`Car ${registration} found!`);
      } catch (error) {
        console.error("Error processing QR code:", error);
        toast.error("Failed to process the car QR code");
      } finally {
        setLoading(false);
        console.log("handleScan complete, closing overlay.");
        onClose();
      }
    },
    [dispatch, onClose, onScanSuccess, loading]
  );

  /**
   * If the scanner fails (camera not accessible, etc.), handle gracefully.
   */
  const handleError = useCallback(
    (error: unknown) => {
      console.error("QR Scanner Error:", error);
      toast.error("Camera error. Please try again.");
      onClose();
    },
    [onClose]
  );

  /**
   * When the user closes the overlay manually.
   */
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
                      facingMode: "environment", // Prefer back camera
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
