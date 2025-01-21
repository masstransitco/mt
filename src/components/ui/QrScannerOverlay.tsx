// src/components/ui/QrScannerOverlay.tsx
'use client';

import React, { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import QrReader from 'react-qr-reader';

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QrScannerOverlay({
  isOpen,
  onClose
}: QrScannerOverlayProps) {
  // Handle successful QR code scan
  const handleScan = useCallback(
    (data: string | null) => {
      if (data) {
        console.log('QR Code Scanned:', data);
        // Here, you can dispatch an action, navigate, or do anything with the scanned data
        onClose();
      }
    },
    [onClose]
  );

  // Handle errors (e.g., camera permission issues)
  const handleError = useCallback((err: unknown) => {
    console.error('QR Scanner Error:', err);
    // Optionally, show a user-friendly error message
  }, []);

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
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-white text-lg"
              aria-label="Close QR Scanner"
            >
              ✕
            </button>

            {/* Prompt + Camera Feed */}
            <div className="p-4 text-center text-white space-y-3 bg-black bg-opacity-50 rounded-md">
              <h2 className="text-xl font-bold">Scan QR Code</h2>
              <p className="text-sm">
                Point your camera at the QR code on the car to start driving
              </p>

              <div className="mt-3 overflow-hidden rounded-md">
                <QrReader
                  delay={300}
                  onError={handleError}
                  onScan={handleScan}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
