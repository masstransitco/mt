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
 * saveBookingDetails:
 * - Reads from Redux store's booking state
 * - Persists it under `users/{uid}/booking: {...}` in Firestore
 * - Only actually saves data if user is in step 5 or explicitly resetting
 */
export const saveBookingDetails = createAsyncThunk(
  "booking/saveBookingDetails",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("User not signed in; cannot save booking details.");
        return rejectWithValue("User not signed in; cannot save booking details.");
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

      // Only persist data if user is in step 5 (active booking) 
      // or if they're at step 1 (which means they just reset - clear data)
      if (step !== 5 && step !== 1) {
        console.log(`User in step ${step}, not persisting booking state`);
        return { success: true, message: "Skipped saving (not in step 5)" };
      }

      // Convert the Date object to string (if present)
      const departureDateString = departureDate ? departureDate.toISOString() : null;

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // When resetting (step 1), clear the booking data entirely
      if (step === 1) {
        if (userSnap.exists()) {
          await updateDoc(userDocRef, {
            booking: null,
          });
        }
        return { success: true, message: "Booking data cleared successfully" };
      }

      // Otherwise, build the object you want to store for step 5
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
      console.error("Error saving booking details:", err);
      return rejectWithValue("Failed to save booking details.");
    }
  }
);

/**
 * loadBookingDetails:
 * - Fetches booking data from `users/{uid}/booking`
 * - Rehydrates Redux ONLY if booking was in step 5
 */
export const loadBookingDetails = createAsyncThunk(
  "booking/loadBookingDetails",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        console.warn("User not signed in; cannot load booking details.");
        return rejectWithValue("User not signed in; cannot load booking details.");
      }

      console.log("Loading booking details for user:", user.uid);

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (!userSnap.exists()) {
        console.log("No user document found");
        return { success: false, message: "No user document found" };
      }

      const data = userSnap.data();
      const booking = data.booking as Partial<BookingState> | undefined;
      
      if (!booking) {
        console.log("No booking data found in user document");
        return { success: false, message: "No booking data found" };
      }

      console.log("Found booking data:", booking);

      // ONLY restore state if the saved booking was at step 5
      if (booking.step === 5) {
        console.log("Restoring step 5 booking...");
        
        // Only rehydrate if we found booking data for step 5
        // departureDate
        if (booking.departureDate) {
          dispatch(setDepartureDate(new Date(booking.departureDate)));
        }

        // ticketPlan
        if (booking.ticketPlan) {
          dispatch(setTicketPlan(booking.ticketPlan));
        }

        // departureStationId
        if (booking.departureStationId) {
          dispatch(selectDepartureStation(booking.departureStationId));
        }

        // arrivalStationId
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
        // For all other steps, don't restore anything
        console.log(`Found booking in step ${booking.step}, not restoring state`);
        return { 
          success: false, 
          message: "Booking not in step 5, not restoring state"
        };
      }
    } catch (err) {
      console.error("Error loading booking details:", err);
      return rejectWithValue("Failed to load booking details.");
    }
  }
);
