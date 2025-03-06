"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { advanceBookingStep, resetBookingFlow } from "@/store/bookingSlice";
import { auth } from "@/lib/firebase";
import { fetchVerificationData } from "@/store/verificationSlice";
import { chargeUserForTrip } from "@/lib/stripe";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Press-and-hold unlock
import UnlockButton from "@/components/UnlockButton";
// The new verification UI
import VerificationState from "@/components/VerificationState";
// LicenseModal (or any doc-update modal the user wants to open)
import LicenseModal from "@/components/ui/LicenseModal";

// Types from your verification slice
import { DocumentStatus, VerificationData } from "@/store/verificationSlice";

// Helper to check "approved" - Fixed to check both status AND verified property
function isApproved(doc: DocumentStatus | undefined): boolean {
  return doc?.status === "approved" || doc?.verified === true;
}

export default function TripSheet() {
  const dispatch = useAppDispatch();

  // For usage timer
  const [tripActive, setTripActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // State to control opening the "Update Documents" modal
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);

  // Fetch verification data when component mounts
  useEffect(() => {
    if (auth.currentUser) {
      dispatch(fetchVerificationData(auth.currentUser.uid));
    }
  }, [dispatch]);

  // Grab user's verification data from the store
  const verificationData: VerificationData = useAppSelector((state) => {
    if (!auth.currentUser) return {};
    const uid = auth.currentUser.uid;
    return state.verification[uid] || {};
  });

  // Debug logging
  useEffect(() => {
    if (verificationData.idDocument || verificationData.drivingLicense || verificationData.address) {
      console.log("Verification data:", verificationData);
    }
  }, [verificationData]);

  // Check if ID doc, driving license, and address are all approved
  const idApproved = isApproved(verificationData.idDocument);
  const dlApproved = isApproved(verificationData.drivingLicense);
  // For address, check both the status and verified flag
  const addressApproved = verificationData.address?.status === "approved" || 
                          verificationData.address?.verified === true;
                          
  const fullyVerified = idApproved && dlApproved && addressApproved;

  // "Unlock" => start counting usage
  const handleUnlock = () => {
    setTripActive(true);
    setElapsedSeconds(0);

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // End trip => charge final usage and RESET booking flow to step 1
  const handleEndTrip = async () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTripActive(false);

    // Convert elapsedSeconds to minutes, rounding up
    const minutesUsed = Math.ceil(elapsedSeconds / 60);
    const additionalFare = minutesUsed * 100; // $1/min in cents

    if (!auth.currentUser) {
      console.error("Cannot charge user; no currentUser");
      return;
    }

    try {
      const result = await chargeUserForTrip(auth.currentUser.uid, additionalFare);
      if (!result?.success) {
        throw new Error(result?.error || "Failed final trip charge.");
      }
      
      // RESET the entire booking flow (back to step 1) instead of just advancing to step 6
      dispatch(resetBookingFlow());
      
    } catch (err) {
      console.error("Error ending trip:", err);
      // Possibly show an error UI
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Skip this - TripSheet is no longer dismissable in step 5
  // const handleClose = () => {
  //   dispatch(advanceBookingStep(6));
  // };

  // Called when user presses "Update Documents" in VerificationState
  const handleUpdateDocuments = () => {
    setLicenseModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white p-4 shadow-2xl
                  border-t border-gray-700 rounded-t-lg"
        style={{ minHeight: "220px" }}
      >
        {/* Title without close button since it's no longer dismissable */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Trip in Progress</h2>
          {/* Removed the close button */}
        </div>

        {/* If user is NOT fully verified => show verification UI w/ "Update Documents" button */}
        {!fullyVerified ? (
          <VerificationState
            idApproved={idApproved}
            dlApproved={dlApproved}
            addressApproved={addressApproved}
            onUpdateDocuments={handleUpdateDocuments}
          />
        ) : (
          // If fully verified => normal unlock flow
          <div className="space-y-4">
            <div>
              {tripActive ? (
                <p className="text-center text-lg font-medium">
                  Elapsed: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
                </p>
              ) : (
                <p className="text-center mb-4">Vehicle is locked. Press &amp; hold to unlock.</p>
              )}
            </div>

            {!tripActive ? (
              <div className="w-full aspect-[4/1] flex items-center justify-center">
                <UnlockButton onUnlocked={handleUnlock} className="w-full h-full" />
              </div>
            ) : (
              <Button onClick={handleEndTrip} className="w-full py-6 text-lg">
                End Trip
              </Button>
            )}
          </div>
        )}
      </motion.div>

      {/* The modal to update docs (LicenseModal or your doc manager) */}
      <LicenseModal
        isOpen={licenseModalOpen}
        onClose={() => setLicenseModalOpen(false)}
      />
    </>
  );
}
