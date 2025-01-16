'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { resetBooking } from '@/store/userSlice';
import { confirmBookingStep, selectBookingStep, selectDepartureDate, setDepartureDate } from '@/store/bookingSlice';
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
import IDVerificationStep from './IDVerificationStep';
import PaymentStep from './PaymentStep';

export default function BookingDialog() {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const selectedStationId = useAppSelector((state) => state.user.selectedStationId);
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);

  const [open, setOpen] = useState<boolean>(false);

  // If user selected both car and station, open the dialog
  useEffect(() => {
    if (selectedCarId && selectedStationId) {
      setOpen(true);
    }
  }, [selectedCarId, selectedStationId]);

  // Closes the dialog and resets everything
  const handleCancel = () => {
    setOpen(false);
    dispatch(resetBooking());
  };

  // Step: 1 -> Set date/time, then proceed
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setDepartureDate(new Date(e.target.value)));
    dispatch(confirmBookingStep(2));
  };

  // Step: 2 -> Confirm booking
  const handleConfirmBookingDetails = () => {
    dispatch(confirmBookingStep(3));
  };

  // Step: 3 -> ID Verification step handled in IDVerificationStep
  const handleIDVerified = () => {
    dispatch(confirmBookingStep(4));
  };

  // Step: 4 -> Payment step handled in PaymentStep
  const handlePaymentComplete = () => {
    // Payment done -> finalize booking
    dispatch(confirmBookingStep(5));
  };

  // Once bookingStep === 5, we finalize
  useEffect(() => {
    if (bookingStep === 5) {
      // Submit to /api/bookings
      const bookingPayload = {
        carId: selectedCarId,
        stationId: selectedStationId,
        departureDate
        // plus ID docs, payment method, etc.
      };
      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('Booking created:', data);
          // Possibly show success message or route to success page
        })
        .catch((err) => {
          console.error('Booking creation error:', err);
        })
        .finally(() => {
          setOpen(false);
          dispatch(resetBooking());
        });
    }
  }, [bookingStep, selectedCarId, selectedStationId, departureDate, dispatch]);

  const renderStepContent = () => {
    switch (bookingStep) {
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
      case 3:
        return <IDVerificationStep onVerified={handleIDVerified} />;
      case 4:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      default:
        return null;
    }
  };

  const renderFooterButtons = () => {
    switch (bookingStep) {
      case 1:
        // The user will proceed automatically to step 2 once they pick a date
        return null;
      case 2:
        return (
          <AlertDialogAction
            onClick={handleConfirmBookingDetails}
            className="bg-primary hover:bg-primary/90"
          >
            Confirm Details
          </AlertDialogAction>
        );
      case 3:
      case 4:
        // Buttons are handled within the step components
        return null;
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
          {renderFooterButtons()}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
