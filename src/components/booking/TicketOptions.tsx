"use client";

import React from "react";
import { cn } from "@/lib/utils"; // or your own utility for combining classes

interface TicketOptionsProps {
  /** Called when user chooses Single Journey */
  onSelectSingleJourney: () => void;
  /** Called when user chooses Pay as You Go */
  onSelectPayAsYouGo: () => void;
  /** If you want to close or skip, e.g. a “Cancel” button */
  onClose?: () => void;
}

/**
 * A modal overlay that shows two payment plan boxes.
 * Display it only when step === 5.
 */
export default function TicketOptions({
  onSelectSingleJourney,
  onSelectPayAsYouGo,
  onClose,
}: TicketOptionsProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/70 backdrop-blur-sm px-4"
      )}
    >
      {/* Modal content container */}
      <div
        className={cn(
          "w-full max-w-sm rounded-lg shadow-lg p-4",
          "bg-neutral-900 text-neutral-100" // Dark theme palette
        )}
      >
        <h2 className="text-lg font-semibold mb-4">Choose Your Plan</h2>

        {/* Option 1: Single Journey */}
        <button
          onClick={onSelectSingleJourney}
          className={cn(
            "w-full p-4 mb-3 rounded-lg text-left transition-colors",
            "bg-neutral-800 hover:bg-neutral-700"
          )}
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
          className={cn(
            "w-full p-4 mb-3 rounded-lg text-left transition-colors",
            "bg-neutral-800 hover:bg-neutral-700"
          )}
        >
          <div className="font-medium">Pay-as-you-go</div>
          <ul className="mt-1 text-sm list-disc ml-4">
            <li>$1 / min</li>
            <li>Max $600 / day</li>
          </ul>
        </button>

        {/* Optional "close" or "cancel" button */}
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
