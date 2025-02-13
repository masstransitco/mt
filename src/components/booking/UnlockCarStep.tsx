// src/components/booking/UnlockCarStep.tsx
"use client";

import React from "react";

interface UnlockCarStepProps {
  onUnlock: () => void;
}

export default function UnlockCarStep({ onUnlock }: UnlockCarStepProps) {
  const handleUnlock = () => {
    // Placeholder logic
    console.log("Unlocking car...");
    onUnlock();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-medium">Unlock Car</h3>
      <p className="text-sm text-muted-foreground">
        Placeholder for final unlocking logic.
      </p>
      <button
        onClick={handleUnlock}
        className="px-4 py-2 text-sm font-medium bg-primary text-white rounded"
      >
        Unlock
      </button>
    </div>
  );
}
