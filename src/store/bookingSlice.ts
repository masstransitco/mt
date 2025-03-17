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
  step: number;
  stepName: string;
  departureDate: Date | null;
  route: RouteInfo | null;
  routeStatus: string; // "idle" | "loading" | "succeeded" | "failed"
  routeError: string | null;
  ticketPlan: TicketPlan;

  departureStationId: number | null;
  arrivalStationId: number | null;
}

/**
 * Thunk to fetch a route between two stations using the Google Maps API.
 * On success, returns { distance, duration, polyline }.
 */
export const fetchRoute = createAsyncThunk<
  RouteInfo, 
  { departure: StationFeature; arrival: StationFeature }, 
  { rejectValue: string }
>(
  "booking/fetchRoute",
  async ({ departure, arrival }, { rejectWithValue }) => {
    try {
      await ensureGoogleMapsLoaded();
      const [depLng, depLat] = departure.geometry.coordinates;
      const [arrLng, arrLat] = arrival.geometry.coordinates;

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
      return {
        distance: leg.distance.value,
        duration: leg.duration.value,
        polyline: route.overview_polyline ?? "",
      };
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
  departureStationId: null,
  arrivalStationId: null,
};

export const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setDepartureDate: (state, action: PayloadAction<Date>) => {
      state.departureDate = action.payload;
    },
    advanceBookingStep: (state, action: PayloadAction<number>) => {
      const newStep = action.payload;
      
      // Validate step transition
      if (newStep < 1 || newStep > 6) {
        console.warn(`Invalid booking step: ${newStep}, defaulting to step 1`);
        state.step = 1;
        state.stepName = "selecting_departure_station";
        return;
      }
      
      // Don't allow skipping steps (except explicitly going back to step 1)
      if (newStep !== 1 && newStep > state.step + 1) {
        console.warn(`Cannot advance from step ${state.step} to ${newStep} - steps can't be skipped`);
        return;
      }
      
      // Set the step and name
      state.step = newStep;
      
      // Set the step name consistently
      switch (newStep) {
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
          state.stepName = "selecting_departure_station";
      }
    },
    selectDepartureStation: (state, action: PayloadAction<number>) => {
      state.departureStationId = action.payload;
      state.step = 2;
      state.stepName = "selected_departure_station";
    },
    clearDepartureStation: (state) => {
      state.departureStationId = null;
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
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
    setTicketPlan: (state, action: PayloadAction<TicketPlan>) => {
      state.ticketPlan = action.payload;
    },
    clearRoute: (state) => {
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoute.pending, (state) => {
        state.routeStatus = "loading";
        state.routeError = null;
      })
      .addCase(fetchRoute.fulfilled, (state, action) => {
        state.routeStatus = "succeeded";
        state.routeError = null;
        state.route = action.payload;
      })
      .addCase(fetchRoute.rejected, (state, action) => {
        state.routeStatus = "failed";
        state.routeError = action.payload ?? "Failed to fetch route";
        state.route = null;
      });
  },
});

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

export default bookingSlice.reducer;

/** Step & stepName */
export const selectBookingStep = (state: RootState) => state.booking.step;
export const selectBookingStepName = (state: RootState) => state.booking.stepName;

/** Departure date/time */
export const selectDepartureDate = (state: RootState) => state.booking.departureDate;

/** Route object (encoded polyline, distance, etc.) */
export const selectRoute = (state: RootState) => state.booking.route;
export const selectRouteStatus = (state: RootState) => state.booking.routeStatus;
export const selectRouteError = (state: RootState) => state.booking.routeError;

/** Ticket plan */
export const selectTicketPlan = (state: RootState) => state.booking.ticketPlan;

/** Station IDs */
export const selectDepartureStationId = (state: RootState) => state.booking.departureStationId;
export const selectArrivalStationId = (state: RootState) => state.booking.arrivalStationId;

/** If you need a memoized decode of the polyline, etc. */
export const selectRouteDecoded = createSelector(
  [selectRoute],
  (route) => {
    if (!route || !route.polyline) return [];
    try {
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
