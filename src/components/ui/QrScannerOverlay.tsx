import React, { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QrScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (result: string) => void;
}

export default function QrScannerOverlay({
  isOpen,
  onClose,
  onScan
}: QrScannerOverlayProps) {
  const handleResult = useCallback((result: { text: string }) => {
    console.log('QR Code Scanned:', result.text);
    if (onScan) {
      onScan(result.text);
    }
    onClose();
  }, [onClose, onScan]);

  const handleError = useCallback((error: unknown) => {
    console.error('QR Scanner Error:', error);
    // Type guard to safely handle Error objects
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
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
              className="absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close QR Scanner"
            >
              ✕
            </button>
            
            <div className="p-4 text-center text-white space-y-3 bg-black bg-opacity-50 rounded-lg">
              <h2 className="text-xl font-bold">Scan QR Code</h2>
              <p className="text-sm">
                Point your camera at the QR code on the car to start driving
              </p>
              
              <div className="mt-3 overflow-hidden rounded-lg">
                <Scanner
                  onResult={handleResult}
                  onError={handleError}
                  constraints={{
                    facingMode: 'environment'
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
