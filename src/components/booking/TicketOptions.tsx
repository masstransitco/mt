// src/components/booking/TicketOptions.tsx

"use client";

import React, { useState } from "react";
import SignInModal from "@/components/ui/SignInModal";  // <-- Updated import path

interface TicketOptionsProps {
  isUserSignedIn: boolean; // Are we signed in?
  onSelectSingleJourney: () => void;
  onSelectPayAsYouGo: () => void;
  onClose?: () => void;
  onProceed?: () => void; // Called if user is signed in & chooses a plan
}

export default function TicketOptions({
  isUserSignedIn,
  onSelectSingleJourney,
  onSelectPayAsYouGo,
  onClose,
  onProceed,
}: TicketOptionsProps) {
  const [showSignInModal, setShowSignInModal] = useState(false);

  // When user clicks an option
  const handleSelectSingleJourney = () => {
    onSelectSingleJourney();
    tryProceed();
  };

  const handleSelectPayAsYouGo = () => {
    onSelectPayAsYouGo();
    tryProceed();
  };

  // Check if user is signed in. If not, show signInModal. If yes, proceed.
  const tryProceed = () => {
    if (!isUserSignedIn) {
      setShowSignInModal(true);
    } else {
      // Already signed in => proceed to step 6
      onProceed?.();
    }
  };

  return (
    <>
      {/* Main Ticket Options UI */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <div className="w-full max-w-sm p-4 rounded-lg shadow-lg bg-neutral-900 text-neutral-100">
          <h2 className="text-lg font-semibold mb-4">Choose Your Plan</h2>

          {/* Option 1: Single Journey */}
          <button
            onClick={handleSelectSingleJourney}
            className="w-full p-4 mb-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-left"
          >
            <div className="font-medium">Single Journey</div>
            <ul className="mt-1 text-sm list-disc ml-4">
              <li>Inclusive of tolls and fees</li>
              <li>No additional parking fees</li>
              <li>
                Fare: <span className="font-semibold">$XXX</span> (placeholder)
              </li>
            </ul>
          </button>

          {/* Option 2: Pay-as-you-go */}
          <button
            onClick={handleSelectPayAsYouGo}
            className="w-full p-4 mb-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-left"
          >
            <div className="font-medium">Pay-as-you-go</div>
            <ul className="mt-1 text-sm list-disc ml-4">
              <li>$1 / min</li>
              <li>Max $600 / day</li>
            </ul>
          </button>

          {/* Optional close/cancel button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-full mt-3 p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* SignInModal if user is not signed in */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => {
          setShowSignInModal(false);
          // If user signed in successfully => onAuthStateChanged closes SignInModal => 
          // then your parent can check Redux isSignedIn, or you can
          // call onProceed automatically if you like.
        }}
      />
    </>
  );
}
