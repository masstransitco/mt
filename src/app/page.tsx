'use client';
import Image from 'next/image';
import CarGrid from '@/components/booking/CarGrid';
import GMap from '@/components/GMap';
import BookingDialog from '@/components/booking/BookingDialog';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-8">
          <Image
            src="/brand/logo.png"
            alt="Car Rental App Logo"
            width={200}
            height={60}
            priority
            className="h-auto w-auto"
          />
        </header>

        <section className="space-y-8">
          <CarGrid />
          
          <div className="h-px bg-border" /> {/* Semantic divider */}
          
          <div className="h-[400px] w-full"> {/* Fixed height container for map */}
            <GMap 
              googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} 
            />
          </div>
        </section>

        <BookingDialog />
      </div>
    </main>
  );
}
