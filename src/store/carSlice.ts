// src/store/carSlice.ts

import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from '@reduxjs/toolkit';
import type { RootState } from './store';
import { fetchVehicleList } from '@/lib/cartrack'; // <-- from your cartrack.ts
import type { Car } from '@/types/cars'

// Car slice state
interface CarState {
  cars: Car[];
  loading: boolean;
  error: string | null;
}

// Thunk: fetch cars from Cartrack
export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  'car/fetchCars',
  async (_, { rejectWithValue }) => {
    try {
      // 1) Fetch the raw Cartrack data
      //    e.g., each vehicle might be: { id, registration, last_position: { lat, lng }, ... }
      const rawVehicles = await fetchVehicleList();

      // 2) Transform raw Cartrack data to our Car interface
      const transformed: Car[] = rawVehicles.map((v: any) => {
        return {
          id: v.id,
          name: v.registration ?? 'Unknown Vehicle',
          type: Electric,
          price: 600,                  // If not provided by Cartrack, default to 0 or parse
          modelUrl: v.modelUrl, // local .glb from the transform
          image: v.image,       // local .png from the transform
          available: true, // WIP integrate with cartrack.ts to fetch availability based on tbd calculations
          features: {
            range: 0,                // Fill in from v if available
            charging: '',
            acceleration: '', // Supply a default
          },
          // The key part: lat/long from the vehicle’s last known position
          lat: v?.last_position?.lat ?? 0,
          lng: v?.last_position?.lng ?? 0,
        };
      });

      return transformed;
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
