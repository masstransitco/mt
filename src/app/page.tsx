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

  const toggleView = useCallback(() => {
    dispatch(setViewState(viewState === 'showMap' ? 'showCar' : 'showMap'));
  }, [dispatch, viewState]);

  return (
    <main className="min-h-screen bg-background">
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

      <div className="container mx-auto px-4 pb-safe-area-inset-bottom relative">
        {/* Always render CarGrid but control visibility */}
        <div className="relative">
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Map rendered conditionally */}
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

      <BookingDialog />
    </main>
  );
}
