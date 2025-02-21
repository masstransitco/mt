// src/store/stationsSlice.ts
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
 * (now extended with 'distance' and 'walkTime' fields).
 */
export interface StationFeature {
  type: "Feature";
  id: number;
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
    /** 
     * Added ObjectId here so code referencing 
     * station.properties.ObjectId compiles 
     */
    ObjectId: number;
  };
  /** Distance from user's location (in km), computed later */
  distance?: number;
  /** Estimated walking time in minutes, computed locally */
  walkTime?: number;
}

interface StationsState {
  items: StationFeature[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: StationsState = {
  items: [],
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
  // The resource.data.one.gov.hk expects “west,south,east,north”
  return `${west},${south},${east},${north}`;
}

/* ------------------------------------------------------
   Thunk #2: fetchStationVacancy
   ------------------------------------------------------ */
export const fetchStationVacancy = createAsyncThunk<
  { stationId: number; newAvailable: number }, // success payload
  number,                                     // stationId arg
  { rejectValue: string }
>(
  "stations/fetchStationVacancy",
  async (stationId, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const station = state.stations.items.find((s) => s.id === stationId);
      if (!station) {
        throw new Error(`Station #${stationId} not found`);
      }

      const [lng, lat] = station.geometry.coordinates;
      // Build bounding box around this station’s lat/lng
      const bbox = createBoundingBox(lat, lng, 0.01); // delta=0.01 => ~±1km

      // Example endpoint with limit=1
      const url = `https://resource.data.one.gov.hk/td/carpark/vacancy?bbox=${bbox}&limit=1`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Vacancy request failed with status ${resp.status}`);
      }
      const data = await resp.json();

      // Example parse logic:
      if (!data.results || data.results.length === 0) {
        // fallback if none found
        return { stationId, newAvailable: station.properties.availableSpots };
      }
      // We'll take the first result
      const first = data.results[0];
      // Suppose “vacancy” is the # of free spots
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
  reducers: {},
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
          state.items = action.payload.data;
          state.lastFetched = action.payload.timestamp;
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
        const st = state.items.find((s) => s.id === stationId);
        if (st) {
          st.properties.availableSpots = newAvailable;
        }
      })
      .addCase(fetchStationVacancy.rejected, (state, action) => {
        console.error("Station vacancy fetch error:", action.payload);
      });
  },
});

export default stationsSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectAllStations = (state: RootState) => state.stations.items;
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;

/**
 * Basic Haversine formula to compute distance (in km) between two lat/lng points.
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
 * Memoized selector:
 * 1) Sorts stations by distance from userLocation
 * 2) Also sets an approximate walkTime in minutes, 
 *    assuming ~12 min per km speed
 */
export const selectStationsWithDistance = createSelector(
  [selectAllStations, selectUserLocation],
  (stations, userLocation) => {
    if (!userLocation) return stations;

    const { lat: userLat, lng: userLng } = userLocation;
    const MIN_PER_KM = 12; // walk pace => 12 min per km

    return stations
      .map((station) => {
        const [stationLng, stationLat] = station.geometry.coordinates;
        const distance = calculateDistance(
          userLat,
          userLng,
          stationLat,
          stationLng
        );
        // distance => in km
        // walkTime => distance * 12, then round
        const walkTime = Math.round(distance * MIN_PER_KM);

        return {
          ...station,
          distance,
          walkTime,
        };
      })
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
);
