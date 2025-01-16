// src/components/booking/BookingDialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { resetBooking } from '@/store/userSlice';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { Booking } from '@/types/booking';

interface BookingStep {
  step: number;
  title: string;
}

const BOOKING_STEPS: BookingStep[] = [
  { step: 1, title: 'Select Departure Time' },
  { step: 2, title: 'Confirm Booking Details' }
];

export default function BookingDialog() {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const selectedStationId = useAppSelector((state) => state.user.selectedStationId);
  
  const [step, setStep] = useState<number>(1);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  
  useEffect(() => {
    if (selectedCarId && selectedStationId) {
      setOpen(true);
    }
  }, [selectedCarId, selectedStationId]);

  const handleComplete = () => {
    if (!departureDate || !selectedCarId || !selectedStationId) return;
    
    const booking: Booking = {
      carId: selectedCarId,
      stationId: selectedStationId,
      departureDate
    };
    
    console.log('Booking created:', booking);
    
    // Here you would typically dispatch a createBooking action
    // dispatch(createBooking(booking));
    
    setOpen(false);
    dispatch(resetBooking());
  };

  const handleCancel = () => {
    setOpen(false);
    dispatch(resetBooking());
    setStep(1);
    setDepartureDate(null);
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepartureDate(new Date(e.target.value));
    setStep(2);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Select Departure Time</h3>
            <input 
              type="datetime-local"
              className="w-full p-2 rounded border border-border bg-background text-foreground"
              onChange={handleDateSelect}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>
        );
      case 2:
        return departureDate && (
          <div className="space-y-4">
            <h3 className="font-medium">Confirm Booking Details</h3>
            <div className="bg-accent/10 p-4 rounded space-y-2">
              <p className="text-foreground">Vehicle: Car #{selectedCarId}</p>
              <p className="text-foreground">Station: Station #{selectedStationId}</p>
              <p className="text-foreground">Departure: {format(departureDate, 'PPpp')}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Complete Your Booking</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {renderStepContent()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          {step === 2 && (
            <AlertDialogAction
              onClick={handleComplete}
              className="bg-primary hover:bg-primary/90"
            >
              Confirm Booking
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
