'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { setViewState, selectViewState } from '@/store/userSlice';
import { Car, Map } from 'lucide-react';
import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';

export default function HomePage() {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);

  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  return (
    <main className="min-h-screen bg-background">
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

          {/* Icon-only toggle button */}
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
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-safe-area-inset-bottom relative">
        {/* CarGrid always rendered; controlled by CSS layering */}
        <div className="relative">
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Map is conditionally shown on top of CarGrid */}
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
    </main>
  );
}
