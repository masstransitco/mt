'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { setViewState, selectViewState } from '@/store/userSlice';

// Import icons from lucide-react
import { Car, Map, Menu as MenuIcon, QrCode } from 'lucide-react';

import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';
import AppMenu from '@/components/ui/AppMenu';
// NEW: Import your QR overlay
import QrScannerOverlay from '@/components/ui/QrScannerOverlay';

export default function HomePage() {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);

  // SideSheet state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // QR Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  // Toggle side-sheet
  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Image
            src="/brand/logo.png"
            alt="MTC Logo"
            width={150}
            height={45}
            priority
            className="h-8 w-auto"
          />

          {/* Right-side controls */}
          <div className="flex items-center gap-2">
            {/* QR Code Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              aria-label="Open QR Scanner"
              className="
                flex items-center justify-center
                w-10 h-10
                rounded-full
                text-gray-400
                hover:text-gray-200
                hover:bg-gray-700
                active:bg-gray-600
                transition-colors
              "
            >
              <QrCode className="w-5 h-5" />
            </button>

            {/* Map/Car Toggle Button */}
            <button
              onClick={toggleView}
              aria-label={viewState === 'showMap' ? 'Show Cars' : 'Show Map'}
              className="
                flex items-center justify-center
                w-10 h-10
                rounded-full
                text-gray-400
                hover:text-gray-200
                hover:bg-gray-700
                active:bg-gray-600
                transition-colors
              "
            >
              {viewState === 'showMap' ? (
                <Car className="w-5 h-5" />
              ) : (
                <Map className="w-5 h-5" />
              )}
            </button>

            {/* Menu Button */}
            <button
              onClick={toggleMenu}
              aria-label="Menu"
              className="
                flex items-center justify-center
                w-10 h-10
                rounded-full
                text-gray-400
                hover:text-gray-200
                hover:bg-gray-700
                active:bg-gray-600
                transition-colors
              "
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-safe-area-inset-bottom relative">
        {/* Car Grid always present */}
        <div className="relative">
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Condition: Show map on top if viewState is 'showMap' */}
        {viewState === 'showMap' && (
          <div className="absolute inset-0 h-[calc(100vh-4rem)] pt-4">
            <div className="h-full w-full rounded-2xl overflow-hidden">
              <GMap 
                googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
              />
            </div>
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <BookingDialog />

      {/* Side-Sheet + Menu */}
      <SideSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <AppMenu />
      </SideSheet>

      {/* QR Scanner Overlay */}
      <QrScannerOverlay
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </main>
  );
}
