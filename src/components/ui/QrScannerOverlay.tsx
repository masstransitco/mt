import React, { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QrScannerOverlay({
  isOpen,
  onClose
}: QrScannerOverlayProps) {
  const handleDecode = useCallback((result: string | null) => {
    if (result) {
      console.log('QR Code Scanned:', result);
      // Perform your action here
      onClose();
    }
  }, [onClose]);

  // Change the error type to 'unknown' or 'any'
  const handleError = useCallback((error: unknown) => {
    console.error('QR Scanner Error:', error);
    // Optionally, you could refine the type:
    // if (error instanceof Error) { ... }
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
            <button
              onClick={onClose}
              className="absolute top-2 right-2 text-white text-lg"
              aria-label="Close QR Scanner"
            >
              ✕
            </button>

            <div className="p-4 text-center text-white space-y-3 bg-black bg-opacity-50 rounded-md">
              <h2 className="text-xl font-bold">Scan QR Code</h2>
              <p className="text-sm">
                Point your camera at the QR code on the car to start driving
              </p>

              <div className="mt-3 overflow-hidden rounded-md">
                <Scanner 
                  onDecode={handleDecode} 
                  onError={handleError} 
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
