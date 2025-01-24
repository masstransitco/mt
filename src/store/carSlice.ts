import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from '@reduxjs/toolkit';
import type { RootState } from './store';
import { fetchVehicleList } from '@/lib/cartrack'; // your updated cartrack.ts
import type { Car } from '@/types/cars';

/**
 * Car slice state
 */
interface CarState {
  cars: Car[];
  loading: boolean;
  error: string | null;
}

/**
 * Thunk: fetch cars from Cartrack
 */
export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  'car/fetchCars',
  async (_, { rejectWithValue }) => {
    try {
      // 1) Fetch the raw Cartrack data
      //    e.g., each vehicle is: { id, model, registration, lat, lng, ... }
      //    because we extracted lat/lng in cartrack.ts
      const rawVehicles = await fetchVehicleList();

      // 2) Transform raw Cartrack data to our Car interface
      const transformed: Car[] = rawVehicles.map((v: any) => {
        // Use v.model if present, or fallback to registration, etc.
        const displayName = v.model ?? v.registration ?? 'Unknown Vehicle';

        return {
          id: v.id,
          name: displayName,
          type: 'Electric',       // or parse from Cartrack if available
          price: 600,            // sample default
          modelUrl: v.modelUrl,  // .glb from local mapping
          image: v.image,        // .png from local mapping
          available: true,       // WIP: logic for availability
          features: {
            range: 0,
            charging: '',
            acceleration: '',
          },
          // lat/long already attached from the transform in cartrack.ts
          lat: v.lat,
          lng: v.lng,
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
