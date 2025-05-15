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
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        route,
        isQrScanStation,
        qrVirtualStationId,
      } = state.booking;

      // Get the CURRENT step from Redux (it might have changed since this thunk was dispatched)
      const currentStep = state.booking.step;

      // IMPORTANT: Only persist data if user is in step 5 (active booking) 
      // or if they're explicitly at step 1 (which means resetting)
      if (currentStep !== 5 && currentStep !== 1) {
        console.log(`[saveBookingDetails] CurrentStep=${currentStep}, not persisting booking state (only steps 1 or 5 are saved)`);
        
        // For steps 2-4, clear any Firestore data to ensure consistent behavior
        if (currentStep >= 2 && currentStep <= 4) {
          console.log(`[saveBookingDetails] Clearing any Firestore data for step ${currentStep}`);
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            await updateDoc(userDocRef, {
              booking: null,
            });
          }
          
          return { 
            success: true, 
            message: `Cleared Firestore data for step ${currentStep} (steps 2-4 should not persist)` 
          };
        }
        
        return { success: true, message: `Skipped saving (not in step=5 or step=1, current step is ${currentStep})` };
      }

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // When resetting (step 1), clear the booking data entirely
      if (currentStep === 1) {
        console.log(`[saveBookingDetails] Explicit reset (step=1), clearing booking data in Firestore`);
        
        if (userSnap.exists()) {
          await updateDoc(userDocRef, {
            booking: null,
          });
        }
        return { success: true, message: "Booking data cleared successfully" };
      }

      // Otherwise, build the object you want to store for step 5
      console.log(`[saveBookingDetails] Persisting step ${currentStep} data to Firestore`);
      
      const bookingData = {
        step: currentStep, // Use the current step from state, not the original step
        departureDateString,
        departureTimeString,
        isDateTimeConfirmed,
        ticketPlan,
        departureStationId,
        arrivalStationId,
        isQrScanStation,
        qrVirtualStationId,
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
      // Don't reset state or clear localStorage yet - do this only after 
      // we've checked if there's valid step 5 data in Firestore
      
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
        console.log("[loadBookingDetails] No user document found");
        
        // Get the current step from Redux state
        const currentBookingStep = getState().booking.step;
        
        // Only reset if we're NOT already in step 5
        if (currentBookingStep !== 5) {
          console.log("[loadBookingDetails] Not at step 5, resetting state");
          dispatch(resetBookingFlow());
        } else {
          console.log("[loadBookingDetails] Already at step 5, preserving state");
        }
        
        return { success: false, message: "No user document found" };
      }

      const data = userSnap.data();
      const booking = data.booking as Partial<BookingState> | undefined;
      
      if (!booking) {
        console.log("[loadBookingDetails] No booking data found in user document");
        
        // Get the current step from Redux state
        const currentBookingStep = getState().booking.step;
        
        // Only reset if we're NOT already in step 5
        if (currentBookingStep !== 5) {
          console.log("[loadBookingDetails] Not at step 5, resetting state");
          dispatch(resetBookingFlow());
        } else {
          console.log("[loadBookingDetails] Already at step 5, preserving state");
        }
        
        return { success: false, message: "No booking data found" };
      }

      console.log("[loadBookingDetails] Found booking data:", booking);

      // Get the current step from Redux state
      const currentBookingStep = getState().booking.step;
      
      // ONLY restore state if the saved booking was at step 5
      if (booking.step === 5) {
        console.log("[loadBookingDetails] Found step 5 booking in Firestore");
        
        // If we're already at step 5 in Redux, we don't need to do anything
        if (currentBookingStep === 5) {
          console.log("[loadBookingDetails] Already at step 5 in Redux, preserving state");
          return { 
            success: true, 
            message: "Already at step 5, preserving state",
            step: 5
          };
        }
        
        console.log("[loadBookingDetails] Restoring step 5 booking from Firestore...");
        
        // For step 5, don't clear localStorage! Let Redux-persist merge with Firestore data
        
        // Only rehydrate if we found booking data for step 5
        if (booking.departureDateString) {
          // Use the string directly, no need to convert to Date and back
          dispatch(setDepartureDate(booking.departureDateString));
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
        // Firestore booking is not at step 5
        console.log(`[loadBookingDetails] Found booking in step ${booking.step} in Firestore, not step 5`);
        
        // If Redux is already at step 5, preserve that state instead of the Firestore version
        if (currentBookingStep === 5) {
          console.log("[loadBookingDetails] Already at step 5 in Redux, preserving Redux state over Firestore");
          
          // Update Firestore to match Redux state
          await updateDoc(userDocRef, {
            booking: {
              step: 5,
              // Other booking fields would be here
              lastUpdated: new Date().toISOString()
            },
          });
          
          return { 
            success: true, 
            message: "Preserved Redux step 5 state over Firestore non-step 5 state",
            step: 5
          };
        }
        
        // Both Redux and Firestore are not at step 5, explicitly reset everything
        console.log(`[loadBookingDetails] Neither Redux nor Firestore at step 5, resetting to step 1`);
        
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
      
      // Get the current step from Redux state
      const currentBookingStep = getState().booking.step;
      
      // If we're already at step 5, preserve that state despite the error
      if (currentBookingStep === 5) {
        console.log("[loadBookingDetails] Already at step 5 in Redux, preserving state despite error");
        return {
          success: true,
          message: "Error loading from Firestore, but preserved step 5 state",
          step: 5
        };
      }
      
      // Otherwise reset to step 1 for safety
      dispatch(resetBookingFlow());
      
      return {
        success: false,
        message: "Failed to load booking details (thunk caught error).",
      };
    }
  }
);
