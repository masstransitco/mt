'use client';

import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';

// userSlice: we assume you have two station IDs now
import { resetUserSelections } from '@/store/userSlice';
import { selectDepartureStationId, selectArrivalStationId } from '@/store/userSlice';

// bookingSlice: step flow, departure date, etc.
import {
  advanceBookingStep,
  selectBookingStep,
  selectDepartureDate,
  setDepartureDate,
  resetBookingFlow,
} from '@/store/bookingSlice';

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

// Example: Additional step components for ID verification + payment
import IDVerificationStep from './IDVerificationStep';
import PaymentStep from './PaymentStep';

export default function BookingDialog() {
  const dispatch = useAppDispatch();

  // If you store selectedCarId in userSlice
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // The two-station approach: departure + arrival
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // bookingSlice state
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);

  // local UI state: whether the dialog is open
  const [open, setOpen] = useState<boolean>(false);

  /**
   * When the user has:
   * - selected a car
   * - selected a departure station
   * - selected an arrival station
   * We automatically open the booking dialog.
   */
  useEffect(() => {
    if (selectedCarId && departureStationId && arrivalStationId) {
      setOpen(true);
    }
  }, [selectedCarId, departureStationId, arrivalStationId]);

  /* -------------- CANCEL / CLOSE -------------- */
  const handleCancel = () => {
    setOpen(false);
    // Clear out user selections + booking flow
    dispatch(resetUserSelections());
    dispatch(resetBookingFlow());
  };

  /* -------------- STEP 1: Set departure date/time -------------- */
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setDepartureDate(new Date(e.target.value)));
    dispatch(advanceBookingStep(2));
  };

  /* -------------- STEP 2: Confirm booking details -------------- */
  const handleConfirmBookingDetails = () => {
    dispatch(advanceBookingStep(3)); // Next step: ID verification
  };

  /* -------------- STEP 3: ID Verification -------------- */
  const handleIDVerified = () => {
    dispatch(advanceBookingStep(4)); // Next step: Payment
  };

  /* -------------- STEP 4: Payment -------------- */
  const handlePaymentComplete = () => {
    // Payment done -> finalize booking
    dispatch(advanceBookingStep(5));
  };

  /**
   * STEP 5: Finalizing the booking
   * If bookingStep=5, we create the booking in an effect
   * so it runs once.
   */
  useEffect(() => {
    if (bookingStep === 5) {
      const bookingPayload = {
        carId: selectedCarId,
        departureStationId,
        arrivalStationId,
        departureDate,
        // e.g. ID docs, payment method, etc. if in bookingSlice
      };

      // Example POST to your /api/bookings endpoint
      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log('Booking created:', data);
          // Show success message or route user
        })
        .catch((err) => {
          console.error('Booking creation error:', err);
        })
        .finally(() => {
          // Close dialog & reset
          setOpen(false);
          dispatch(resetUserSelections());
          dispatch(resetBookingFlow());
        });
    }
  }, [
    bookingStep,
    selectedCarId,
    departureStationId,
    arrivalStationId,
    departureDate,
    dispatch,
  ]);

  /* -------------- RENDER UI PER STEP -------------- */
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
        // Show summary of car & stations & date
        return (
          departureDate && (
            <div className="space-y-4">
              <h3 className="font-medium">Confirm Booking Details</h3>
              <div className="bg-accent/10 p-4 rounded space-y-2">
                <p className="text-foreground">Vehicle: Car #{selectedCarId}</p>
                <p className="text-foreground">
                  Departure Station: #{departureStationId}
                </p>
                <p className="text-foreground">Arrival Station: #{arrivalStationId}</p>
                <p className="text-foreground">
                  Departure: {format(departureDate, 'PPpp')}
                </p>
              </div>
            </div>
          )
        );
      case 3:
        // ID Verification step
        return <IDVerificationStep onVerified={handleIDVerified} />;
      case 4:
        // Payment step
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      default:
        return null;
    }
  };

  /* -------------- RENDER FOOTER BUTTONS -------------- */
  const renderFooterButtons = () => {
    switch (bookingStep) {
      case 1:
        // Step 1 auto-advances after user picks date/time
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
        // Steps 3 & 4 have their own internal flows
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
