// src/store/userSlice.ts
"use client";

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

// Example interface for an authenticated user (from Firebase or another system).
// Adjust fields as needed for your app (phoneNumber, displayName, etc.).
interface AuthUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

interface UserState {
  // Keep this if a car is truly a personal user selection,
  // or consider moving it to bookingSlice if it's part of the flow.
  selectedCarId: number | null;

  // We removed departureStationId & arrivalStationId from here,
  // because we handle those in bookingSlice now.
  userLocation: google.maps.LatLngLiteral | null;
  searchLocation: google.maps.LatLngLiteral | null; // <--- new field
  viewState: "showCar" | "showMap";

  // Auth fields
  authUser: AuthUser | null; 
  isSignedIn: boolean;

  // NEW: To track which PM is the default (or null if none)
  defaultPaymentMethodId: string | null;
}

const initialState: UserState = {
  selectedCarId: null,
  userLocation: null,
  viewState: "showCar",
  searchLocation: null,

  // Auth
  authUser: null,
  isSignedIn: false,

  // NEW
  defaultPaymentMethodId: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Keep selecting a car as part of user state, if appropriate
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

    // Could be used to reset any user-specific fields
    resetUserSelections: (state) => {
      state.selectedCarId = null;
      // We no longer clear station IDs here, since those are in bookingSlice.
    },

    // Auth reducers
    setAuthUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.authUser = action.payload;
      state.isSignedIn = !!action.payload;
    },
    signOutUser: (state) => {
      state.authUser = null;
      state.isSignedIn = false;
      state.defaultPaymentMethodId = null; // Also clear out
    },

    // NEW: set or clear the default payment method ID
    setDefaultPaymentMethodId: (state, action: PayloadAction<string | null>) => {
      state.defaultPaymentMethodId = action.payload;
    },
  },
});

// Export actions
export const {
  selectCar,
  setUserLocation,
  setSearchLocation,
  setViewState,
  resetUserSelections,
  setAuthUser,
  signOutUser,
  setDefaultPaymentMethodId, // NEW
} = userSlice.actions;

// Selectors
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectSearchLocation = (state: RootState) => state.user.searchLocation;
export const selectViewState = (state: RootState) => state.user.viewState;
export const selectAuthUser = (state: RootState) => state.user.authUser;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;

// NEW: convenience selector for "does user have a default PM?"
export const selectHasDefaultPaymentMethod = (state: RootState) =>
  !!state.user.defaultPaymentMethodId;

export default userSlice.reducer;
