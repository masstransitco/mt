// src/store/dispatchSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { DISPATCH_HUB } from "@/constants/map";
import { StationFeature } from "@/store/stationsSlice";

/** RouteInfo for the dispatch hub → departure route */
interface RouteInfo {
  distance: number;  // meters
  duration: number;  // seconds
  polyline: string;  // encoded polyline
}

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

/**
 * The overall shape of our dispatch state:
 * - An array of "DispatchLocation" items
 * - A route object (`route2`) for dispatch->departure
 */
interface DispatchState {
  locations: DispatchLocation[];
  loading: boolean;
  error: string | null;

  // Additional route fields
  route2: RouteInfo | null;
  routeStatus: "idle" | "loading" | "succeeded" | "failed";
  routeError: string | null;
}

const initialState: DispatchState = {
  locations: [],
  loading: false,
  error: null,

  // For dispatch->departure route
  route2: null,
  routeStatus: "idle",
  routeError: null,
};

// 1) Thunk to fetch static dispatch locations
export const fetchDispatchLocations = createAsyncThunk<
  DispatchLocation[],
  void,
  { rejectValue: string }
>("dispatch/fetchDispatchLocations", async (_, { rejectWithValue }) => {
  try {
    // Example: returns a single dispatch location anchored at DISPATCH_HUB
    const locations = [
      {
        id: 1,
        lat: DISPATCH_HUB.lat,
        lng: DISPATCH_HUB.lng,
      },
    ];
    return locations;
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

/**
 * 2) Thunk: fetchDispatchDirections
 *    Grabs driving route from DISPATCH_HUB → chosen departure station
 */
export const fetchDispatchDirections = createAsyncThunk<
  RouteInfo,              // Return type
  StationFeature,         // Thunk argument (the chosen station)
  { rejectValue: string } // Rejected payload
>("dispatch/fetchDispatchDirections", async (station, { rejectWithValue }) => {
  if (!window.google || !window.google.maps) {
    return rejectWithValue("Google Maps API not available");
  }
  try {
    const directionsService = new google.maps.DirectionsService();

    const [stationLng, stationLat] = station.geometry.coordinates;

    const request: google.maps.DirectionsRequest = {
      origin: { lat: DISPATCH_HUB.lat, lng: DISPATCH_HUB.lng },
      destination: { lat: stationLat, lng: stationLng },
      travelMode: google.maps.TravelMode.DRIVING,
    };

    const response = await directionsService.route(request);
    if (!response?.routes?.[0]) {
      return rejectWithValue("No route found");
    }

    const route = response.routes[0];
    const leg = route.legs?.[0];
    if (!leg?.distance?.value || !leg.duration?.value) {
      return rejectWithValue("Incomplete route data");
    }

    return {
      distance: leg.distance.value,
      duration: leg.duration.value,
      polyline: route.overview_polyline ?? "",
    };
  } catch (err) {
    console.error(err);
    return rejectWithValue("Directions request failed");
  }
});

const dispatchSlice = createSlice({
  name: "dispatch",
  initialState,
  reducers: {
    /** Clears out the dispatch→departure route data */
    clearDispatchRoute: (state) => {
      state.route2 = null;
      state.routeStatus = "idle";
      state.routeError = null;
    },
  },
  extraReducers: (builder) => {
    // ------ fetchDispatchLocations ------
    builder
      .addCase(fetchDispatchLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDispatchLocations.fulfilled,
        (state, action: PayloadAction<DispatchLocation[]>) => {
          state.loading = false;
          state.locations = action.payload;
        }
      )
      .addCase(fetchDispatchLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // ------ fetchDispatchDirections ------
    builder
      .addCase(fetchDispatchDirections.pending, (state) => {
        state.routeStatus = "loading";
        state.routeError = null;
      })
      .addCase(fetchDispatchDirections.fulfilled, (state, action) => {
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

/* --------------------------- Selectors --------------------------- */
export const selectAllDispatchLocations = (state: RootState) => state.dispatch.locations;
export const selectDispatchLoading = (state: RootState) => state.dispatch.loading;
export const selectDispatchError = (state: RootState) => state.dispatch.error;

/** The route from dispatchHub → departure station */
export const selectDispatchRoute = (state: RootState) => state.dispatch.route2;
export const selectDispatchRouteStatus = (state: RootState) => state.dispatch.routeStatus;
export const selectDispatchRouteError = (state: RootState) => state.dispatch.routeError;
