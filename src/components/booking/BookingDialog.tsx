"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";

// userSlice
import { resetUserSelections } from "@/store/userSlice";
import {
  selectDepartureStationId,
  selectArrivalStationId,
} from "@/store/userSlice";

// bookingSlice
import {
  advanceBookingStep,
  selectBookingStep,
  selectDepartureDate,
  setDepartureDate,
  resetBookingFlow,
} from "@/store/bookingSlice";

import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Example step components
import IDVerificationStep from "./IDVerificationStep";
import PaymentStep from "./PaymentStep";

/** 
 * Optional step 6: show a success or summary screen. 
 * You can replace this with a redirect, or simply 
 * not have a step 6 if you prefer.
 */
function BookingCompleteStep() {
  return (
    <div className="space-y-4">
      <h3 className="font-medium">Booking Complete</h3>
      <p className="text-sm text-muted-foreground">
        Your booking has been successfully created.
      </p>
    </div>
  );
}

export default function BookingDialog() {
  const dispatch = useAppDispatch();

  // If you store selectedCarId in userSlice
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // Station IDs
  const departureStationId = useAppSelector(selectDepartureStationId);
  const arrivalStationId = useAppSelector(selectArrivalStationId);

  // bookingSlice state
  const bookingStep = useAppSelector(selectBookingStep);
  const departureDate = useAppSelector(selectDepartureDate);

  // local UI state: whether the dialog is open
  const [open, setOpen] = useState<boolean>(false);

  // Local error message for step 5 (finalizing)
  const [bookingError, setBookingError] = useState<string | null>(null);

  /**
   * If the user has:
   * - selected a car
   * - selected a departure station
   * - selected an arrival station
   * => automatically open the booking dialog.
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
   * STEP 5: Finalizing the booking => We'll create the booking 
   * only once when entering step 5. Then move to step 6 (success).
   */
  useEffect(() => {
    if (bookingStep === 5) {
      setBookingError(null); // clear any previous error

      const bookingPayload = {
        carId: selectedCarId,
        departureStationId,
        arrivalStationId,
        departureDate,
      };

      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      })
        .then((res) => {
          // You might check if !res.ok => throw new Error(...)
          return res.json();
        })
        .then((data) => {
          console.log("Booking created:", data);
          // Show success message or route user
          // Move to step 6 => "Booking complete"
          dispatch(advanceBookingStep(6));
        })
        .catch((err) => {
          console.error("Booking creation error:", err);
          // E.g. store error in local state & remain on step 5
          setBookingError("Failed to finalize booking. Please try again.");
          // Optionally fallback to step=4 if you want:
          // dispatch(advanceBookingStep(4));
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
        if (!departureDate) return null;
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Confirm Booking Details</h3>
            <div className="bg-accent/10 p-4 rounded space-y-2">
              <p className="text-foreground">Vehicle: Car #{selectedCarId}</p>
              <p className="text-foreground">
                Departure Station: #{departureStationId}
              </p>
              <p className="text-foreground">
                Arrival Station: #{arrivalStationId}
              </p>
              <p className="text-foreground">
                Departure: {format(departureDate, "PPpp")}
              </p>
            </div>
          </div>
        );
      case 3:
        // ID Verification step
        return <IDVerificationStep onVerified={handleIDVerified} />;
      case 4:
        // Payment step
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 5:
        // Step 5 => finalizing => show spinner or error
        return (
          <div className="space-y-4 text-center">
            <p className="font-medium text-sm">
              Finalizing your booking...
            </p>
            {/* If there's a bookingError, display it */}
            {bookingError && (
              <div className="mt-2 text-sm text-destructive">
                {bookingError}
              </div>
            )}
            {/* Optionally show a "Retry" button to go back to step 4 */}
            {bookingError && (
              <button
                onClick={() => {
                  dispatch(advanceBookingStep(4));
                  setBookingError(null);
                }}
                className="
                  px-4 py-2 text-sm mt-2
                  bg-muted hover:bg-muted/80
                  text-foreground rounded
                "
              >
                Go Back & Retry Payment
              </button>
            )}
          </div>
        );
      case 6:
        // Step 6 => booking complete
        return <BookingCompleteStep />;
      default:
        return null;
    }
  };

  /* -------------- RENDER FOOTER BUTTONS -------------- */
  const renderFooterButtons = () => {
    switch (bookingStep) {
      case 1:
        // Step 1 => date/time => auto-advance after user picks date
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
        // Steps 3 & 4 have internal flows (IDVerification, Payment)
        return null;
      case 5:
        // Step 5 => finalizing => show no standard buttons
        return null;
      case 6:
        // Step 6 => Booking complete => user might close
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
          {/* "Cancel" always calls handleCancel => resets everything */}
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          {renderFooterButtons()}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
