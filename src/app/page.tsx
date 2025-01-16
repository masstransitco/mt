'use client';
import Image from 'next/image';
import { useState } from 'react';
import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';

export default function HomePage() {
  const [isMapExpanded, setIsMapExpanded] = useState(false);

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
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="btn-primary text-sm py-2 px-4 h-auto"
          >
            {isMapExpanded ? 'Show Cars' : 'Show Map'}
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-safe-area-inset-bottom">
        {/* Conditional rendering based on view mode */}
        <div className={`transition-all duration-300 ${
          isMapExpanded ? 'h-0 overflow-hidden' : 'h-auto py-4'
        }`}>
          <CarGrid className="grid grid-cols-1 gap-4 auto-rows-max" />
        </div>

        {/* Expandable map */}
        <div className={`transition-all duration-300 ${
          isMapExpanded 
            ? 'h-[calc(100vh-4rem)] pt-4' 
            : 'h-0 overflow-hidden'
        }`}>
          <div className="h-full w-full rounded-2xl overflow-hidden">
            <GMap 
              googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
            />
          </div>
        </div>
      </div>

      {/* Bottom sheet dialog */}
      <BookingDialog />
    </main>
  );
}
