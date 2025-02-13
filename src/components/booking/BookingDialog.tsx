"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import {
  selectBookingStep,
  resetBookingFlow,
  // If you want to revert to step=4 on cancel:
  advanceBookingStep,
} from "@/store/bookingSlice";
import { selectIsSignedIn } from "@/store/userSlice";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Our 5 internal steps in this dialog
import TicketPlanStep from "./TicketPlanStep";   // Dialog step #1
import SignInModal from "@/components/ui/SignInModal"; // Shown in dialog step #2 if not signed in
import PaymentStep from "./PaymentStep";         // Dialog step #3
import IDVerificationStep from "./IDVerificationStep"; // Dialog step #4
import UnlockCarStep from "./UnlockCarStep";     // Dialog step #5

export default function BookingDialog() {
  const dispatch = useAppDispatch();

  // The Redux booking step
  const globalBookingStep = useAppSelector(selectBookingStep);
  // For sign-in checks
  const isSignedIn = useAppSelector(selectIsSignedIn);

  // Whether our dialog is open
  const [open, setOpen] = useState(false);

  // The *local* steps for the 5-step flow *inside* this dialog
  //  1 => TicketPlan
  //  2 => SignIn
  //  3 => Payment
  //  4 => ID Verification
  //  5 => Unlock
  const [dialogStep, setDialogStep] = useState(1);

  // Example: track ID verified
  const [idVerified, setIdVerified] = useState(false);

  /**
   * Whenever bookingSlice.step becomes 5,
   * we open this dialog and start from our local step=1.
   */
  useEffect(() => {
    if (globalBookingStep === 5) {
      setDialogStep(1);
      setOpen(true);
    } else {
      // If global step is not 5, ensure we close the dialog
      setOpen(false);
    }
  }, [globalBookingStep]);

  // If user clicks the "Cancel" button in the dialog:
  const handleCancel = () => {
    setOpen(false);
    // Option 1: reset the entire booking flow
    dispatch(resetBookingFlow());

    // Or Option 2: revert to step=4 if you want them to pick arrival again
    // dispatch(advanceBookingStep(4));

    setDialogStep(1);
    setIdVerified(false);
  };

  // Step #1 => user picks single vs paygo
  const handlePlanConfirm = (plan: "single" | "paygo") => {
    // e.g., store plan in Redux if needed
    // dispatch(setTicketPlan(plan));
    // Next => local step=2 => sign in
    setDialogStep(2);
  };

  // Step #2 => user sign-in
  // We'll open a SignInModal as part of the flow,
  // or skip if already signed in
  const [showSignInModal, setShowSignInModal] = useState(false);

  // If we are on step=2, check sign in
  useEffect(() => {
    if (dialogStep === 2) {
      if (isSignedIn) {
        // Already signed in => skip to step=3
        setDialogStep(3);
      } else {
        // show sign in modal
        setShowSignInModal(true);
      }
    } else {
      setShowSignInModal(false);
    }
  }, [dialogStep, isSignedIn]);

  // Called when user finishes sign-in
  const handleSignInComplete = () => {
    setShowSignInModal(false);
    // Proceed to step=3
    setDialogStep(3);
  };

  // Step #3 => Payment
  const handlePaymentComplete = () => {
    // Next => step=4 => ID
    setDialogStep(4);
  };

  // Step #4 => ID Verification
  const handleIDVerified = () => {
    setIdVerified(true);
    setDialogStep(5);
  };
  const handleSkipID = () => {
    setDialogStep(5);
  };

  // Step #5 => Unlock
  const handleUnlock = () => {
    if (!idVerified) {
      // If user isn't verified => back to step=4
      setDialogStep(4);
      return;
    }
    console.log("Car unlocked!");
    // Done => close the dialog
    setOpen(false);
    // If you want to reset the global slice or move to step=6, do so:
    // dispatch(advanceBookingStep(6));
  };

  // Render *local* step content
  const renderDialogContent = () => {
    switch (dialogStep) {
      case 1:
        return (
          <TicketPlanStep
            isUserSignedIn={isSignedIn}
            onPlanConfirm={handlePlanConfirm}
            onCancel={handleCancel}
          />
        );
      case 2:
        return (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Please sign in to continue.
            </p>
            <p className="text-sm">Loading Sign-In Modal...</p>
            {/* If user is already signed in, skip automatically */}
          </div>
        );
      case 3:
        return <PaymentStep onPaymentComplete={handlePaymentComplete} />;
      case 4:
        return (
          <IDVerificationStep onVerified={handleIDVerified} onSkip={handleSkipID} />
        );
      case 5:
        return <UnlockCarStep onUnlock={handleUnlock} />;
      default:
        return null;
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Booking Flow</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {renderDialogContent()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* The step=2 sign-in modal (only if dialogStep===2 and not signed in) */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          // If user closes sign in modal w/o signing in => step=1 or close entire dialog
          if (!isSignedIn) {
            // revert to step=1 or cancel
            setDialogStep(1);
          } else {
            handleSignInComplete();
          }
        }}
      />
    </>
  );
}
