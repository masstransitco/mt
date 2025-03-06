// src/store/userSlice.ts
"use client";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { loadBookingDetails } from "./bookingThunks"; // <--- import from bookingThunks

interface AuthUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

interface UserState {
  selectedCarId: number | null;
  userLocation: google.maps.LatLngLiteral | null;
  searchLocation: google.maps.LatLngLiteral | null;
  viewState: "showCar" | "showMap";

  authUser: AuthUser | null;
  isSignedIn: boolean;

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

  defaultPaymentMethodId: null,
};

/**
 * Optional: A combined thunk that sets the user in Redux
 * and then tries to load booking details from Firestore
 * if the step >= 5. If < 5 or no data, it won't rehydrate anything.
 */
export const setAuthUserAndLoadBooking = createAsyncThunk(
  "user/setAuthUserAndLoadBooking",
  async (user: AuthUser | null, { dispatch }) => {
    // 1) Immediately setAuthUser in Redux
    dispatch(setAuthUser(user));

    // 2) If user is non-null, try to load booking details
    if (user) {
      await dispatch(loadBookingDetails());
    }
  }
);

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
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
    resetUserSelections: (state) => {
      state.selectedCarId = null;
    },

    // Auth
    setAuthUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.authUser = action.payload;
      state.isSignedIn = !!action.payload;
    },
    signOutUser: (state) => {
      state.authUser = null;
      state.isSignedIn = false;
      state.defaultPaymentMethodId = null;
    },

    setDefaultPaymentMethodId: (state, action: PayloadAction<string | null>) => {
      state.defaultPaymentMethodId = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Listen for setAuthUserAndLoadBooking if you want to do anything else
    builder.addCase(setAuthUserAndLoadBooking.fulfilled, (state, action) => {
      // The booking details are loaded in bookingSlice, so no extra logic needed here
    });
  },
});

export const {
  selectCar,
  setUserLocation,
  setSearchLocation,
  setViewState,
  resetUserSelections,
  setAuthUser,
  signOutUser,
  setDefaultPaymentMethodId,
} = userSlice.actions;

export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectSearchLocation = (state: RootState) => state.user.searchLocation;
export const selectViewState = (state: RootState) => state.user.viewState;
export const selectAuthUser = (state: RootState) => state.user.authUser;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;
export const selectHasDefaultPaymentMethod = (state: RootState) =>
  !!state.user.defaultPaymentMethodId;

export default userSlice.reducer;
