'use client';

import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { Menu as MenuIcon } from 'lucide-react';
import Image from 'next/image';

import dynamic from 'next/dynamic'; // <-- Import dynamic

import GMapWithErrorBoundary from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';

// Import our new reusable icon component
import { QrCodeIcon } from '@/components/ui/icons/QrCodeIcon';

// 1. Dynamically import AppMenu and QrScannerOverlay with no SSR
const AppMenu = dynamic(() => import('@/components/ui/AppMenu'), {
  ssr: false,
});
const QrScannerOverlay = dynamic(() => import('@/components/ui/QrScannerOverlay'), {
  ssr: false,
});

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
    <>
      <Head>
        {/* This meta tag disables zooming by setting maximum-scale=1.0 and user-scalable=no */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Head>
      <main className="min-h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border h-[50px] select-none">
          <div className="relative h-full flex items-center justify-between px-0">
            {/* Left: Logo */}
            <div className="flex items-center ml-2">
              <Image
                src="/brand/logo.png"
                alt="Logo"
                width={50}
                height={50}
                className="object-contain"
              />
            </div>
            {/* Right Icons */}
            <div className="flex items-center space-x-2 mr-2">
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full 
                           text-gray-400 hover:text-gray-200 hover:bg-gray-700 
                           active:bg-gray-600 transition-colors"
              >
                {/* Reusable QrCodeIcon here */}
                <QrCodeIcon className="w-5 h-5" />
              </button>
              {/* Divider */}
              <div className="w-px h-6 bg-gray-500" />
              <button
                onClick={toggleMenu}
                className="flex items-center justify-center w-8 h-8 rounded-full 
                           text-gray-400 hover:text-gray-200 hover:bg-gray-700 
                           active:bg-gray-600 transition-colors"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main content area */}
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
    </>
  );
}
