// src/store/dispatchSlice.ts

import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  createSelector,
} from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { DISPATCH_HUB } from "@/constants/map";
import { StationFeature } from "@/store/stationsSlice";
import { ensureGoogleMapsLoaded, getDirections } from "@/lib/googleMaps";

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

  // Sheet state to manage which sheet is open
  openSheet: "none" | "car" | "list" | "detail";
}

const initialState: DispatchState = {
  locations: [],
  loading: false,
  error: null,

  // For dispatch->departure route
  route2: null,
  routeStatus: "idle",
  routeError: null,

  // Default sheet is 'none', meaning no sheet is open
  openSheet: "none",
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
  try {
    // Ensure Google Maps is loaded
    await ensureGoogleMapsLoaded();
    
    const [stationLng, stationLat] = station.geometry.coordinates;
    
    // Get route using our utility function
    const result = await getDirections(
      { lat: DISPATCH_HUB.lat, lng: DISPATCH_HUB.lng },
      { lat: stationLat, lng: stationLng },
      { travelMode: google.maps.TravelMode.DRIVING }
    );
    
    if (!result.routes?.[0]) {
      return rejectWithValue("No route found");
    }

    const route = result.routes[0];
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
    console.error("Dispatch directions error:", err);
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
    
    /** Sets the open sheet state */
    openNewSheet: (state, action: PayloadAction<"none" | "car" | "list" | "detail">) => {
      state.openSheet = action.payload;
    },
    
    /** Closes the currently open sheet */
    closeSheet: (state) => {
      state.openSheet = "none";
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
export const { clearDispatchRoute, openNewSheet, closeSheet } = dispatchSlice.actions;

/* --------------------------- Selectors --------------------------- */
export const selectAllDispatchLocations = (state: RootState) => state.dispatch.locations;
export const selectDispatchLoading = (state: RootState) => state.dispatch.loading;
export const selectDispatchError = (state: RootState) => state.dispatch.error;

/** The route from dispatchHub → departure station */
export const selectDispatchRoute = (state: RootState) => state.dispatch.route2;
export const selectDispatchRouteStatus = (state: RootState) => state.dispatch.routeStatus;
export const selectDispatchRouteError = (state: RootState) => state.dispatch.routeError;

/** The open sheet state */
export const selectOpenSheet = (state: RootState) => state.dispatch.openSheet;

/* --------------------------------------------------------------
   Memoized selector to decode the dispatch route polyline (if any)
   -------------------------------------------------------------- */

/**
 * Decodes the polyline into an array of { lat, lng } objects
 * only when route2.polyline changes (via Reselect memoization).
 */
export const selectDispatchRouteDecoded = createSelector(
  [selectDispatchRoute],
  (route) => {
    if (!route || !route.polyline) return [];

    try {
      // Safely check if the Google Maps geometry library is available
      if (!window.google?.maps?.geometry?.encoding) {
        ensureGoogleMapsLoaded();
        return [];
      }

      const decodedPath = window.google.maps.geometry.encoding.decodePath(
        route.polyline
      );

      // Map each LatLng to a plain object { lat, lng }
      return decodedPath.map((latLng) => latLng.toJSON());
    } catch (error) {
      console.error("Error decoding polyline:", error);
      return [];
    }
  }
);
