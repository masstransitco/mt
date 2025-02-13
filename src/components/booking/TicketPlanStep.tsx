// /src/components/booking/TicketPlanStep.tsx

"use client";

import React, { useState } from "react";
import SignInModal from "@/components/ui/SignInModal";

type PlanChoice = "single" | "paygo" | null;

interface TicketPlanStepProps {
  isUserSignedIn: boolean;
  onPlanConfirm: (plan: "single" | "paygo") => void;
  onCancel?: () => void; // optional
}

export default function TicketPlanStep({
  isUserSignedIn,
  onPlanConfirm,
  onCancel,
}: TicketPlanStepProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handleSelectSingleJourney = () => {
    setSelectedPlan("single");
  };
  const handleSelectPayAsYouGo = () => {
    setSelectedPlan("paygo");
  };

  const handleContinue = () => {
    if (!selectedPlan) return; // user must pick a plan

    if (!isUserSignedIn) {
      // open sign-in
      setShowSignInModal(true);
      return;
    }
    // If signed in, confirm the plan
    onPlanConfirm(selectedPlan);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-xl mb-2">Choose Your Plan</h3>

      {/* Option 1: Single Journey */}
      <button
        onClick={handleSelectSingleJourney}
        className={`w-full p-3 rounded-lg text-left
            ${selectedPlan === "single"
              ? "bg-neutral-700"
              : "bg-neutral-800 hover:bg-neutral-700"}
          `}
      >
        <div className="font-medium">Single Journey</div>
        <ul className="mt-1 text-sm list-disc ml-4">
          <li>Inclusive of tolls and fees</li>
          <li>No additional parking fees</li>
          <li>Fare: $XXX (placeholder)</li>
        </ul>
      </button>

      {/* Option 2: Pay-as-you-go */}
      <button
        onClick={handleSelectPayAsYouGo}
        className={`w-full p-3 rounded-lg text-left
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

      {selectedPlan && (
        <button
          onClick={handleContinue}
          className="w-full p-3 rounded-lg bg-blue-600
                     hover:bg-blue-500 text-white font-medium transition"
        >
          Continue
        </button>
      )}

      {/* optional Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-sm mt-2"
        >
          Cancel
        </button>
      )}

      {/* SignInModal if user not signed in */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </div>
  );
}
