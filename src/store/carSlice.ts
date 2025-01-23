// src/store/carSlice.ts

import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from '@reduxjs/toolkit';
import type { RootState } from './store';

/**
 * Represents a car object.
 */
export interface Car {
  id: number;
  name: string;
  type: string;      // e.g. "electric", "hybrid", ...
  price: number;
  image: string;     // URL to car image
  modelUrl?: string; // 3D model if available
  features?: {
    range?: number;
    charging?: string;
  };
}

interface CarState {
  cars: Car[];
  loading: boolean;
  error: string | null;
}

/* --------------------------- Thunk --------------------------- */
/**
 * Example of fetching a list of cars from an API endpoint.
 * Adjust the URL or logic to your actual needs.
 */
export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  'car/fetchCars',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/cars');
      if (!response.ok) {
        throw new Error('Failed to fetch cars');
      }
      const data = await response.json();
      return data as Car[];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState: CarState = {
  cars: [],
  loading: false,
  error: null,
};

const carSlice = createSlice({
  name: 'car',
  initialState,
  reducers: {
    // Add domain-specific car reducers if needed
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCars.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCars.fulfilled, (state, action: PayloadAction<Car[]>) => {
        state.loading = false;
        state.cars = action.payload;
      })
      .addCase(fetchCars.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default carSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectAllCars = (state: RootState) => state.car.cars;
export const selectCarsLoading = (state: RootState) => state.car.loading;
export const selectCarsError = (state: RootState) => state.car.error;
