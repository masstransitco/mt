// src/store/bookingThunks.ts

"use client";

import { createAsyncThunk } from "@reduxjs/toolkit";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { RootState } from "./store";
import { db } from "@/lib/firebase"; // your client-side Firestore import
import {
  setDepartureDate,
  advanceBookingStep,
  selectDepartureStation,
  selectArrivalStation,
  setTicketPlan,
  resetBookingFlow,
  BookingState,
} from "./bookingSlice";

/**
 * This result shape ensures we never "throw" from the thunk,
 * thus we won't cause a .reject in RTK if an error occurs.
 */
interface BookingThunkResult {
  success: boolean;
  message: string;
  step?: number; 
}

/**
 * saveBookingDetails:
 * - Reads from Redux store's booking state
 * - Persists it under `users/{uid}/booking: {...}` in Firestore
 * - Only actually saves data if user is in step 5 or explicitly resetting
 */
export const saveBookingDetails = createAsyncThunk<
  BookingThunkResult, // We now always return {success, message}
  void
>(
  "booking/saveBookingDetails",
  async (_, { getState, dispatch }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("[saveBookingDetails] User not signed in; cannot save booking details.");
        return {
          success: false,
          message: "User not signed in; cannot save booking details.",
        };
      }

      // The current booking data in Redux
      const { 
        step,
        departureDate,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        route,
      } = state.booking;

      // IMPORTANT: Only persist data if user is in step 5 (active booking) 
      // or if they're explicitly at step 1 (which means resetting)
      if (step !== 5 && step !== 1) {
        console.log(`[saveBookingDetails] Step=${step}, not persisting booking state (only steps 1 or 5 are saved)`);
        
        // For steps 2-4, clear any Firestore data to ensure consistent behavior
        if (step >= 2 && step <= 4) {
          console.log(`[saveBookingDetails] Clearing any Firestore data for step ${step}`);
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            await updateDoc(userDocRef, {
              booking: null,
            });
          }
          
          return { 
            success: true, 
            message: `Cleared Firestore data for step ${step} (steps 2-4 should not persist)` 
          };
        }
        
        return { success: true, message: "Skipped saving (not in step=5 or step=1)" };
      }

      // Convert the Date object to string (if present)
      const departureDateString = departureDate ? departureDate.toISOString() : null;

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // When resetting (step 1), clear the booking data entirely
      if (step === 1) {
        console.log(`[saveBookingDetails] Explicit reset (step=1), clearing booking data in Firestore`);
        
        if (userSnap.exists()) {
          await updateDoc(userDocRef, {
            booking: null,
          });
        }
        return { success: true, message: "Booking data cleared successfully" };
      }

      // Otherwise, build the object you want to store for step 5
      console.log(`[saveBookingDetails] Persisting step 5 data to Firestore`);
      
      const bookingData = {
        step,
        departureDate: departureDateString,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        // If you want to store route data as well, you can include it:
        route: route
          ? {
              distance: route.distance,
              duration: route.duration,
              polyline: route.polyline,
            }
          : null,
        // Add a timestamp for debugging/tracking purposes
        lastUpdated: new Date().toISOString()
      };

      if (userSnap.exists()) {
        // Update existing doc
        await updateDoc(userDocRef, {
          booking: bookingData,
        });
      } else {
        // Create a new doc
        await setDoc(userDocRef, {
          booking: bookingData,
        });
      }

      return { success: true, message: "Booking details saved successfully" };
    } catch (err) {
      console.error("[saveBookingDetails] Error saving booking details:", err);
      // Instead of `rejectWithValue`, we return a success=false shape
      return {
        success: false,
        message: "Failed to save booking details (thunk caught error).",
      };
    }
  }
);

/**
 * loadBookingDetails:
 * - Fetches booking data from `users/{uid}/booking`
 * - Rehydrates Redux ONLY if booking was in step 5
 * - For all other steps, explicitly resets to step 1
 */
export const loadBookingDetails = createAsyncThunk<
  BookingThunkResult,
  void
>(
  "booking/loadBookingDetails",
  async (_, { getState, dispatch }) => {
    try {
      // First, ensure a clean Redux state
      dispatch(resetBookingFlow());
      
      // Then, clear localStorage for safety
      if (typeof window !== 'undefined') {
        localStorage.removeItem('persist:booking');
        console.log("[loadBookingDetails] Cleared localStorage booking data for clean start");
      }
      
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("[loadBookingDetails] User not signed in; cannot load booking details.");
        return {
          success: false,
          message: "User not signed in; cannot load booking details.",
        };
      }

      console.log("[loadBookingDetails] Loading booking details for user:", user.uid);

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        console.log("[loadBookingDetails] No user document found, ensuring clean state");
        
        // Ensure we reset to step 1 when no data exists
        dispatch(resetBookingFlow());
        
        return { success: false, message: "No user document found" };
      }

      const data = userSnap.data();
      const booking = data.booking as Partial<BookingState> | undefined;
      
      if (!booking) {
        console.log("[loadBookingDetails] No booking data found in user document, ensuring clean state");
        
        // Ensure we reset to step 1 when no booking data exists
        dispatch(resetBookingFlow());
        
        return { success: false, message: "No booking data found" };
      }

      console.log("[loadBookingDetails] Found booking data:", booking);

      // ONLY restore state if the saved booking was at step 5
      if (booking.step === 5) {
        console.log("[loadBookingDetails] Restoring step 5 booking...");
        
        // Only rehydrate if we found booking data for step 5
        if (booking.departureDate) {
          dispatch(setDepartureDate(new Date(booking.departureDate)));
        }

        if (booking.ticketPlan) {
          dispatch(setTicketPlan(booking.ticketPlan));
        }

        if (booking.departureStationId) {
          dispatch(selectDepartureStation(booking.departureStationId));
        }

        if (booking.arrivalStationId) {
          dispatch(selectArrivalStation(booking.arrivalStationId));
        }

        // step - do this last so UI updates properly
        dispatch(advanceBookingStep(5));
        
        return { 
          success: true, 
          message: "Step 5 booking details loaded successfully",
          step: 5
        };
      } else {
        // For all other steps, explicitly reset everything
        console.log(`[loadBookingDetails] Found booking in step ${booking.step}, explicitly resetting to step 1`);
        
        dispatch(resetBookingFlow());
        
        // Clear any Firestore booking data for non-step 5
        await updateDoc(userDocRef, {
          booking: null,
        });
        
        return { 
          success: false, 
          message: `Booking not in step=5 (found step=${booking.step}), reset to step 1`,
          step: 1
        };
      }
    } catch (err) {
      console.error("[loadBookingDetails] Error loading booking details:", err);
      
      // On error, also reset to step 1 for safety
      dispatch(resetBookingFlow());
      
      return {
        success: false,
        message: "Failed to load booking details (thunk caught error).",
      };
    }
  }
);
