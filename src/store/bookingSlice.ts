// src/store/bookingSlice.ts
"use client";

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { StationFeature } from "./stationsSlice";
import { ensureGoogleMapsLoaded, getDirections } from "@/lib/googleMaps";

/** The user's chosen ticket plan. */
type TicketPlan = "single" | "paygo" | null;

/** Defines the route information between two stations. */
interface RouteInfo {
  /** Distance in meters. */
  distance: number;
  /** Duration in seconds. */
  duration: number;
  /** The encoded polyline for the route. */
  polyline: string;
}

/** The overall state for booking. */
export interface BookingState {
  /**
   * The numerical step we're on (1 → n).
   * 1 = selecting_departure_station
   * 2 = selected_departure_station
   * 3 = selecting_arrival_station
   * 4 = selected_arrival_station
   * 5 = payment
   * 6 = finalizing
   */
  step: number;

  /** A string name for the current step (for UI logic). */
  stepName: string;

  /** Optional date/time the user plans to depart. */
  departureDate: Date | null;

  /** The route object (distance, duration, encoded polyline). */
  route: RouteInfo | null;
  /** 'idle' | 'loading' | 'succeeded' | 'failed'. */
  routeStatus: string;
  /** Error message (if any) for route fetching. */
  routeError: string | null;

  /** The user's selected ticket plan, or null if not chosen. */
  ticketPlan: TicketPlan;

  /** Numeric station IDs for departure/arrival. */
  departureStationId: number | null;
  arrivalStationId: number | null;
}

/**
 * Thunk to fetch a route between two stations using the Google Maps API.
 * On success, returns { distance, duration, polyline }.
 */
export const fetchRoute = createAsyncThunk<
  RouteInfo, // Return type
  { departure: StationFeature; arrival: StationFeature }, // Args
  { rejectValue: string } // Rejected payload
>(
  "booking/fetchRoute",
  async ({ departure, arrival }, { rejectWithValue }) => {
    try {
      // Ensure Google Maps is loaded
      await ensureGoogleMapsLoaded();
      
      const [depLng, depLat] = departure.geometry.coordinates;
      const [arrLng, arrLat] = arrival.geometry.coordinates;

      // Use our utility function for getting directions
      const result = await getDirections(
        { lat: depLat, lng: depLng },
        { lat: arrLat, lng: arrLng },
        { travelMode: google.maps.TravelMode.DRIVING }
      );
      
      if (!result.routes?.[0]) {
        return rejectWithValue("No route found");
      }

      const route = result.routes[0];
      const leg = route.legs?.[0];
      if (!leg?.distance?.value || !leg?.duration?.value) {
        return rejectWithValue("Incomplete route data");
      }

      const distance = leg.distance.value;
      const duration = leg.duration.value;
      const polyline = route.overview_polyline || "";

      return { distance, duration, polyline };
    } catch (err) {
      console.error("Route fetching error:", err);
      return rejectWithValue("Directions request failed");
    }
  }
);

/** Initial booking state. */
const initialState: BookingState = {
  step: 1,
  stepName: "selecting_departure_station",
  departureDate: null,
  route: null,
  routeStatus: "idle",
  routeError: null,
  ticketPlan: null,

  // Station IDs
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
     * Advances or sets the booking flow to a specific step number
     * (and updates stepName accordingly).
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
     * Select or re-select a departure station.
     * If step is 1, jump to step 2.
     */
    selectDepartureStation: (state, action: PayloadAction<number>) => {
      // Only allow if step <= 2 (linear flow)
      if (state.step <= 2) {
        state.departureStationId = action.payload;
        if (state.step === 1) {
          state.step = 2;
          state.stepName = "selected_departure_station";
        }
      }
    },

    /**
     * Clears the departure station, resetting to step 1.
     */
    clearDepartureStation: (state) => {
      state.departureStationId = null;
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },

    /**
     * Select or re-select an arrival station.
     * If step is 3, jump to step 4.
     */
    selectArrivalStation: (state, action: PayloadAction<number>) => {
      // Only allow if step in [3, 4]
      if (state.step >= 3 && state.step <= 4) {
        state.arrivalStationId = action.payload;
        if (state.step === 3) {
          state.step = 4;
          state.stepName = "selected_arrival_station";
        }
      }
    },

    /**
     * Clears the arrival station, returning to step 3 if needed.
     */
    clearArrivalStation: (state) => {
      state.arrivalStationId = null;
      if (state.step >= 3) {
        state.step = 3;
        state.stepName = "selecting_arrival_station";
      }
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },

    /**
     * Resets the entire booking process (back to step 1).
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
     * Sets the user's chosen ticket plan (e.g. 'single' or 'paygo').
     */
    setTicketPlan: (state, action: PayloadAction<TicketPlan>) => {
      state.ticketPlan = action.payload;
    },

    /**
     * Clears route data from state so no polyline is shown.
     */
    clearRoute: (state) => {
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
  },
  extraReducers: (builder) => {
    // fetchRoute handling
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

/* ------------------------- Selectors ------------------------- */

/** Step & stepName */
export const selectBookingStep = (state: RootState) => state.booking.step;
export const selectBookingStepName = (state: RootState) => state.booking.stepName;

/** Departure date/time */
export const selectDepartureDate = (state: RootState) => state.booking.departureDate;

/** The raw route object (encoded polyline, distance, etc.) */
export const selectRoute = (state: RootState) => state.booking.route;
export const selectRouteStatus = (state: RootState) => state.booking.routeStatus;
export const selectRouteError = (state: RootState) => state.booking.routeError;

/** Ticket plan */
export const selectTicketPlan = (state: RootState) => state.booking.ticketPlan;

/** Station IDs */
export const selectDepartureStationId = (state: RootState) => state.booking.departureStationId;
export const selectArrivalStationId = (state: RootState) => state.booking.arrivalStationId;

/* --------------------------------------------------------------
   Memoized selector to decode the route polyline (if any)
   -------------------------------------------------------------- */
export const selectRouteDecoded = createSelector(
  [selectRoute],
  (route) => {
    if (!route || !route.polyline) return [];

    try {
      // Safely check if Google Maps is loaded before using it
      if (!window.google?.maps?.geometry?.encoding) {
        ensureGoogleMapsLoaded();
        return [];
      }

      const decodedPath = window.google.maps.geometry.encoding.decodePath(route.polyline);
      return decodedPath.map((latLng) => latLng.toJSON());
    } catch (error) {
      console.error("Error decoding polyline:", error);
      return [];
    }
  }
);
