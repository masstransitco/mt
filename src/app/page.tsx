'use client';

import React, { useState, useCallback } from 'react';
import { Menu as MenuIcon, QrCode } from 'lucide-react';
import Image from 'next/image';

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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border h-[50px]">
        <div className="relative h-full flex items-center px-2">
          {/* Right Icons */}
          <div className="absolute right-2 flex items-center space-x-2">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
            {/* Vertical Divider */}
            <div className="w-px h-6 bg-gray-500" />
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>
          {/* Centered Logo */}
          <div className="flex-grow flex justify-center">
            <Image
              src="/brand/logo.png"
              alt="Logo"
              width={20}
              height={20}
              className="object-contain"
            />
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
