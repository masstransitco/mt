"use client";

import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  createSelector,
} from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { selectUserLocation } from "./userSlice";

/**
 * A single station feature from /stations.geojson
 */
export interface StationFeature {
  drivingTime: any;
  type: "Feature";
  id: number;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    drivingTime: any;
    walkTime: number | undefined;
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
    ObjectId: number; // for any unique ID usage
  };
  distance?: number; 
  walkTime?: number; // in minutes
}

interface StationsState {
  /**
   * The full list of stations (for GMap usage).
   */
  items: StationFeature[];

  /**
   * A second array for a "paged" subset, used by StationList's infinite loader.
   */
  listStations: StationFeature[];

  page: number;      // current page index (1-based)
  pageSize: number;  // how many items per page (e.g. 12)
  hasMore: boolean;  // whether more stations remain to load

  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: StationsState = {
  items: [],
  listStations: [],
  page: 0,
  pageSize: 12,
  hasMore: false,

  loading: false,
  error: null,
  lastFetched: null,
};

/* ------------------------------------------------------
   Thunk #1: fetchStations
   ------------------------------------------------------ */
export const fetchStations = createAsyncThunk<
  { data: StationFeature[]; timestamp: number },
  void,
  { rejectValue: string }
>("stations/fetchStations", async (_, { rejectWithValue }) => {
  try {
    const cached = localStorage.getItem("stations");
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache valid for 1 hour
      if (Date.now() - timestamp < 3600000) {
        return { data, timestamp };
      }
    }

    // If no valid cache, fetch fresh data
    const response = await fetch("/stations.geojson");
    if (!response.ok) {
      throw new Error("Failed to fetch stations");
    }
    const data = await response.json();

    if (data.type === "FeatureCollection") {
      const features: StationFeature[] = data.features;
      localStorage.setItem(
        "stations",
        JSON.stringify({ data: features, timestamp: Date.now() })
      );
      return { data: features, timestamp: Date.now() };
    }
    throw new Error("Invalid data format");
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

/* ------------------------------------------------------
   Helper to build a bounding box around [lat, lng]
   ------------------------------------------------------ */
function createBoundingBox(lat: number, lng: number, delta = 0.1) {
  const west = lng - delta;
  const south = lat - delta;
  const east = lng + delta;
  const north = lat + delta;
  return `${west},${south},${east},${north}`;
}

/* ------------------------------------------------------
   Thunk #2: fetchStationVacancy (example)
   ------------------------------------------------------ */
export const fetchStationVacancy = createAsyncThunk<
  { stationId: number; newAvailable: number }, 
  number,                                     // stationId
  { rejectValue: string }
>(
  "stations/fetchStationVacancy",
  async (stationId, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      // We can look up from either `items` or `listStations`
      const station =
        state.stations.listStations.find((s) => s.id === stationId) ||
        state.stations.items.find((s) => s.id === stationId);

      if (!station) {
        throw new Error(`Station #${stationId} not found`);
      }

      const [lng, lat] = station.geometry.coordinates;
      const bbox = createBoundingBox(lat, lng, 0.01);

      // Example endpoint with limit=1
      const url = `https://resource.data.one.gov.hk/td/carpark/vacancy?bbox=${bbox}&limit=1`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Vacancy request failed with status ${resp.status}`);
      }
      const data = await resp.json();

      if (!data.results || data.results.length === 0) {
        // fallback if none found
        return { stationId, newAvailable: station.properties.availableSpots };
      }
      const first = data.results[0];
      const newAvailable = first.vacancy ?? station.properties.availableSpots;

      return { stationId, newAvailable };
    } catch (err: any) {
      console.error(err);
      return rejectWithValue(err.message);
    }
  }
);

/* --------------------------- Slice --------------------------- */
const stationsSlice = createSlice({
  name: "stations",
  initialState,
  reducers: {
    /**
     * Load next 12 items into `listStations`.
     * If we run out, set hasMore=false.
     */
    loadNextStationsPage(state) {
      if (!state.hasMore) return;

      const nextPage = state.page + 1;
      const startIndex = state.page * state.pageSize; // zero-based
      const endIndex = nextPage * state.pageSize;

      // slice from items => next chunk
      const more = state.items.slice(startIndex, endIndex);
      state.listStations = [...state.listStations, ...more];
      state.page = nextPage;

      // if we've used up all stations, hasMore=false
      if (endIndex >= state.items.length) {
        state.hasMore = false;
      }
    },
  },
  extraReducers: (builder) => {
    // fetchStations
    builder
      .addCase(fetchStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchStations.fulfilled,
        (state, action: PayloadAction<{ data: StationFeature[]; timestamp: number }>) => {
          state.loading = false;
          state.error = null;
          state.lastFetched = action.payload.timestamp;

          // Put them all in `items`
          state.items = action.payload.data;

          // Initialize paging
          state.page = 1;
          const end = state.pageSize; // 12
          state.listStations = state.items.slice(0, end);
          // if still more left, set hasMore=true
          state.hasMore = end < state.items.length;
        }
      )
      .addCase(fetchStations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // fetchStationVacancy
    builder
      .addCase(fetchStationVacancy.fulfilled, (state, action) => {
        const { stationId, newAvailable } = action.payload;
        // update in items
        const st1 = state.items.find((s) => s.id === stationId);
        if (st1) {
          st1.properties.availableSpots = newAvailable;
        }
        // also update in listStations if present
        const st2 = state.listStations.find((s) => s.id === stationId);
        if (st2) {
          st2.properties.availableSpots = newAvailable;
        }
      })
      .addCase(fetchStationVacancy.rejected, (state, action) => {
        console.error("Station vacancy fetch error:", action.payload);
      });
  },
});

export const { loadNextStationsPage } = stationsSlice.actions;
export default stationsSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;

/** 
 * For GMap: returns all stations, unsliced. 
 * If you want them distance-sorted, you can do a separate "withDistance" version.
 */
export const selectAllStations = (state: RootState) => state.stations.items;

/** 
 * For the list: returns only the paged subset (12, 24, 36, etc).
 */
export const selectPagedStations = (state: RootState) => state.stations.listStations;

export const selectHasMoreStations = (state: RootState) => state.stations.hasMore;

/**
 * Basic Haversine formula to compute distance (in km).
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * For GMap usage: all stations, distance-sorted
 */
export const selectStationsWithDistance = createSelector(
  [selectAllStations, selectUserLocation],
  (stations, userLocation) => {
    if (!userLocation) return stations;
    const { lat: userLat, lng: userLng } = userLocation;

    const MIN_PER_KM = 12;
    return stations
      .map((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const dist = calculateDistance(userLat, userLng, lat, lng);
        const walkTime = Math.round(dist * MIN_PER_KM);
        return { ...station, distance: dist, walkTime };
      })
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
);

/**
 * For StationList usage: the PAGED subset, distance-sorted
 */
export const selectListStationsWithDistance = createSelector(
  [selectPagedStations, selectUserLocation],
  (stations, userLocation) => {
    if (!userLocation) return stations;
    const { lat: userLat, lng: userLng } = userLocation;

    const MIN_PER_KM = 12;
    return stations
      .map((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const dist = calculateDistance(userLat, userLng, lat, lng);
        const walkTime = Math.round(dist * MIN_PER_KM);
        return { ...station, distance: dist, walkTime };
      })
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
);
