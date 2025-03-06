"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch } from "@/store/store";
import { advanceBookingStep } from "@/store/bookingSlice";
import { auth } from "@/lib/firebase";
import { chargeUserForTrip } from "@/lib/stripe";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Import our new press-and-hold unlock
import UnlockButton from "@/components/UnlockButton";

export default function TripSheet() {
  const dispatch = useAppDispatch();

  // Timer states
  const [tripActive, setTripActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Use number | null for intervalRef:
  const intervalRef = useRef<number | null>(null);

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

  // End trip => charge final usage
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
      dispatch(advanceBookingStep(6));
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

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.3 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white p-4 shadow-2xl
                 border-t border-gray-700 rounded-t-lg"
      style={{ minHeight: "200px" }}
    >
      {/* Title & optional close icon */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Trip in Progress</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={() => {
            // e.g. close the sheet
            dispatch(advanceBookingStep(6));
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          {tripActive ? (
            <p>
              Elapsed: {Math.floor(elapsedSeconds / 60)}m{" "}
              {elapsedSeconds % 60}s
            </p>
          ) : (
            <p>Vehicle is locked. Press &amp; hold to unlock.</p>
          )}
        </div>

        {!tripActive ? (
          /* Replace old button with the press-and-hold UnlockButton */
          <UnlockButton onUnlocked={handleUnlock} />
        ) : (
          <Button onClick={handleEndTrip} className="w-full">
            End Trip
          </Button>
        )}
      </div>
    </motion.div>
  );
}
