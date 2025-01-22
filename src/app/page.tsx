'use client';
import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { setViewState, selectViewState } from '@/store/userSlice';
import { Car, Map, Menu as MenuIcon, QrCode } from 'lucide-react';
import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';
import SideSheet from '@/components/ui/SideSheet';
import AppMenu from '@/components/ui/AppMenu';
import QrScannerOverlay from '@/components/ui/QrScannerOverlay';

export default function HomePage() {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header - height: 57px (14px + 29px + 14px) */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border h-[57px]">
        <div className="h-full px-4 flex items-center justify-between">
          <Image
            src="/brand/logo.png"
            alt="MTC Logo"
            width={150}
            height={45}
            priority
            className="h-8 w-auto"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={toggleView}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              {viewState === 'showMap' ? (
                <Car className="w-5 h-5" />
              ) : (
                <Map className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleMenu}
              className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-200 hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 relative">
        {/* Cars Grid */}
        <div 
          className={`px-4 transition-opacity duration-300 ${
            viewState === 'showMap' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Map */}
        {viewState === 'showMap' && (
          <div className="absolute inset-0">
            <GMap 
              googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
          </div>
        )}
      </div>

      <BookingDialog />
      
      <SideSheet 
        isOpen={isMenuOpen} 
        onClose={handleMenuClose}
        size="full"
      >
        <AppMenu onClose={handleMenuClose} />
      </SideSheet>

      {isScannerOpen && (
        <QrScannerOverlay
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </main>
  );
}
