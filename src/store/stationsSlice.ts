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
}

const initialState: StationsState = {
  items: [],
  loading: false,
  error: null,
  lastFetched: null
};

// Async thunk for fetching stations
export const fetchStations = createAsyncThunk(
  'stations/fetchStations',
  async (_, { rejectWithValue }) => {
    try {
      const cached = localStorage.getItem('stations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
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

// Update stations with distances
export const updateStationDistances = createAsyncThunk(
  'stations/updateDistances',
  async (userLocation: google.maps.LatLngLiteral, { getState }) => {
    const state = getState() as RootState;
    const stations = state.stations.items;

    const updatedStations = stations.map(station => {
      const [lng, lat] = station.geometry.coordinates;
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        lat,
        lng
      );
      return { ...station, distance };
    }).sort((a, b) => (a.distance || 0) - (b.distance || 0));

    return updatedStations;
  }
);

const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {},
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
      })
      .addCase(updateStationDistances.fulfilled, (state, action) => {
        state.items = action.payload;
      });
  }
});

export default stationsSlice.reducer;

// Selectors
export const selectAllStations = (state: RootState) => state.stations.items;
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;
export const selectStationById = (id: number) => (state: RootState) => 
  state.stations.items.find(station => station.id === id);

// Helper function for distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!google?.maps?.geometry?.spherical) return 0;
  const from = new google.maps.LatLng(lat1, lon1);
  const to = new google.maps.LatLng(lat2, lon2);
  return google.maps.geometry.spherical.computeDistanceBetween(from, to) / 1000;
}
