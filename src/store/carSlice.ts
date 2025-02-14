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
        // If the API includes v.vehicle_id, v.registration, etc., map them here
        // Convert odometer from meters → kilometers if not already done
        const odometerKm = v.odometer ? v.odometer : 0; // it's already km if we did it above

        return {
          // We'll assume the 'vehicle_id' is the unique ID
          id: v.vehicle_id ?? 0,
          // name from v.registration or fallback
          name: v.registration ?? "Unknown Vehicle",
          // EV type (or "Unknown" if you prefer)
          type: "Electric",
          // hard-coded price example
          price: 600,

          // local assets or from the API
          modelUrl: v.modelUrl,
          image: v.image,
          available: true,

          // default features
          features: {
            range: 0,
            charging: "",
            acceleration: "",
          },

          // lat/lng from the v.location (already extracted in fetchVehicleList)
          lat: v.lat ?? 0,
          lng: v.lng ?? 0,

          // Additional fields
          model: v.model ?? "Unknown Model",     // was v.manufacturer if needed
          year: v.year ?? 0,                     // was v.model_year
          odometer: odometerKm,                  // in km
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
