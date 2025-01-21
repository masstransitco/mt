import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
  };
  distance?: number;
}

interface StationsState {
  items: StationFeature[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  userLocation: google.maps.LatLngLiteral | null;
  isSheetMinimized: boolean;
}

const initialState: StationsState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null,
  userLocation: null,
  isSheetMinimized: false
};

export const fetchStations = createAsyncThunk(
  'stations/fetchStations',
  async (_, { rejectWithValue }) => {
    try {
      const cached = localStorage.getItem('stations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) {
          return { data, timestamp };
        }
      }

      const response = await fetch('/stations.geojson');
      if (!response.ok) {
        throw new Error('Failed to fetch stations');
      }
      const data = await response.json();
      
      if (data.type === 'FeatureCollection') {
        localStorage.setItem(
          'stations',
          JSON.stringify({
            data: data.features,
            timestamp: Date.now(),
          })
        );
        return { data: data.features, timestamp: Date.now() };
      }
      throw new Error('Invalid data format');
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {
    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },
    toggleSheet: (state) => {
      state.isSheetMinimized = !state.isSheetMinimized;
    },
    updateDistances: (state) => {
      if (!state.userLocation) return;
      
      state.items = state.items.map(station => {
        const [lng, lat] = station.geometry.coordinates;
        if (!google?.maps?.geometry?.spherical) return station;
        
        const from = new google.maps.LatLng(state.userLocation!.lat, state.userLocation!.lng);
        const to = new google.maps.LatLng(lat, lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(from, to) / 1000;
        
        return { ...station, distance };
      }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.lastFetched = action.payload.timestamp;
      })
      .addCase(fetchStations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setUserLocation, toggleSheet, updateDistances } = stationsSlice.actions;

export default stationsSlice.reducer;

// Selectors
export const selectAllStations = (state: RootState) => state.stations.items;
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;
export const selectUserLocation = (state: RootState) => state.stations.userLocation;
export const selectIsSheetMinimized = (state: RootState) => state.stations.isSheetMinimized;
