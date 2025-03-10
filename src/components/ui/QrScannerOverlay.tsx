"use client";

import React, { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { useAppDispatch } from "@/store/store";
import { fetchCarByRegistration, setScannedCar } from "@/store/carSlice";
import { selectCar } from "@/store/userSlice";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import { selectDepartureStation, advanceBookingStep } from "@/store/bookingSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { toast } from "react-hot-toast";
// REMOVED or COMMENTED OUT -> import { saveBookingDetails } from "@/store/bookingThunks";

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when QR scanning is successful (used to open detail sheet). */
  onScanSuccess?: () => void; 
}

export default function QrScannerOverlay({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerOverlayProps) {
  const dispatch = useAppDispatch();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleScan = useCallback(
    async (detectedCodes: IDetectedBarcode[]) => {
      if (!detectedCodes.length || !detectedCodes[0].rawValue || loading) return;

      setScanning(false);
      setLoading(true);

      try {
        const scannedValue = detectedCodes[0].rawValue;
        console.log("QR Code Scanned:", scannedValue);

        // Extract car registration from URL
        // e.g. "www.masstransitcar.com/zk5419"
        const match = scannedValue.match(/\/([a-zA-Z0-9]+)(?:\/|$)/);
        if (!match) {
          toast.error("Invalid QR code format");
          onClose();
          return;
        }

        const registration = match[1].toUpperCase();
        console.log("Car registration:", registration);

        // Fetch car by registration
        const carResult = await dispatch(fetchCarByRegistration(registration)).unwrap();
        if (!carResult) {
          toast.error(`Car ${registration} not found`);
          onClose();
          return;
        }

        // Store scanned car in Redux
        await dispatch(setScannedCar(carResult));

        // Select the car in user slice
        await dispatch(selectCar(carResult.id));

        // Fetch dispatch locations if needed
        await dispatch(fetchDispatchLocations());

        // Create virtual station ID from car ID
        const virtualStationId = 1000000 + carResult.id;

        // Use that as departure station, go to step 2
        await dispatch(selectDepartureStation(virtualStationId));
        await dispatch(advanceBookingStep(2));

        // Previously persisted booking state here, but removing that to avoid partial saves:
        /*
        // await dispatch(saveBookingDetails());
        */

        console.log("QR scan complete, car selected, station created.");

        // Optionally notify parent to open detail sheet
        if (onScanSuccess) {
          setTimeout(() => {
            onScanSuccess();
          }, 500);
        }

        toast.success(`Car ${registration} selected and ready to drive`);
      } catch (error) {
        console.error("Error processing QR code:", error);
        toast.error("Failed to process the car QR code");
      } finally {
        setLoading(false);
        onClose();
      }
    },
    [dispatch, onClose, onScanSuccess, loading]
  );

  const handleError = useCallback(
    (error: unknown) => {
      console.error("QR Scanner Error:", error);
      toast.error("Camera error. Please try again.");
      onClose();
    },
    [onClose]
  );

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
              onClick={onClose}
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
                  />
                )}

                {loading && (
                  <div className="p-8 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
