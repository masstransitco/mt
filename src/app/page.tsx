'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/store/store';

// Import from uiSlice (instead of userSlice) for UI view toggles
import { setViewState, selectViewState } from '@/store/uiSlice';

// Other icons
import { Car, Map, Menu as MenuIcon, QrCode } from 'lucide-react';

// Components
import CarGrid from '@/components/booking/CarGrid';
import GMapWithErrorBoundary from '@/components/GMap'; // if using the error boundary version
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';
import AppMenu from '@/components/ui/AppMenu';
import QrScannerOverlay from '@/components/ui/QrScannerOverlay';

export default function Page() {
  const dispatch = useAppDispatch();

  // Get the current view from uiSlice
  const viewState = useAppSelector(selectViewState);

  // Local UI states for menu and QR scanner
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Toggle between showCar / showMap
  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  // Menu toggles
  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);
  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // Render
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border h-[57px]">
        <div className="h-full px-4 flex items-center justify-between">
          
          {/* Menu Button on the Left */}
          <button
            onClick={toggleMenu}
            className="flex items-center justify-center w-10 h-10 rounded-full
                       text-gray-400 hover:text-gray-200 hover:bg-gray-700
                       active:bg-gray-600 transition-colors"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Commented-out Logo
          <Image
            src="/brand/logo.png"
            alt="MTC Logo"
            width={150}
            height={45}
            priority
            className="h-8 w-auto"
          />
          */}

          <div className="flex items-center gap-2">
            {/* QR Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full
                         text-gray-400 hover:text-gray-200 hover:bg-gray-700
                         active:bg-gray-600 transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>

            {/* Subtle separator */}
            <div className="h-6 w-px bg-gray-700 mx-1" />

            {/* Toggle Car / Map View */}
            <button
              onClick={toggleView}
              className="flex items-center justify-center w-10 h-10 rounded-full
                         text-gray-400 hover:text-gray-200 hover:bg-gray-700
                         active:bg-gray-600 transition-colors"
            >
              {viewState === 'showMap' ? (
                <Car className="w-5 h-5" />
              ) : (
                <Map className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 relative">
        {/* CarGrid */}
        <div
          className={`px-4 transition-opacity duration-300 ${
            viewState === 'showMap'
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          }`}
        >
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Map */}
        {viewState === 'showMap' && (
          <div className="absolute inset-0">
            <GMapWithErrorBoundary
              googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
          </div>
        )}
      </div>

      {/* Booking steps (dialog) */}
      <BookingDialog />

      {/* Side Sheet Menu */}
      <SideSheet isOpen={isMenuOpen} onClose={handleMenuClose} size="full">
        <AppMenu onClose={handleMenuClose} />
      </SideSheet>

      {/* QR Scanner */}
      {isScannerOpen && (
        <QrScannerOverlay
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </main>
  );
}
