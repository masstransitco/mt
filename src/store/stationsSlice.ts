// stationsSlice.ts

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';

/* --------------------------- Interfaces --------------------------- */
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
  distance?: number; // Distance in kilometers from the user's location
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
  isSheetMinimized: false,
};

/* --------------------------- Thunks --------------------------- */

// Async thunk to fetch stations data with caching to localStorage
export const fetchStations = createAsyncThunk<
  { data: StationFeature[]; timestamp: number },
  void,
  { rejectValue: string }
>(
  'stations/fetchStations',
  async (_, { rejectWithValue }) => {
    try {
      const cached = localStorage.getItem('stations');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache validity: 1 hour
        if (Date.now() - timestamp < 3600000) {
          return { data, timestamp };
        }
      }

      const response = await fetch('/stations.geojson'); // Replace with your actual API endpoint
      if (!response.ok) {
        throw new Error('Failed to fetch stations');
      }
      const data = await response.json();

      if (data.type === 'FeatureCollection') {
        const features: StationFeature[] = data.features;
        localStorage.setItem(
          'stations',
          JSON.stringify({
            data: features,
            timestamp: Date.now(),
          })
        );
        return { data: features, timestamp: Date.now() };
      }
      throw new Error('Invalid data format');
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/* --------------------------- Slice --------------------------- */
const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {
    // Set the user's current location
    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },
    // Toggle the minimization state of the sheet
    toggleSheet: (state) => {
      state.isSheetMinimized = !state.isSheetMinimized;
    },
    // Note: The `updateDistances` reducer has been removed to maintain reducer purity
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStations.fulfilled, (state, action: PayloadAction<{ data: StationFeature[]; timestamp: number }>) => {
        state.loading = false;
        state.items = action.payload.data;
        state.lastFetched = action.payload.timestamp;
      })
      .addCase(fetchStations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setUserLocation, toggleSheet } = stationsSlice.actions;

export default stationsSlice.reducer;

/* --------------------------- Selectors --------------------------- */

// Basic selectors
export const selectAllStations = (state: RootState) => state.stations.items;
export const selectStationsLoading = (state: RootState) => state.stations.loading;
export const selectStationsError = (state: RootState) => state.stations.error;
export const selectUserLocation = (state: RootState) => state.stations.userLocation;
export const selectIsSheetMinimized = (state: RootState) => state.stations.isSheetMinimized;

/* ----------------------- Haversine Formula ----------------------- */

// Define an interface for coordinates
interface Coordinates {
  lat: number;
  lng: number;
}

// Haversine formula to calculate distance between two coordinates in kilometers
const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

/* ----------------- Memoized Selector with Reselect ----------------- */

/**
 * Selector to get all stations with calculated distances from the user's location.
 * This selector is memoized and will only recompute when `items` or `userLocation` change.
 */
export const selectStationsWithDistance = createSelector(
  [selectAllStations, selectUserLocation],
  (stations, userLocation) => {
    if (!userLocation) return stations;

    const userCoord: Coordinates = { lat: userLocation.lat, lng: userLocation.lng };

    return stations
      .map((station) => {
        const [lng, lat] = station.geometry.coordinates;
        const stationCoord: Coordinates = { lat, lng };
        const distance = calculateDistance(userCoord, stationCoord);
        return { ...station, distance };
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }
);