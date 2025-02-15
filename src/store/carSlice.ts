// src/store/carSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { fetchVehicleList } from "@/lib/cartrack";
import type { Car } from "@/types/cars";

// Define the shape of our CarState
interface CarState {
  cars: Car[];
  availableForDispatch: Car[];
  loading: boolean;
  error: string | null;
}

// Thunk to fetch cars and transform them
export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  "car/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      // rawVehicles is the array from /vehicles/status
      const rawVehicles = await fetchVehicleList();

      // Transform each raw vehicle into a Car
      const transformed: Car[] = rawVehicles.map((v: any) => {
        // If the API includes v.vehicle_id, v.registration, etc., map them here.
        // By the time data reaches here, `v.odometer` should already be in km.
        const odometerKm = v.odometer ?? 0;

        return {
          // Basic fields
          id: v.vehicle_id ?? 0,
          name: v.registration ?? "Unknown Vehicle",
          type: v.engine_type ?? "Unknown", // or "Electric" if you prefer
          price: 600,                       // Hard-coded example
          modelUrl: v.modelUrl,
          image: v.image,
          available: true,

          // Default features (can be customized if needed)
          features: {
            range: 0,
            charging: "",
            acceleration: "",
          },

          // Coordinates
          lat: v.lat ?? 0,
          lng: v.lng ?? 0,

          // Additional fields
          model: v.model ?? "Unknown Model", // Hardcoded as "MG4" in fetchVehicleList if you prefer
          year: v.year ?? 0,                // Hardcoded as 2023 in fetchVehicleList
          odometer: odometerKm,             // in km

          // New fields from the CarTrack response
          engine_type: v.engine_type ?? "",
          bearing: v.bearing ?? 0,
          speed: v.speed ?? 0,
          ignition: v.ignition ?? false,
          idling: v.idling ?? false,
          altitude: v.altitude ?? 0,
          temp1: v.temp1 ?? null,
          dynamic1: v.dynamic1 ?? null,
          dynamic2: v.dynamic2 ?? null,
          dynamic3: v.dynamic3 ?? null,
          dynamic4: v.dynamic4 ?? null,
          electric_battery_percentage_left: v.electric_battery_percentage_left ?? null,
          electric_battery_ts: v.electric_battery_ts ?? null,
          location_updated: v.location_updated ?? null,
          location_position_description: v.location_position_description ?? null,
        };
      });

      return transformed;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Initial state
const initialState: CarState = {
  cars: [],
  availableForDispatch: [],
  loading: false,
  error: null,
};

// Create the car slice
const carSlice = createSlice({
  name: "car",
  initialState,
  reducers: {
    // Example of a custom reducer for setting "availableForDispatch"
    setAvailableForDispatch(state, action: PayloadAction<Car[]>) {
      state.availableForDispatch = action.payload;
    },
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

// Export actions and reducer
export const { setAvailableForDispatch } = carSlice.actions;
export default carSlice.reducer;

// Selectors
export const selectAllCars = (state: RootState) => state.car.cars;
export const selectAvailableForDispatch = (state: RootState) => state.car.availableForDispatch;
export const selectCarsLoading = (state: RootState) => state.car.loading;
export const selectCarsError = (state: RootState) => state.car.error;
