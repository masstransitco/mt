"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { format } from "date-fns";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

// userSlice
import { resetUserSelections, selectDepartureStationId, selectArrivalStationId, selectIsSignedIn } from "@/store/userSlice";
// bookingSlice
import { advanceBookingStep, selectBookingStep, selectDepartureDate, setDepartureDate, resetBookingFlow } from "@/store/bookingSlice";

import IDVerificationStep from "./IDVerificationStep";
import PaymentStep from "./PaymentStep";

// Our new ticket plan step
import TicketPlanStep from "./TicketPlanStep";

/** Step 8: The "complete" or success screen */
function BookingCompleteStep() {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-xl">Booking Complete</h3>
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

  // Check sign-in from Redux
  const isUserSignedIn = useAppSelector(selectIsSignedIn);

  // local UI state: whether the dialog is open
  const [open, setOpen] = useState<boolean>(false);

  // Local error message for finalizing (step 7)
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
    // Payment done -> go to ticket plan
    dispatch(advanceBookingStep(5));
  };

  /* -------------- STEP 5: Ticket Plan -------------- */
  const handleTicketPlanSelected = (plan: "single" | "paygo") => {
    // Here you can store the plan in Redux if you want:
    // dispatch(setTicketPlan(plan)); // if you have a new field
    // Then proceed to step 7 => finalizing
    // Or if you want an extra step 6 for something else, do `advanceBookingStep(6)`.
    dispatch(advanceBookingStep(7));
  };

  /* -------------- STEP 7: Finalizing => POST booking -------------- */
  useEffect(() => {
    if (bookingStep === 7) {
      setBookingError(null);

      const bookingPayload = {
        carId: selectedCarId,
        departureStationId,
        arrivalStationId,
        departureDate,
        // plan: ticketPlan // if you stored it above
      };

      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Booking created:", data);
          dispatch(advanceBookingStep(8)); // Step 8 => complete
        })
        .catch((err) => {
          console.error("Booking creation error:", err);
          setBookingError("Failed to finalize booking. Please try again.");
          // Optionally fallback to step=5 for ticket plan, or step=4 for payment
          // dispatch(advanceBookingStep(5));
        });
    }
  }, [bookingStep, selectedCarId, departureStationId, arrivalStationId, departureDate, dispatch]);

  /* -------------- RENDER UI PER STEP -------------- */
  const renderStepContent = () => {
    switch (bookingStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="font-medium text-xl">Select Departure Time</h3>
            <input
              type="datetime-local"
              className="w-full p-2 rounded border border-border bg-background text-foreground"
              onChange={handleDateSelect}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>
        );
      case 2:
        if (!departureDate) return null;
        return (
          <div className="space-y-4">
            <h3 className="font-medium text-xl">Confirm Booking Details</h3>
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
        return <IDVerificationStep onVerified={handleIDVerified} />;
      case 4:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 5:
        return (
          <TicketPlanStep
            isUserSignedIn={isUserSignedIn}
            onPlanConfirm={handleTicketPlanSelected}
            onCancel={handleCancel} // optional
          />
        );
      case 6:
        // If you want an extra step 6, put something here.
        // Otherwise, if skipping 6, your code might jump from 5 => 7
        return <p>Some extra step 6 here, if needed</p>;
      case 7:
        // Step 7 => finalizing => show spinner or error
        return (
          <div className="space-y-4 text-center">
            <p className="font-medium text-sm">Finalizing your booking...</p>
            {bookingError && (
              <div className="mt-2 text-sm text-destructive">{bookingError}</div>
            )}
            {bookingError && (
              <button
                onClick={() => {
                  dispatch(advanceBookingStep(5));
                  setBookingError(null);
                }}
                className="px-4 py-2 text-sm mt-2 bg-muted hover:bg-muted/80 text-foreground rounded"
              >
                Go Back &amp; Retry
              </button>
            )}
          </div>
        );
      case 8:
        // Step 8 => booking complete
        return <BookingCompleteStep />;
      default:
        return null;
    }
  };

  /* -------------- RENDER FOOTER BUTTONS -------------- */
  const renderFooterButtons = () => {
    switch (bookingStep) {
      case 1:
        // Step 1 => user picks date/time => we advance automatically
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
      case 5:
      case 6:
      case 7:
      case 8:
        // Steps after 2 are custom flows. Rely on sub-components or no standard button
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
