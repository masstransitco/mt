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
  viewState: "showCar" | "showMap";

  // Auth fields
  authUser: AuthUser | null; 
  isSignedIn: boolean;
}

const initialState: UserState = {
  selectedCarId: null,
  userLocation: null,
  viewState: "showCar",

  // Auth
  authUser: null,
  isSignedIn: false,
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
    },
  },
});

// Export actions
export const {
  selectCar,
  setUserLocation,
  setViewState,
  resetUserSelections,
  setAuthUser,
  signOutUser,
} = userSlice.actions;

// Selectors
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectViewState = (state: RootState) => state.user.viewState;
export const selectAuthUser = (state: RootState) => state.user.authUser;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;

export default userSlice.reducer;
