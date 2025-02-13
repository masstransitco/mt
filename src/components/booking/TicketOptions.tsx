"use client";

import React from "react";

interface TicketOptionsProps {
  onSelectSingleJourney: () => void;
  onSelectPayAsYouGo: () => void;
  onClose?: () => void;
}

export default function TicketOptions({
  onSelectSingleJourney,
  onSelectPayAsYouGo,
  onClose,
}: TicketOptionsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm p-4 rounded-lg shadow-lg bg-neutral-900 text-neutral-100">
        <h2 className="text-lg font-semibold mb-4">Choose Your Plan</h2>

        {/* Option 1: Single Journey */}
        <button
          onClick={onSelectSingleJourney}
          className="w-full p-4 mb-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-left"
        >
          <div className="font-medium">Single Journey</div>
          <ul className="mt-1 text-sm list-disc ml-4">
            <li>Inclusive of tolls and fees</li>
            <li>No additional parking fees</li>
            <li>Fare: <span className="font-semibold">$XXX</span> (placeholder)</li>
          </ul>
        </button>

        {/* Option 2: Pay-as-you-go */}
        <button
          onClick={onSelectPayAsYouGo}
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
  );
}
