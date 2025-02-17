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
  /**
   * Optional field to store status of the route fetch:
   * 'idle' | 'loading' | 'succeeded' | 'failed'
   */
  routeStatus: string;
  /** Optional field for error messages when fetching route data. */
  routeError: string | null;

  /**
   * The user’s selected ticket plan: 'single' or 'paygo' (or null if not chosen).
   */
  ticketPlan: TicketPlan;
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

      // Extract lat/lng for departure & arrival
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

      // If overview_polyline is typed as a string, just use it directly.
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
  ticketPlan: null, // NEW FIELD
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
     * Advances the booking flow to a specified step and sets the corresponding stepName.
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
     * Resets the entire booking flow to its initial state.
     */
    resetBookingFlow: (state) => {
      state.step = 1;
      state.stepName = "selecting_departure_station";
      state.departureDate = null;
      // Reset route-related fields
      state.route = null;
      state.routeStatus = "idle";
      state.routeError = null;
      // Reset ticket plan
      state.ticketPlan = null;
    },

    /**
     * Sets the user's chosen ticket plan (e.g., 'single' or 'paygo').
     */
    setTicketPlan: (state, action: PayloadAction<TicketPlan>) => {
      state.ticketPlan = action.payload;
    },

    /**
     * NEW: Clears the route data so no polyline is rendered.
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
  resetBookingFlow,
  setTicketPlan,
  clearRoute, // <--- New action
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

/** NEW: Ticket plan selector */
export const selectTicketPlan = (state: RootState) => state.booking.ticketPlan;
