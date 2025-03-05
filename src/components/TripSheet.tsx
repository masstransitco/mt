"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch } from "@/store/store";
import { advanceBookingStep } from "@/store/bookingSlice";
import { auth } from "@/lib/firebase";
import { chargeUserForTrip } from "@/lib/stripe";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * A persistent bottom sheet for the "trip in progress" (step 5).
 * The user pressed "Confirm Trip" => we charged $50 => 
 * Now they can "Unlock" => use it => "End Trip" => final charge.
 */
export default function TripSheet() {
  const dispatch = useAppDispatch();

  // Timer states
  const [tripActive, setTripActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // 1) Use number | null for intervalRef:
  const intervalRef = useRef<number | null>(null);

  // Start trip => unlock => begin counting
  const handleUnlock = () => {
    setTripActive(true);
    setElapsedSeconds(0);

    // 2) If intervalRef already running, clear it
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    // 3) increment every second
    intervalRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // End trip => charge the final usage
  const handleEndTrip = async () => {
    // 4) Clear interval if it exists
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTripActive(false);

    // Convert elapsedSeconds to minutes, rounding up
    const minutesUsed = Math.ceil(elapsedSeconds / 60);
    const additionalFare = minutesUsed * 100; // $1 per minute, in cents

    if (!auth.currentUser) {
      console.error("Cannot charge user; no currentUser");
      return;
    }

    try {
      // e.g. HK$1 per minute => pass in cents
      const result = await chargeUserForTrip(auth.currentUser.uid, additionalFare);
      if (!result?.success) {
        throw new Error(result?.error || "Failed final trip charge.");
      }
      // Optionally, toast.success(...) to confirm
      // Then move to step 6 or done
      dispatch(advanceBookingStep(6));
    } catch (err) {
      console.error("Error ending trip:", err);
      // Possibly show some UI error
    }
  };

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // We'll position this absolutely at the bottom
  // You can style it as a "sheet" as you prefer
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
            // If you want them to forcibly end the trip, you might disable this,
            // or do some confirm. For now, we let them close the sheet:
            // But we still keep the tripActive state if they close it.
            dispatch(advanceBookingStep(6)); // e.g. skip
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Timer & controls */}
      <div className="space-y-4">
        <div>
          {tripActive ? (
            <p>Elapsed: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s</p>
          ) : (
            <p>Vehicle is locked. Unlock to start the ride.</p>
          )}
        </div>

        {!tripActive ? (
          <Button onClick={handleUnlock} className="w-full">
            Unlock Vehicle
          </Button>
        ) : (
          <Button onClick={handleEndTrip} className="w-full">
            End Trip
          </Button>
        )}
      </div>
    </motion.div>
  );
}
