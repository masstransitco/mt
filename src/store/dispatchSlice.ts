// src/store/dispatchSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { DISPATCH_HUB } from "@/constants/map";
import { StationFeature } from "@/store/stationsSlice";

/** Reuse a similar interface as in bookingSlice for the route */
interface RouteInfo {
  distance: number;      // meters
  duration: number;      // seconds
  polyline: string;      // encoded polyline
}

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

interface DispatchState {
  locations: DispatchLocation[];
  loading: boolean;
  error: string | null;

  /** The route from dispatch hub -> departure station */
  route2: RouteInfo | null;
  routeStatus: "idle" | "loading" | "succeeded" | "failed";
  routeError: string | null;
}

const initialState: DispatchState = {
  locations: [],
  loading: false,
  error: null,

  route2: null,
  routeStatus: "idle",
  routeError: null,
};

// 1. Async thunk to fetch directions from DISPATCH_HUB -> chosen departure station
export const fetchDispatchDirections = createAsyncThunk<
  RouteInfo,                     // return type on success
  StationFeature,                // input: the chosen station
  { rejectValue: string }        // rejectValue type
>(
  "dispatch/fetchDispatchDirections",
  async (station, { rejectWithValue }) => {
    if (!window.google || !window.google.maps) {
      return rejectWithValue("Google Maps API not available");
    }
    try {
      const directionsService = new google.maps.DirectionsService();

      const request: google.maps.DirectionsRequest = {
        origin: { lat: DISPATCH_HUB.lat, lng: DISPATCH_HUB.lng },
        destination: {
          lat: station.geometry.coordinates[1],
          lng: station.geometry.coordinates[0],
        },
        travelMode: google.maps.TravelMode.DRIVING,
      };

      const response = await directionsService.route(request);

      if (!response || !response.routes?.[0]) {
        return rejectWithValue("No route found");
      }

      const route = response.routes[0];
      const leg = route.legs?.[0];
      if (!leg || !leg.distance || !leg.duration) {
        return rejectWithValue("Incomplete route data");
      }

      const distance = leg.distance.value; // meters
      const duration = leg.duration.value; // seconds
      const polyline = route.overview_polyline || ""; // encoded polyline

      return { distance, duration, polyline };
    } catch (err) {
      console.error(err);
      return rejectWithValue("Directions request failed");
    }
  }
);

const dispatchSlice = createSlice({
  name: "dispatch",
  initialState,
  reducers: {
    // Clear out the route so we don’t keep rendering old data
    clearDispatchRoute: (state) => {
      state.route2 = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // existing fetchDispatchLocations logic...
      .addCase(fetchDispatchDirections.pending, (state) => {
        state.routeStatus = "loading";
        state.routeError = null;
      })
      .addCase(fetchDispatchDirections.fulfilled, (state, action: PayloadAction<RouteInfo>) => {
        state.routeStatus = "succeeded";
        state.route2 = action.payload;
      })
      .addCase(fetchDispatchDirections.rejected, (state, action) => {
        state.routeStatus = "failed";
        state.routeError = action.payload as string;
        state.route2 = null;
      });
  },
});

export default dispatchSlice.reducer;

// Actions
export const { clearDispatchRoute } = dispatchSlice.actions;

// Selectors
export const selectAllDispatchLocations = (state: RootState) => state.dispatch.locations;
export const selectDispatchLoading = (state: RootState) => state.dispatch.loading;
export const selectDispatchError = (state: RootState) => state.dispatch.error;

// NEW: For the route
export const selectDispatchRoute = (state: RootState) => state.dispatch.route2;
export const selectDispatchRouteStatus = (state: RootState) => state.dispatch.routeStatus;
export const selectDispatchRouteError = (state: RootState) => state.dispatch.routeError;
