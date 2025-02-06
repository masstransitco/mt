'use client';

import React, { useState, useCallback } from 'react';
import { Menu as MenuIcon, QrCode } from 'lucide-react';

import GMapWithErrorBoundary from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';
import AppMenu from '@/components/ui/AppMenu';
import QrScannerOverlay from '@/components/ui/QrScannerOverlay';

export default function Page() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);
  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border h-[57px]">
        <div className="h-full px-4 flex items-center justify-between">
          <button
            onClick={toggleMenu}
            className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content area: Always render GMap which now contains the CarSheet */}
      <div className="flex-1 relative">
        <GMapWithErrorBoundary
          googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
        />
      </div>

      {/* Booking Dialog */}
      <BookingDialog />

      {/* Side Sheet Menu */}
      <SideSheet isOpen={isMenuOpen} onClose={handleMenuClose} size="full">
        <AppMenu onClose={handleMenuClose} />
      </SideSheet>

      {/* QR Scanner Overlay */}
      {isScannerOpen && (
        <QrScannerOverlay
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </main>
  );
}
