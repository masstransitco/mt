"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { selectIsSignedIn } from "@/store/userSlice"; // we rely on isSignedIn from Redux
import {
  selectBookingStep,
  advanceBookingStep,
  resetBookingFlow,
} from "@/store/bookingSlice";

// Our UI AlertDialog wrapper
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

// Steps
import TicketPlanStep from "./TicketPlanStep"; // Step 1
import PaymentStep from "./PaymentStep";       // Step 3
import IDVerificationStep from "./IDVerificationStep"; // Step 4
import SignInModal from "@/components/ui/SignInModal"; // We open this at Step 2

/** Example Step 5: unlock the car. If user not ID verified => step=4 first. */
function UnlockCarStep({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Unlock Car</h3>
      <p className="text-sm text-muted-foreground">
        You can now unlock the vehicle. If ID is required and not verified, go back to step 4.
      </p>
      <button
        className="px-4 py-2 text-sm font-medium bg-primary text-white rounded"
        onClick={onUnlock}
      >
        Unlock
      </button>
    </div>
  );
}

export default function BookingDialog() {
  const dispatch = useAppDispatch();
  const bookingStep = useAppSelector(selectBookingStep);
  const isSignedIn = useAppSelector(selectIsSignedIn);

  const [open, setOpen] = useState(false);

  // We use local state to show or hide the SignInModal in Step 2
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Example "ID Verified" status if you store it in Redux or local. 
  // We'll do local for demonstration. You can store it in Redux if you prefer.
  const [idVerified, setIdVerified] = useState(false);

  /** 
   * If your "Booking Flow" starts at step=1 
   * and you want this dialog to appear, 
   * you can watch bookingStep >= 1. 
   */
  useEffect(() => {
    if (bookingStep >= 1) {
      setOpen(true);
    }
  }, [bookingStep]);

  // Step transitions
  const handleCancel = () => {
    setOpen(false);
    // Also reset the booking flow
    dispatch(resetBookingFlow());
    // If you store ID verified, or car selection, etc., reset it here
    setIdVerified(false);
  };

  /* ---------------- Step 1: Ticket Plan ---------------- */
  const handlePlanSelected = (plan: "single" | "paygo") => {
    // Could store plan in Redux if you want
    // dispatch(setTicketPlan(plan));
    // Next => Step 2 (Sign-In)
    dispatch(advanceBookingStep(2));
  };

  /* 
    Step 2: If the user is already signed in, skip. 
    Otherwise, show the SignInModal. Once they sign in, step=3.
  */
  useEffect(() => {
    if (bookingStep === 2) {
      // Check sign-in
      if (isSignedIn) {
        // skip sign-in => step=3
        dispatch(advanceBookingStep(3));
      } else {
        // show sign-in modal
        setShowSignInModal(true);
      }
    }
  }, [bookingStep, isSignedIn, dispatch]);

  // Once user finishes sign-in, we close the modal & proceed to step=3
  const handleSignInComplete = () => {
    setShowSignInModal(false);
    dispatch(advanceBookingStep(3));
  };

  /* ---------------- Step 3: Payment ---------------- */
  const handlePaymentComplete = () => {
    // Next => Step 4 => ID Verification
    dispatch(advanceBookingStep(4));
  };

  /* ---------------- Step 4: ID Verification ---------------- */
  const handleIDVerified = () => {
    setIdVerified(true);
    // Next => step=5 => Unlock Car
    dispatch(advanceBookingStep(5));
  };
  const handleSkipID = () => {
    // If user wants to skip ID for now => step=5
    dispatch(advanceBookingStep(5));
  };

  /* ---------------- Step 5: Unlock Car ---------------- */
  const handleUnlockCar = () => {
    // If not verified => go back to step=4
    if (!idVerified) {
      dispatch(advanceBookingStep(4));
      return;
    }
    console.log("Car unlocked!");
    // Possibly close the booking
    setOpen(false);
    dispatch(resetBookingFlow());
  };

  // Render content per step
  const renderStepContent = () => {
    switch (bookingStep) {
      case 1:
        return (
          <TicketPlanStep
            isUserSignedIn={isSignedIn}
            onPlanConfirm={handlePlanSelected}
            onCancel={handleCancel}
          />
        );
      case 2:
        // Actually handled by signInModal. We'll just show a placeholder
        return (
          <div className="p-6 text-white">
            <p>Loading Sign-In Modal...</p>
          </div>
        );
      case 3:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 4:
        return (
          <IDVerificationStep onVerified={handleIDVerified} onSkip={handleSkipID} />
        );
      case 5:
        return <UnlockCarStep onUnlock={handleUnlockCar} />;
      default:
        return null;
    }
  };

  // Usually steps handle their own next/cancel, so we omit standard "action" buttons
  const renderFooterButtons = () => null;

  return (
    <>
      {/* The main booking flow dialog */}
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

      {/* Step 2: The SignInModal if user is not signed in */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          // If user is still not signed in after closing,
          // you might revert to step=1 or step=0
          if (!isSignedIn) {
            dispatch(resetBookingFlow());
            setOpen(false);
          }
        }}
      />
    </>
  );
}
