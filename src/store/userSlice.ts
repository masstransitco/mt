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
  // We're confirming the station IDs are numeric:
  selectedCarId: number | null;
  departureStationId: number | null;
  arrivalStationId: number | null;
  userLocation: google.maps.LatLngLiteral | null;
  viewState: "showCar" | "showMap";

  // NEW auth fields
  authUser: AuthUser | null; // null => not signed in
  isSignedIn: boolean;       // convenience boolean
}

const initialState: UserState = {
  // Original fields
  selectedCarId: null,
  departureStationId: null,
  arrivalStationId: null,
  userLocation: null,
  viewState: "showCar",

  // Auth: default to not signed in
  authUser: null,
  isSignedIn: false,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Existing station/car reducers
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },

    // Both departureStationId & arrivalStationId remain numeric
    selectDepartureStation: (state, action: PayloadAction<number | null>) => {
      state.departureStationId = action.payload;
    },
    selectArrivalStation: (state, action: PayloadAction<number | null>) => {
      state.arrivalStationId = action.payload;
    },

    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },

    clearDepartureStation: (state) => {
      state.departureStationId = null;
    },
    clearArrivalStation: (state) => {
      state.arrivalStationId = null;
    },

    setViewState: (state, action: PayloadAction<"showCar" | "showMap">) => {
      state.viewState = action.payload;
    },

    resetUserSelections: (state) => {
      state.selectedCarId = null;
      state.departureStationId = null;
      state.arrivalStationId = null;
    },

    // NEW auth reducers
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

// Export the actions
export const {
  selectCar,
  selectDepartureStation,
  selectArrivalStation,
  setUserLocation,
  clearDepartureStation,
  clearArrivalStation,
  setViewState,
  resetUserSelections,
  // New
  setAuthUser,
  signOutUser,
} = userSlice.actions;

// Selectors
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectDepartureStationId = (state: RootState) => state.user.departureStationId;
export const selectArrivalStationId = (state: RootState) => state.user.arrivalStationId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectViewState = (state: RootState) => state.user.viewState;
// New auth selectors
export const selectAuthUser = (state: RootState) => state.user.authUser;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;

export default userSlice.reducer;
