'use client';

import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { Menu as MenuIcon } from 'lucide-react';
import Image from 'next/image';

import dynamic from 'next/dynamic'; // <-- Import dynamic

import GMapWithErrorBoundary from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';

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
            {/* Left: Logo with 8px left margin */}
            <div className="flex items-center ml-2">
              <Image
                src="/brand/logo.png"
                alt="Logo"
                width={50}
                height={50}
                className="object-contain"
              />
            </div>
            {/* Right Icons with 8px right margin */}
            <div className="flex items-center space-x-2 mr-2">
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
              >
                {/* Custom QR Code Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#000000" fill="none">
                  <path d="M18 15L18 18H14L14 15L18 15Z" fill="currentColor" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M1.5 1.49994H9.1306V3.40903H3.40909V9.13054H1.5V1.49994ZM20.5909 3.40903H14.8694V1.49994H22.5V9.13054H20.5909V3.40903ZM22.5 14.8693V22.4999H14.8694V20.5908H20.5909V14.8693H22.5ZM1.5 14.8693H3.40909V20.5908H9.1306V22.4999H1.5V14.8693Z" fill="currentColor" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 12V6H14V13C14 13.5523 13.5523 14 13 14H6V12H12Z" fill="currentColor" />
                  <path d="M10 6L10 10H6L6 6L10 6Z" fill="currentColor" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M11 18H6V16H11V18Z" fill="currentColor" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M16 12L16 10L18 10L18 12L16 12Z" fill="currentColor" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M16 8L16 6L18 6L18 8L16 8Z" fill="currentColor" />
                </svg>
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
          </div>
        </header>

        {/* Main content area: Always render GMap (which now might contain the CarSheet) */}
        <div className="flex-1 relative">
          <GMapWithErrorBoundary
            googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
          />
        </div>

        {/* Booking Dialog */}
        <BookingDialog />

        {/* Side Sheet Menu */}
        <SideSheet isOpen={isMenuOpen} onClose={handleMenuClose} size="full">
          {/* 2. Lazy-loaded AppMenu */}
          <AppMenu onClose={handleMenuClose} />
        </SideSheet>

        {/* QR Scanner Overlay (lazy-loaded) */}
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
