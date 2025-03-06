"use client";

import React from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VerificationStateProps {
  idApproved: boolean;
  dlApproved: boolean;
  addressApproved: boolean;
  /**
   * A callback invoked when the user presses the "Update Documents" button.
   * The parent can open `LicenseModal` or any relevant modal here.
   */
  onUpdateDocuments: () => void;
}

/**
 * Renders a summary of the user's verification status:
 * ID doc, Driving License, and Address.
 * If any are not approved, shows a warning or instructions,
 * plus an "Update Documents" button to open LicenseModal.
 */
export default function VerificationState({
  idApproved,
  dlApproved,
  addressApproved,
  onUpdateDocuments,
}: VerificationStateProps) {
  // We can build a small helper for an item row
  const VerificationRow = ({
    label,
    approved,
  }: {
    label: string;
    approved: boolean;
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {approved ? (
        <CheckCircle className="w-4 h-4 text-green-400" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
      )}
      <span>
        {label}:{" "}
        <span className={approved ? "text-green-300" : "text-yellow-300"}>
          {approved ? "Approved" : "Pending"}
        </span>
      </span>
    </div>
  );

  const allApproved = idApproved && dlApproved && addressApproved;

  return (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-3 text-sm text-gray-200">
      <h3 className="text-base font-semibold mb-2 text-white">Verification Required</h3>

      <VerificationRow label="ID Document" approved={idApproved} />
      <VerificationRow label="Driving License" approved={dlApproved} />
      <VerificationRow label="Address" approved={addressApproved} />

      {!allApproved && (
        <div className="mt-3 text-sm text-gray-300 space-y-2">
          <p>
            Please complete all required verifications before you can unlock the vehicle.
          </p>
          <p>Contact support or visit your profile to upload missing documents.</p>

          {/* The "Update Documents" button to open LicenseModal, etc. */}
          <Button
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white w-full"
            onClick={onUpdateDocuments}
          >
            Update Documents
          </Button>
        </div>
      )}
    </div>
  );
}
