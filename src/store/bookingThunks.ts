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
 * - Reads from Redux store’s booking state
 * - Persists it under `users/{uid}/booking: {...}` in Firestore
 */
export const saveBookingDetails = createAsyncThunk(
  "booking/saveBookingDetails",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
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

      // Convert the Date object to string (if present)
      const departureDateString = departureDate ? departureDate.toISOString() : null;

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // Build the object you want to store
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

      return "success";
    } catch (err) {
      console.error("Error saving booking details:", err);
      return rejectWithValue("Failed to save booking details.");
    }
  }
);

/**
 * loadBookingDetails:
 * - Fetches booking data from `users/{uid}/booking`
 * - If booking.step >= 5, we rehydrate Redux to that step
 *   (If step < 5, we skip so user starts fresh.)
 */
export const loadBookingDetails = createAsyncThunk(
  "booking/loadBookingDetails",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const user = state.user.authUser;
      if (!user) {
        return rejectWithValue("User not signed in; cannot load booking details.");
      }

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        // No user doc found, so no booking data
        return;
      }

      const data = userSnap.data();
      const booking = data.booking as Partial<BookingState> | undefined;
      if (!booking) {
        // No booking field found
        return;
      }

      // Only rehydrate if step >= 5
      if (booking.step && booking.step >= 5) {
        // step
        dispatch(advanceBookingStep(booking.step));

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

        // if you stored route, you might also restore it:
        // e.g. dispatch(setRoute(booking.route)) if you had an action for that
      }
    } catch (err) {
      console.error("Error loading booking details:", err);
      return rejectWithValue("Failed to load booking details.");
    }
  }
);
