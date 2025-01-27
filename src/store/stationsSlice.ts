import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  createSelector,
} from '@reduxjs/toolkit';
import type { RootState } from './store';
import { selectUserLocation } from './userSlice';

/**
 * A single station feature from /stations.geojson
 * (optionally extended with a 'distance' property later).
 */
export interface StationFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    Place: string;
    Address: string;
    maxPower: number;
    totalSpots: number;
    availableSpots: number;
    waitTime?: number;
  };
  distance?: number; // Distance from user's location, computed later
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

/* --------------------------- Thunks --------------------------- */
/**
 * 1) Checks localStorage for a cached stations list.
 * 2) If it's older than 1 hour or not present, fetch from /stations.geojson.
 * 3) Dispatches either fulfilled or rejected depending on success.
 */
export const fetchStations = createAsyncThunk<
  { data: StationFeature[]; timestamp: number },
  void,
  { rejectValue: string }
>('stations/fetchStations', async (_, { rejectWithValue }) => {
  try {
    const cached = localStorage.getItem('stations');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache valid for 1 hour
      if (Date.now() - timestamp < 3600000) {
        return { data, timestamp };
      }
    }

    // If no valid cache, fetch fresh data
    const response = await fetch('/stations.geojson');
    if (!response.ok) {
      throw new Error('Failed to fetch stations');
    }
    const data = await response.json();

    if (data.type === 'FeatureCollection') {
      const features: StationFeature[] = data.features;
      localStorage.setItem(
        'stations',
        JSON.stringify({ data: features, timestamp: Date.now() })
      );
      return { data: features, timestamp: Date.now() };
    }
    throw new Error('Invalid data format');
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

/* --------------------------- Slice --------------------------- */
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
  },
});

export default stationsSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectAllStations = (state: RootState) => state.stations.items;
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;

/**
 * Basic Haversine formula to compute distance between two lat/lng points.
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
 * Sorts stations by distance from the user's location if available.
 */
export const selectStationsWithDistance = createSelector(
  [selectAllStations, selectUserLocation],
  (stations, userLocation) => {
    if (!userLocation) return stations;

    const { lat: userLat, lng: userLng } = userLocation;
    return stations
      .map((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const distance = calculateDistance(userLat, userLng, lat, lng);
        return { ...station, distance };
      })
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }
);
