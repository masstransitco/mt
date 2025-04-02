// src/store/userSlice.ts
"use client";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { loadBookingDetails } from "./bookingThunks"; // <-- import your thunks here

// Example interface for a signed-in user (adjust fields if needed)
interface AuthUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

interface UserState {
  // If a car is truly a personal selection, keep it here
  selectedCarId: number | null;

  // Optionally store a user's map location(s)
  userLocation: google.maps.LatLngLiteral | null;
  searchLocation: google.maps.LatLngLiteral | null; // new field
  viewState: "showCar" | "showMap";
  
  // Store the currently selected station in the list view
  listSelectedStationId: number | null;

  // Auth fields
  authUser: AuthUser | null;
  isSignedIn: boolean;

  // e.g. a default payment method ID from Firestore
  defaultPaymentMethodId: string | null;
}

const initialState: UserState = {
  selectedCarId: null,
  userLocation: null,
  searchLocation: null,
  viewState: "showCar",
  listSelectedStationId: null,

  // Auth
  authUser: null,
  isSignedIn: false,

  defaultPaymentMethodId: null,
};

/**
 * A combined thunk that:
 * 1) Sets the user in Redux via setAuthUser
 * 2) Calls loadBookingDetails to rehydrate booking if step >= 5
 */
export const setAuthUserAndLoadBooking = createAsyncThunk(
  "user/setAuthUserAndLoadBooking",
  async (user: AuthUser | null, { dispatch }) => {
    // Step 1: Update Redux auth state
    dispatch(setAuthUser(user));

    // Step 2: If user is non-null, load booking details
    // (If step < 5 or no data, the thunk does nothing.)
    if (user) {
      await dispatch(loadBookingDetails());
    }
  }
);

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Example user-specific selections
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },
    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },
    setSearchLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.searchLocation = action.payload;
    },
    setViewState: (state, action: PayloadAction<"showCar" | "showMap">) => {
      state.viewState = action.payload;
    },
    setListSelectedStation: (state, action: PayloadAction<number | null>) => {
      state.listSelectedStationId = action.payload;
    },
    resetUserSelections: (state) => {
      state.selectedCarId = null;
      state.listSelectedStationId = null;
      // More fields can be reset if needed
    },

    // Auth reducers
    setAuthUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.authUser = action.payload;
      state.isSignedIn = !!action.payload;
    },
    signOutUser: (state) => {
      state.authUser = null;
      state.isSignedIn = false;
      state.defaultPaymentMethodId = null;
    },

    // Payment method
    setDefaultPaymentMethodId: (state, action: PayloadAction<string | null>) => {
      state.defaultPaymentMethodId = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Optionally, react to the success of setAuthUserAndLoadBooking
    builder.addCase(setAuthUserAndLoadBooking.fulfilled, (state, action) => {
      // The booking details are loaded in bookingSlice; no extra logic needed here
    });
  },
});

// Actions
export const {
  selectCar,
  setUserLocation,
  setSearchLocation,
  setViewState,
  setListSelectedStation,
  resetUserSelections,
  setAuthUser,
  signOutUser,
  setDefaultPaymentMethodId,
} = userSlice.actions;

// Selectors
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectSearchLocation = (state: RootState) => state.user.searchLocation;
export const selectViewState = (state: RootState) => state.user.viewState;
export const selectListSelectedStationId = (state: RootState) => state.user.listSelectedStationId;
export const selectAuthUser = (state: RootState) => state.user.authUser;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;

// Convenience selector for "user has a default PM?"
export const selectHasDefaultPaymentMethod = (state: RootState) =>
  !!state.user.defaultPaymentMethodId;

// Reducer
export default userSlice.reducer;
