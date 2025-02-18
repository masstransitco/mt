// src/store/bookingSlice.ts
"use client";

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { StationFeature } from "./stationsSlice";

/** The user’s chosen ticket plan. */
type TicketPlan = "single" | "paygo" | null;

interface RouteInfo {
  /** distance in meters */
  distance: number;
  /** duration in seconds */
  duration: number;
  /** The encoded polyline for the route (optional) */
  polyline: string;
}

export interface BookingState {
  /**
   * The numerical step we’re on.
   *  1 = selecting_departure_station
   *  2 = selected_departure_station
   *  3 = selecting_arrival_station
   *  4 = selected_arrival_station
   *  5 = payment
   *  6 = finalizing
   */
  step: number;
  /** A string name for the current step (useful for debugging or UI conditions). */
  stepName: string;
  /** An optional date field if you want the user to pick a departure date/time. */
  departureDate: Date | null;
  /** An optional route object that stores distance, duration, etc. */
  route: RouteInfo | null;
  /** 'idle' | 'loading' | 'succeeded' | 'failed' */
  routeStatus: string;
  /** Error message (if any) from route fetching. */
  routeError: string | null;

  /**
   * The user’s selected ticket plan: 'single' or 'paygo' (or null if not chosen).
   */
  ticketPlan: TicketPlan;

  /**
   * Moved from userSlice:
   * Numeric station IDs for departure/arrival
   */
  departureStationId: number | null;
  arrivalStationId: number | null;
}

/**
 * Thunk: fetchRoute
 * Uses Google Maps DirectionsService to fetch driving route
 * between two StationFeatures. If the call succeeds, we store
 * distance/duration/polyline in booking state.
 */
export const fetchRoute = createAsyncThunk<
  RouteInfo, // Return type of fulfilled action
  { departure: StationFeature; arrival: StationFeature }, // Thunk argument
  { rejectValue: string } // Rejected action payload
>(
  "booking/fetchRoute",
  async ({ departure, arrival }, { rejectWithValue }) => {
    if (!window.google || !window.google.maps) {
      return rejectWithValue("Google Maps API not available");
    }
    try {
      const directionsService = new google.maps.DirectionsService();

      const [depLng, depLat] = departure.geometry.coordinates;
      const [arrLng, arrLat] = arrival.geometry.coordinates;

      const request: google.maps.DirectionsRequest = {
        origin: { lat: depLat, lng: depLng },
        destination: { lat: arrLat, lng: arrLng },
        travelMode: google.maps.TravelMode.DRIVING,
      };

      const response = await directionsService.route(request);

      if (!response || !response.routes || !response.routes[0]) {
        return rejectWithValue("No route found");
      }

      const route = response.routes[0];
      const leg = route.legs?.[0];
      if (!leg || !leg.distance || !leg.duration) {
        return rejectWithValue("Incomplete route data");
      }

      const distance = leg.distance.value; // meters
      const duration = leg.duration.value; // seconds
      const polyline = route.overview_polyline || "";

      return { distance, duration, polyline };
    } catch (err) {
      console.error(err);
      return rejectWithValue("Directions request failed");
    }
  }
);

const initialState: BookingState = {
  step: 1,
  stepName: "selecting_departure_station",
  departureDate: null,
  route: null,
  routeStatus: "idle",
  routeError: null,
  ticketPlan: null,

  // Moved station IDs here
  departureStationId: null,
  arrivalStationId: null,
};

export const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    /**
     * Stores a user-chosen departure date/time.
     */
    setDepartureDate: (state, action: PayloadAction<Date>) => {
      state.departureDate = action.payload;
    },

    /**
     * Force-advances the booking flow to a specified step and sets the corresponding stepName.
     * (Useful if you have an override or a button that explicitly sets step.)
     */
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
      switch (action.payload) {
        case 1:
          state.stepName = "selecting_departure_station";
          break;
        case 2:
          state.stepName = "selected_departure_station";
          break;
        case 3:
          state.stepName = "selecting_arrival_station";
          break;
        case 4:
          state.stepName = "selected_arrival_station";
          break;
        case 5:
          state.stepName = "payment";
          break;
        case 6:
          state.stepName = "finalizing";
          break;
        default:
          state.step = 1;
          state.stepName = "selecting_departure_station";
          break;
      }
    },

    /**
     * Select a departure station (step 1 → 2).
     * If step is already beyond 2, do nothing or show a warning (strict linear flow).
     */
    selectDepartureStation: (state, action: PayloadAction<number>) => {
      // Only allow if step <= 2 (strict linear)
      if (state.step <= 2) {
        state.departureStationId = action.payload;
        // If step was 1, move to step 2
        if (state.step === 1) {
          state.step = 2;
          state.stepName = "selected_departure_station";
        }
      }
      // else optionally show a toast in UI or do nothing
    },

    /**
     * Clear departure station (returns to step 1).
     */
    clearDepartureStation: (state) => {
      state.departureStationId = null;
      state.step = 1;
      state.stepName = "selecting_departure_station";
      // Potentially clear the route if it depends on departure
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },

    /**
     * Select arrival station (step 3 → 4).
     * Only allow if step >= 3 and step <= 4 (strict linear).
     */
    selectArrivalStation: (state, action: PayloadAction<number>) => {
      // Only allow if step in [3, 4]
      if (state.step >= 3 && state.step <= 4) {
        state.arrivalStationId = action.payload;
        // If step was 3, move to step 4
        if (state.step === 3) {
          state.step = 4;
          state.stepName = "selected_arrival_station";
        }
      }
      // else optionally show a warning
    },

    /**
     * Clear arrival station (returns to step 3 if user had selected an arrival).
     */
    clearArrivalStation: (state) => {
      state.arrivalStationId = null;
      // Revert to step 3 if we were in step 4
      if (state.step >= 3) {
        state.step = 3;
        state.stepName = "selecting_arrival_station";
      }
      // Clear route
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },

    /**
     * Resets the entire booking flow to its initial state.
     */
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.departureDate = null;
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
      state.ticketPlan = null;
      state.departureStationId = null;
      state.arrivalStationId = null;
    },

    /**
     * Sets the user's chosen ticket plan (e.g., 'single' or 'paygo').
     */
    setTicketPlan: (state, action: PayloadAction<TicketPlan>) => {
      state.ticketPlan = action.payload;
    },

    /**
     * Clears the route data so no polyline is rendered.
     */
    clearRoute: (state) => {
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
  },
  extraReducers: (builder) => {
    // fetchRoute
    builder
      .addCase(fetchRoute.pending, (state) => {
        state.routeStatus = "loading";
        state.routeError = null;
      })
      .addCase(fetchRoute.fulfilled, (state, action) => {
        state.routeStatus = "succeeded";
        state.routeError = null;
        state.route = action.payload; // { distance, duration, polyline }
      })
      .addCase(fetchRoute.rejected, (state, action) => {
        state.routeStatus = "failed";
        state.routeError = action.payload ?? "Failed to fetch route";
        state.route = null;
      });
  },
});

// Action creators
export const {
  setDepartureDate,
  advanceBookingStep,
  selectDepartureStation,
  clearDepartureStation,
  selectArrivalStation,
  clearArrivalStation,
  resetBookingFlow,
  setTicketPlan,
  clearRoute,
} = bookingSlice.actions;

// Export the reducer
export default bookingSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectBookingStep = (state: RootState) => state.booking.step;
export const selectBookingStepName = (state: RootState) => state.booking.stepName;
export const selectDepartureDate = (state: RootState) => state.booking.departureDate;

/** Route selectors */
export const selectRoute = (state: RootState) => state.booking.route;
export const selectRouteStatus = (state: RootState) => state.booking.routeStatus;
export const selectRouteError = (state: RootState) => state.booking.routeError;

/** Ticket plan selector */
export const selectTicketPlan = (state: RootState) => state.booking.ticketPlan;

/** Station IDs */
export const selectDepartureStationId = (state: RootState) => state.booking.departureStationId;
export const selectArrivalStationId = (state: RootState) => state.booking.arrivalStationId;
