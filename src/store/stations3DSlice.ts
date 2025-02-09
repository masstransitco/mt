// src/store/stations3DSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

/** A single 3D feature from stations_3d.geojson */
export interface Station3DFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon'; 
    coordinates: number[][][]; 
    /* e.g. [
        [
          [lng1, lat1], [lng2, lat2], ...
        ]
      ]
    */
  };
  properties: {
    ObjectId: number; // Must match station.properties.ObjectId in stations.geojson
    // ... any other fields you need
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
 * Thunk to fetch stations_3d.geojson. 
 * You can also add caching logic if desired, 
 * similar to the existing stationsSlice.
 */
export const fetchStations3D = createAsyncThunk<
  Station3DFeature[], // success payload
  void,               // no args
  { rejectValue: string }
>(
  'stations3D/fetchStations3D',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/stations_3d.geojson');
      if (!response.ok) {
        throw new Error(`Failed to fetch 3D stations`);
      }
      const data = await response.json();
      if (data.type !== 'FeatureCollection' || !data.features) {
        throw new Error('Invalid 3D geojson format');
      }
      return data.features as Station3DFeature[];
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const stations3DSlice = createSlice({
  name: 'stations3D',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations3D.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStations3D.fulfilled, (state, action: PayloadAction<Station3DFeature[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
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
