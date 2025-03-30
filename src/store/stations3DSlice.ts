// src/store/stations3DSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";

/** A single 3D feature from stations_3d.geojson */
export interface Station3DFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    ObjectId: number;
    Place?: string;
    Address?: string;
    District?: string;
    topHeight?: number | null; // We'll store the parsed building height here
    // Add additional known fields as needed:
    Sheet_No?: string;
    Format_3DS?: string;
    Format_FBX?: string;
    Format_MAX?: string;
    Format_VRML?: string;
    // And if you want to allow any unrecognized fields:
    [key: string]: unknown;
  };
}

interface Stations3DState {
  items: Station3DFeature[];
  loading: boolean;
  error: string | null;
}

const initialState: Stations3DState = {
  items: [],
  loading: false,
  error: null,
};

/** 
 * Helper to parse the raw TOPHEIGHT (which might be a string like "[np.float64(98.4)]")
 * into a numeric value. Returns null if it’s missing or unparseable.
 */
function parseTopHeight(raw: unknown): number | null {
  if (!raw) return null;
  // Convert to string and extract a numeric substring:
  // e.g. "[np.float64(98.4)]" -> "98.4"
  const match = String(raw).match(/([\d.]+)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/**
 * Thunk to fetch stations_3d.geojson. 
 * You can also add caching logic if desired, 
 * similar to the existing stationsSlice.
 */
export const fetchStations3D = createAsyncThunk<
  Station3DFeature[], // success payload
  void,               // no args
  { rejectValue: string }
>(
  "stations3D/fetchStations3D",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("/api/stations3d");
      if (!response.ok) {
        throw new Error(`Failed to fetch 3D stations`);
      }
      const data = await response.json();
      if (data.type !== "FeatureCollection" || !data.features) {
        throw new Error("Invalid 3D geojson format");
      }

      // Transform each feature to include a numeric topHeight
      const cleanedFeatures = data.features.map((f: any) => {
        const topHeight = parseTopHeight(f.properties?.TOPHEIGHT);

        return {
          ...f,
          properties: {
            ...f.properties,
            topHeight, // numeric or null
          },
        };
      });

      return cleanedFeatures as Station3DFeature[];
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const stations3DSlice = createSlice({
  name: "stations3D",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations3D.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchStations3D.fulfilled,
        (state, action: PayloadAction<Station3DFeature[]>) => {
          state.loading = false;
          state.items = action.payload;
        }
      )
      .addCase(fetchStations3D.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default stations3DSlice.reducer;

// SELECTORS
export const selectStations3DLoading = (state: RootState) => state.stations3D.loading;
export const selectStations3DError = (state: RootState) => state.stations3D.error;
export const selectStations3D = (state: RootState) => state.stations3D.items;