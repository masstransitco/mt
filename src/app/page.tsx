"use client";

import React, { useState, useCallback } from "react";
import Head from "next/head";
import { Menu as MenuIcon } from "lucide-react";
import dynamic from "next/dynamic";

import BookingDialog from "@/components/booking/BookingDialog";
import SideSheet from "@/components/ui/SideSheet";
import { QrCodeIcon } from "@/components/ui/icons/QrCodeIcon";
// New import for the inline SVG
import { LogoSvg } from "@/components/ui/logo/LogoSvg";

// Dynamically import with no SSR
const GMapWithErrorBoundary = dynamic(() => import("@/components/GMap"), {
  ssr: false,
});
const AppMenu = dynamic(() => import("@/components/ui/AppMenu"), {
  ssr: false,
});
const QrScannerOverlay = dynamic(() => import("@/components/ui/QrScannerOverlay"), {
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
        {/* Disable zooming */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Head>

      <main
        className="min-h-screen bg-background flex flex-col overflow-hidden"
        style={{ touchAction: "none" }}
      >
       {/* Header */}
<header
  className="
    sticky top-0 z-50 
    bg-black/90
    backdrop-blur-md 
    border-b 
    border-gray-800
    h-[50px] 
    select-none
  "
>
  <div className="relative h-full flex items-center justify-between px-2">
    {/* Left: Logo */}
    <div className="flex items-center">
      {/* Inline LogoSvg instead of the previous next/image */}
      <LogoSvg
        aria-label="Logo"
        width={50}
        height={50}
        className="object-contain"
      />
    </div>

    {/* Right Icons */}
    <div className="flex items-center space-x-3 mr-1">
      <button
        onClick={() => setIsScannerOpen(true)}
        className="
          flex items-center justify-center 
          w-9 h-9 
          rounded-full 
          text-white
          bg-gray-800/60
          hover:bg-gray-800/80
          active:scale-95
          transition-all duration-200
        "
      >
        <QrCodeIcon className="w-5 h-5" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700" />

      <button
        onClick={toggleMenu}
        className="
          flex items-center justify-center 
          w-9 h-9 
          rounded-full 
          text-white
          bg-gray-800/60
          hover:bg-gray-800/80
          active:scale-95
          transition-all duration-200
        "
      >
        <MenuIcon className="w-5 h-5" />
      </button>
    </div>
  </div>
</header>

        {/* Main content area */}
        <div className="flex-1 relative">
          <GMapWithErrorBoundary
            googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
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
