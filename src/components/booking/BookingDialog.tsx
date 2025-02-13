"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { format } from "date-fns";

// UI: AlertDialog
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

// userSlice
import {
  resetUserSelections,
  selectDepartureStationId,
  selectArrivalStationId,
  selectIsSignedIn,
} from "@/store/userSlice";

// bookingSlice
import {
  advanceBookingStep,
  selectBookingStep,
  selectDepartureDate,
  resetBookingFlow,
  setDepartureDate,
} from "@/store/bookingSlice";

// Example steps
import IDVerificationStep from "./IDVerificationStep";
import PaymentStep from "./PaymentStep";
import TicketPlanStep from "./TicketPlanStep"; // Your new ticket plan UI

/** Optional final step: displays a success or summary screen. */
function BookingCompleteStep() {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Booking Complete</h3>
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

  // Check if the user is signed in from Redux
  const isUserSignedIn = useAppSelector(selectIsSignedIn);

  // Local state to control the AlertDialog's open/close
  const [open, setOpen] = useState(false);

  // Local error message for finalizing (step=7)
  const [bookingError, setBookingError] = useState<string | null>(null);

  /**
   * Only open the dialog if:
   *  - A car is selected
   *  - We have departureStationId and arrivalStationId
   *  - The user has advanced to at least step=5 (Confirmed Arrival)
   */
  useEffect(() => {
    if (
      selectedCarId &&
      departureStationId &&
      arrivalStationId &&
      bookingStep >= 5
    ) {
      setOpen(true);
    }
  }, [selectedCarId, departureStationId, arrivalStationId, bookingStep]);

  /**
   * If user clicks Cancel or closes the dialog,
   * we reset everything in the booking + user selections.
   */
  const handleCancel = () => {
    setOpen(false);
    dispatch(resetUserSelections());
    dispatch(resetBookingFlow());
  };

  /* ---------------- STEP 1: User picks a date/time ---------------- */
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    dispatch(setDepartureDate(newDate));
    dispatch(advanceBookingStep(2));
  };

  /* ---------------- STEP 2: Confirm booking details --------------- */
  const handleConfirmBookingDetails = () => {
    dispatch(advanceBookingStep(3)); // move to ID verification
  };

  /* ---------------- STEP 3: ID Verification ------------------------ */
  const handleIDVerified = () => {
    dispatch(advanceBookingStep(4)); // move to payment
  };

  /* ---------------- STEP 4: Payment -------------------------------- */
  const handlePaymentComplete = () => {
    // After payment, proceed to ticket plan
    dispatch(advanceBookingStep(5));
  };

  /* ---------------- STEP 5: Ticket Plan Selection ------------------ */
  const handleTicketPlanSelected = (plan: "single" | "paygo") => {
    // Optionally store plan in Redux (setTicketPlan(plan))
    // Then skip step 6 (if not used) and finalize in step 7
    dispatch(advanceBookingStep(7));
  };

  /* ---------------- STEP 7: Finalize booking => call API ---------- */
  useEffect(() => {
    if (bookingStep === 7) {
      setBookingError(null);

      const bookingPayload = {
        carId: selectedCarId,
        departureStationId,
        arrivalStationId,
        departureDate,
        // plan: ticketPlan (if you store it in Redux)
      };

      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingPayload),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Booking created:", data);
          // success => step=8 => booking complete
          dispatch(advanceBookingStep(8));
        })
        .catch((err) => {
          console.error("Booking creation error:", err);
          setBookingError("Failed to finalize booking. Please try again.");
          // Optionally fallback to step=5 or step=4
          // dispatch(advanceBookingStep(5));
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

  /**
   * Renders the step-specific content.
   * Steps: 
   *   1 => pick date
   *   2 => confirm details
   *   3 => ID verification
   *   4 => payment
   *   5 => ticket plan
   *   6 => (optional)
   *   7 => finalizing
   *   8 => complete
   */
  const renderStepContent = () => {
    switch (bookingStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Select Departure Time</h3>
            <input
              type="datetime-local"
              onChange={handleDateSelect}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              className="w-full p-2 rounded border border-border
                         bg-background text-foreground"
            />
          </div>
        );
      case 2:
        if (!departureDate) return null;
        return (
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Confirm Booking Details</h3>
            <div className="p-4 space-y-2 bg-accent/10 rounded">
              <p>Vehicle: Car #{selectedCarId}</p>
              <p>Departure Station: #{departureStationId}</p>
              <p>Arrival Station: #{arrivalStationId}</p>
              <p>Departure: {format(departureDate, "PPpp")}</p>
            </div>
          </div>
        );
      case 3:
        return <IDVerificationStep onVerified={handleIDVerified} />;
      case 4:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 5:
        // Show the ticket plan choice (single vs paygo)
        return (
          <TicketPlanStep
            isUserSignedIn={isUserSignedIn}
            onPlanConfirm={handleTicketPlanSelected}
            onCancel={handleCancel} // optional
          />
        );
      case 6:
        // If you want an extra step, place it here
        return <p>Step 6 (placeholder)</p>;
      case 7:
        // Finalizing => show spinner or error
        return (
          <div className="text-center space-y-4">
            <p className="font-medium">Finalizing your booking...</p>
            {bookingError && (
              <div className="text-destructive text-sm">{bookingError}</div>
            )}
            {bookingError && (
              <button
                onClick={() => {
                  // Optionally revert to step 5 for ticket plan or step 4 for payment
                  dispatch(advanceBookingStep(5));
                  setBookingError(null);
                }}
                className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded"
              >
                Go Back &amp; Retry
              </button>
            )}
          </div>
        );
      case 8:
        // Booking complete
        return <BookingCompleteStep />;
      default:
        return null;
    }
  };

  /** Renders the footer’s (Cancel / Confirm) buttons per step */
  const renderFooterButtons = () => {
    switch (bookingStep) {
      case 1:
        // Step 1 => user picks date/time => we auto-advance after selection
        return null;
      case 2:
        // Step 2 => confirm booking details
        return (
          <AlertDialogAction
            onClick={handleConfirmBookingDetails}
            className="bg-primary hover:bg-primary/90"
          >
            Confirm Details
          </AlertDialogAction>
        );
      // Steps 3-8 use internal flows or no standard "action" button
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
          {/* Cancel button => resets everything */}
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          {renderFooterButtons()}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
