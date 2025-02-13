import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { fetchVehicleList } from "@/lib/cartrack";
import type { Car } from "@/types/cars";

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
  "car/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      const rawVehicles = await fetchVehicleList();

      // Transform raw Cartrack data to our Car interface
      const transformed: Car[] = rawVehicles.map((v: any) => {
        // We prefer a numeric id if it exists;
        // otherwise fall back to 'registration' or 'model'
        const carId = v.id ?? v.registration ?? v.model;
        // If carId is a string but your Car interface expects a number,
        // you can either generate a numeric ID or switch Car.id to string.
        // Example: const carId = v.id ?? (v.registration ? hashOf(v.registration) : someFallbackNumber)

        // displayName used for the car's name field
        const displayName = v.model ?? v.registration ?? "Unknown Vehicle";

        return {
          id: carId,
          name: displayName,
          type: "Electric", // or parse from v.type if available
          price: 600,       // sample default
          modelUrl: v.modelUrl, // if you have a local .glb path
          image: v.image,       // local .png path or URL
          available: true,      // WIP: logic for availability
          features: {
            range: 0,
            charging: "",
            acceleration: "",
          },
          // lat/long from your transform (if you set them in cartrack.ts)
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
  name: "car",
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
