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

// Import from your carSlice:
import { setAvailableForDispatch } from "@/store/carSlice";

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
 * - Current route fetch status & error
 * - UI state for "sheets"
 * - Settings (radius, manual mode, etc.)
 * - The Firestore-based IDs (fetched from /api/dispatch/availability)
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
  
  // Dispatch system settings
  settings: {
    radiusMeters: number;
    manualSelectionMode: boolean;
  };

  // NEW: IDs that admin selected in Firestore
  firestoreAvailableCarIds: number[];
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
  
  // Initial settings
  settings: {
    radiusMeters: 50000, // Default 50km radius
    manualSelectionMode: false, // Default to automatic mode
  },

  // Start empty; we’ll fetch from Firestore
  firestoreAvailableCarIds: [],
};

/* ------------------------------------------------------------------
   1) Thunk: fetchAvailabilityFromFirestore
   Makes a GET request to /api/dispatch/availability.
   - If successful, we store the returned IDs in `firestoreAvailableCarIds`
   - Also, we cross-dispatch setAvailableForDispatch() with the matching cars
   ------------------------------------------------------------------ */
export const fetchAvailabilityFromFirestore = createAsyncThunk<
  number[],               // We return an array of IDs
  void,                   // No arguments
  { rejectValue: string; state: RootState }
>(
  "dispatch/fetchAvailabilityFromFirestore",
  async (_, { rejectWithValue, getState, dispatch }) => {
    try {
      // 1) Fetch from /api/dispatch/availability
      const res = await fetch("/api/dispatch/availability");
      if (!res.ok) {
        throw new Error(`Failed to fetch availability: ${res.statusText}`);
      }
      const data = await res.json() as {
        success: boolean;
        availableCarIds: number[];
        error?: string;
      };

      if (!data.success) {
        throw new Error(data.error || "Unknown error fetching availability");
      }

      // 2) We have a list of car IDs from Firestore
      const availableIds = data.availableCarIds;

      // 3) Use the current store's `cars` to figure out which Car objects match
      const state = getState();
      const allCars = state.car.cars; // from your carSlice
      const matchedCars = allCars.filter((c) => availableIds.includes(c.id));

      // 4) Set them as the official "availableForDispatch" in the car slice
      dispatch(setAvailableForDispatch(matchedCars));

      // 5) Return the IDs so we can store them in dispatchSlice too
      return availableIds;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

/* ------------------------------------------------------------------
   2) Thunk: fetchDispatchLocations (already existed)
   Example: returns a single dispatch location anchored at DISPATCH_HUB
   ------------------------------------------------------------------ */
export const fetchDispatchLocations = createAsyncThunk<
  DispatchLocation[],
  void,
  { rejectValue: string }
>("dispatch/fetchDispatchLocations", async (_, { rejectWithValue }) => {
  try {
    // Example
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

/* ------------------------------------------------------------------
   3) Thunk: fetchDispatchDirections (already existed)
   ------------------------------------------------------------------ */
export const fetchDispatchDirections = createAsyncThunk<
  RouteInfo,
  StationFeature,
  { rejectValue: string }
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

/* ------------------------------------------------------------------
   The slice itself
   ------------------------------------------------------------------ */
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
    
    /** Update dispatch radius setting */
    setDispatchRadius: (state, action: PayloadAction<number>) => {
      const newRadius = Number(action.payload);
      if (!isNaN(newRadius) && newRadius > 0) {
        state.settings.radiusMeters = newRadius;
        console.log(`[dispatchSlice] Radius updated in store to: ${newRadius}`);
      } else {
        console.warn(`[dispatchSlice] Invalid radius value: ${action.payload}`);
      }
    },
    
    /** Set manual selection mode */
    setManualSelectionMode: (state, action: PayloadAction<boolean>) => {
      state.settings.manualSelectionMode = action.payload;
      console.log(`[dispatchSlice] Manual selection mode set to: ${action.payload}`);
    },
  },
  extraReducers: (builder) => {
    // ------ fetchDispatchLocations ------
    builder
      .addCase(fetchDispatchLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDispatchLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.locations = action.payload;
      })
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

    // ------ fetchAvailabilityFromFirestore ------
    builder
      .addCase(fetchAvailabilityFromFirestore.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAvailabilityFromFirestore.fulfilled, (state, action) => {
        state.loading = false;
        state.firestoreAvailableCarIds = action.payload; // store these IDs
        console.log("[dispatchSlice] Updated Firestore-based availability in store:", action.payload);
      })
      .addCase(fetchAvailabilityFromFirestore.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default dispatchSlice.reducer;

/* ------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------ */
export const { 
  clearDispatchRoute, 
  openNewSheet, 
  closeSheet, 
  setDispatchRadius,
  setManualSelectionMode
} = dispatchSlice.actions;

/* ------------------------------------------------------------------
   Selectors
   ------------------------------------------------------------------ */
export const selectAllDispatchLocations = (state: RootState) => state.dispatch.locations;
export const selectDispatchLoading = (state: RootState) => state.dispatch.loading;
export const selectDispatchError = (state: RootState) => state.dispatch.error;

/** The route from dispatchHub → departure station */
export const selectDispatchRoute = (state: RootState) => state.dispatch.route2;
export const selectDispatchRouteStatus = (state: RootState) => state.dispatch.routeStatus;
export const selectDispatchRouteError = (state: RootState) => state.dispatch.routeError;

/** The open sheet state */
export const selectOpenSheet = (state: RootState) => state.dispatch.openSheet;

/** 
 * The dispatch radius setting with a fallback value of 50000 meters
 */
export const selectDispatchRadius = (state: RootState) =>
  state.dispatch?.settings?.radiusMeters || 50000;

/**
 * Selector for the manual selection mode setting
 */
export const selectManualSelectionMode = (state: RootState) =>
  state.dispatch?.settings?.manualSelectionMode || false;

/**
 * NEW: Selector for the Firestore-based IDs
 */
export const selectFirestoreAvailableCarIds = (state: RootState) =>
  state.dispatch.firestoreAvailableCarIds;

/* ------------------------------------------------------------------
   Memoized selector to decode the dispatch route polyline (if any)
   ------------------------------------------------------------------ */
export const selectDispatchRouteDecoded = createSelector(
  [selectDispatchRoute],
  (route) => {
    if (!route || !route.polyline) return [];
    if (!window.google?.maps?.geometry?.encoding) {
      return [];
    }
    const decodedPath = window.google.maps.geometry.encoding.decodePath(
      route.polyline
    );
    return decodedPath.map((latLng) => latLng.toJSON());
  }
);
