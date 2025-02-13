// src/components/booking/TicketOptions.tsx

"use client";

import React, { useState } from "react";
import SignInModal from "@/components/ui/SignInModal";

interface TicketOptionsProps {
  isUserSignedIn: boolean; // Are we signed in?
  onSelectSingleJourney: () => void;
  onSelectPayAsYouGo: () => void;
  onClose?: () => void;
  onProceed?: () => void; // Called if user is signed in & wants to finalize
}

/** Possible plans */
type PlanChoice = "single" | "paygo" | null;

export default function TicketOptions({
  isUserSignedIn,
  onSelectSingleJourney,
  onSelectPayAsYouGo,
  onClose,
  onProceed,
}: TicketOptionsProps) {
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(null);

  const handleSelectSingleJourney = () => {
    onSelectSingleJourney();
    setSelectedPlan("single");
  };

  const handleSelectPayAsYouGo = () => {
    onSelectPayAsYouGo();
    setSelectedPlan("paygo");
  };

  /** Called when user presses "Continue" after plan selection */
  const handleContinue = () => {
    if (!selectedPlan) return; // no plan selected => do nothing

    if (!isUserSignedIn) {
      // Show sign-in first
      setShowSignInModal(true);
    } else {
      // Already signed in => proceed
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
            className={`w-full p-4 mb-3 rounded-lg text-left
              ${selectedPlan === "single"
                ? "bg-neutral-700"
                : "bg-neutral-800 hover:bg-neutral-700"}
            `}
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
            className={`w-full p-4 mb-3 rounded-lg text-left
              ${selectedPlan === "paygo"
                ? "bg-neutral-700"
                : "bg-neutral-800 hover:bg-neutral-700"}
            `}
          >
            <div className="font-medium">Pay-as-you-go</div>
            <ul className="mt-1 text-sm list-disc ml-4">
              <li>$1 / min</li>
              <li>Max $600 / day</li>
            </ul>
          </button>

          {/* "Continue" button is visible once a plan is selected */}
          {selectedPlan && (
            <button
              onClick={handleContinue}
              className="w-full mb-3 p-3 rounded-lg bg-blue-600
                         hover:bg-blue-500 text-white font-medium transition"
            >
              Continue
            </button>
          )}

          {/* Optional close/cancel button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-full p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm"
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
          // If user signed in successfully => onAuthStateChanged closes SignInModal
          // Then your parent (GMap, etc.) can check Redux isSignedIn,
          // you can also automatically call onProceed?.() if you want
          // once you detect Redux changed to isSignedIn = true.
        }}
      />
    </>
  );
}
