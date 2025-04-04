// src/store/userSlice.ts
"use client";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { loadBookingDetails } from "./bookingThunks"; // <-- import your thunks here
import { getWalkingDirections, ensureGoogleMapsLoaded } from "@/lib/googleMaps";
import { StationFeature } from "./stationsSlice";

// Example interface for a signed-in user (adjust fields if needed)
interface AuthUser {
  uid: string;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

/** Defines the walking route information between user location and station */
interface WalkingRouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  polyline: string; // encoded polyline string from Google Maps DirectionsResult
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
  
  // Walking route to selected station
  walkingRoute: WalkingRouteInfo | null;
  walkingRouteStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  walkingRouteError: string | null;

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
  
  // Walking route
  walkingRoute: null,
  walkingRouteStatus: 'idle',
  walkingRouteError: null,

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
/**
 * Thunk to fetch walking route between user location and selected station
 */
export const fetchWalkingRoute = createAsyncThunk<
  WalkingRouteInfo,
  { locationFrom: google.maps.LatLngLiteral, station: StationFeature },
  { rejectValue: string }
>(
  "user/fetchWalkingRoute",
  async ({ locationFrom, station }, { rejectWithValue }) => {
    try {
      // No need to await ensureGoogleMapsLoaded() anymore,
      // our GoogleMapsProvider ensures Maps API is available
      const [stationLng, stationLat] = station.geometry.coordinates;
      
      const result = await getWalkingDirections(
        locationFrom,
        { lat: stationLat, lng: stationLng }
      );
      
      if (!result.routes?.[0]) {
        return rejectWithValue("No walking route found");
      }
      
      const route = result.routes[0];
      const leg = route.legs?.[0];
      
      if (!leg?.distance?.value || !leg?.duration?.value) {
        return rejectWithValue("Incomplete walking route data");
      }
      
      // Get the polyline string
      // Based on the Google Maps types, we need to cast or handle the various possible types
      let polylineString = '';
      
      if (typeof route.overview_polyline === 'string') {
        polylineString = route.overview_polyline;
      } else if (route.overview_polyline && typeof route.overview_polyline === 'object') {
        // Cast to any to avoid TypeScript errors since the API types may vary
        const polyline = route.overview_polyline as any;
        if (polyline.points) {
          polylineString = polyline.points;
        }
      }
      
      const walkingRouteInfo = {
        distance: leg.distance.value,
        duration: leg.duration.value,
        polyline: polylineString,
      };
      
      return walkingRouteInfo;
    } catch (err: any) {
      console.error("Walking route fetching error:", err);
      return rejectWithValue(err.message || "Failed to fetch walking route");
    }
  }
);

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
    clearWalkingRoute: (state) => {
      state.walkingRoute = null;
      state.walkingRouteStatus = 'idle';
      state.walkingRouteError = null;
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
    
    // Handle fetchWalkingRoute states
    builder
      .addCase(fetchWalkingRoute.pending, (state) => {
        state.walkingRouteStatus = 'loading';
        state.walkingRouteError = null;
      })
      .addCase(fetchWalkingRoute.fulfilled, (state, action) => {
        state.walkingRouteStatus = 'succeeded';
        state.walkingRoute = action.payload;
        state.walkingRouteError = null;
      })
      .addCase(fetchWalkingRoute.rejected, (state, action) => {
        state.walkingRouteStatus = 'failed';
        state.walkingRouteError = action.payload || "Failed to fetch walking route";
        state.walkingRoute = null;
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
  clearWalkingRoute,
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

// Walking route selectors
export const selectWalkingRoute = (state: RootState) => state.user.walkingRoute;
export const selectWalkingRouteStatus = (state: RootState) => state.user.walkingRouteStatus;
export const selectWalkingRouteError = (state: RootState) => state.user.walkingRouteError;
export const selectWalkingDuration = (state: RootState) => {
  const route = state.user.walkingRoute;
  if (route?.duration) {
    // Convert seconds to minutes, rounded up to nearest minute
    return Math.ceil(route.duration / 60);
  }
  return null;
};

// Convenience selector for "user has a default PM?"
export const selectHasDefaultPaymentMethod = (state: RootState) =>
  !!state.user.defaultPaymentMethodId;

// Reducer
export default userSlice.reducer;
