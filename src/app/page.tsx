'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { setViewState, selectViewState } from '@/store/userSlice';
import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';

export default function HomePage() {
  const dispatch = useDispatch();
  const viewState = useSelector(selectViewState);

  // Use useCallback to avoid re-creating toggle function on each render
  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  return (
    <main className="min-h-screen bg-background">
      {/* Sticky header with shadow */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Image
            src="/brand/logo.png"
            alt="MTC Logo"
            width={150}
            height={45}
            priority
            className="h-8 w-auto"
          />
          <button 
            onClick={toggleView}
            className="btn-primary text-sm py-2 px-4 h-auto"
          >
            {viewState === 'showMap' ? 'Show Cars' : 'Show Map'}
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-safe-area-inset-bottom">
        {/* Cars section transitions */}
        <div
          className={`transition-all duration-300 ${
            viewState === 'showMap'
              ? 'h-0 overflow-hidden'
              : 'h-auto py-4'
          }`}
        >
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Map section transitions */}
        <div
          className={`transition-all duration-300 ${
            viewState === 'showMap'
              ? 'h-[calc(100vh-4rem)] pt-4'
              : 'h-0 overflow-hidden'
          }`}
        >
          <div className="h-full w-full rounded-2xl overflow-hidden">
            <GMap 
              googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
          </div>
        </div>
      </div>

      {/* Bottom sheet booking dialog */}
      <BookingDialog />
    </main>
  );
}
