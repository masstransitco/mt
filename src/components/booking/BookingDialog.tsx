"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";

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
  selectIsSignedIn,
  resetUserSelections,
} from "@/store/userSlice";

// bookingSlice
import {
  selectBookingStep,
  advanceBookingStep,
  resetBookingFlow,
} from "@/store/bookingSlice";

// Steps
import TicketPlanStep from "./TicketPlanStep";
import SignInStep from "./SignInStep";
import PaymentStep from "./PaymentStep";
import IDVerificationStep from "./IDVerificationStep";

/** 
 * If you need a final "unlock" step that checks ID verification, 
 * you can store a boolean like "idVerified" in Redux, or do a separate check.
 */
function UnlockCarStep({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Unlock Car</h3>
      <p className="text-sm text-muted-foreground">
        You are ready to unlock the vehicle. Make sure you have your ID verified.
      </p>
      <button
        className="bg-primary text-white px-4 py-2 rounded"
        onClick={onUnlock}
      >
        Unlock Now
      </button>
    </div>
  );
}

export default function BookingDialog() {
  const dispatch = useAppDispatch();

  // Example booking steps (1..5)
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);

  // Whether to show the AlertDialog
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // If you want to open the dialog as soon as user enters step=1 or more:
    if (bookingStep >= 1) {
      setOpen(true);
    }
  }, [bookingStep]);

  const handleCancel = () => {
    setOpen(false);
    // Reset all
    dispatch(resetUserSelections());
    dispatch(resetBookingFlow());
  };

  /* ---------------- Step 1: Ticket Plan ---------------- */
  const handleTicketPlanSelected = (plan: "single" | "paygo") => {
    // You can store plan in Redux if needed
    // dispatch(setTicketPlan(plan));
    // Next step => step=2 => sign in check
    dispatch(advanceBookingStep(2));
  };

  /* ---------------- Step 2: Sign In if not signed in ---------------- */
  const handleSignInComplete = () => {
    // If user was not signed in, they sign in here => step=3
    dispatch(advanceBookingStep(3));
  };

  /* 
    Possibly skip sign-in if user is already signed in. 
    That could happen automatically if bookingStep=2 and isSignedIn => step=3
  */
  useEffect(() => {
    if (bookingStep === 2 && isSignedIn) {
      dispatch(advanceBookingStep(3));
    }
  }, [bookingStep, isSignedIn, dispatch]);

  /* ---------------- Step 3: Payment ---------------- */
  const handlePaymentComplete = () => {
    dispatch(advanceBookingStep(4));
  };

  /* ---------------- Step 4: ID Verification (optional) ---------------- */
  const handleIDVerificationDone = () => {
    // If user verified ID
    dispatch(advanceBookingStep(5));
  };

  const handleSkipID = () => {
    // If user wants to skip for now
    dispatch(advanceBookingStep(5));
  };

  /* ---------------- Step 5: Unlock Car ---------------- */
  const handleUnlockCar = () => {
    // Check if ID is verified, else go back to step=4
    // if (!idVerified) {
    //   dispatch(advanceBookingStep(4));
    //   return;
    // }

    // Otherwise, do the unlock logic
    console.log("Car unlocked!");
    // Possibly close the dialog or final step
    setOpen(false);
    dispatch(resetBookingFlow());
    dispatch(resetUserSelections());
  };

  const renderStepContent = () => {
    switch (bookingStep) {
      case 1:
        return (
          <TicketPlanStep
            // If user is not signed in, sign in eventually
            isUserSignedIn={isSignedIn}
            onPlanConfirm={handleTicketPlanSelected}
            onCancel={handleCancel}
          />
        );
      case 2:
        return (
          <SignInStep
            // Once user signs in => handleSignInComplete
            onSignInComplete={handleSignInComplete}
            onCancel={handleCancel}
          />
        );
      case 3:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 4:
        return (
          <IDVerificationStep
            onVerified={handleIDVerificationDone}
            onSkip={handleSkipID}
          />
        );
      case 5:
        return <UnlockCarStep onUnlock={handleUnlockCar} />;
      default:
        return null;
    }
  };

  // Typically, each step uses internal logic or a sub-component with 
  // its own confirm/cancel buttons. So we won't provide footer buttons here:
  const renderFooterButtons = () => null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Booking Flow</AlertDialogTitle>
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
