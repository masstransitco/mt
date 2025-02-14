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

// Fetch cars from the API, transform them to match the Car interface
export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  "car/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      // rawVehicles will be the array of vehicles from /rest/vehicles
      const rawVehicles = await fetchVehicleList();

      // Transform each raw vehicle into a Car
      const transformed: Car[] = rawVehicles.map((v: any) => {
        // Convert odometer from meters → kilometers
        const odometerKm = v.odometer ? Math.round(v.odometer / 1000) : 0;

        // We assume the API returns: v.vehicle_id, v.registration, v.manufacturer,
        // v.model_year, v.location?.latitude, v.location?.longitude, etc.
        // If your API uses different fields, adjust as needed.
        return {
          id: v.vehicle_id ?? 0,
          name: v.registration ?? "Unknown Vehicle",
          type: "Electric",
          price: 600,
          modelUrl: v.modelUrl,
          image: v.image,
          available: true,
          features: {
            range: 0,
            charging: "",
            acceleration: "",
          },
          lat: v.location?.latitude ?? 0,
          lng: v.location?.longitude ?? 0,

          // Additional fields for model, year, odometer
          model: v.manufacturer ?? "Unknown Model",
          year: v.model_year ?? 0,
          odometer: odometerKm,
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

// Selector helpers
export const selectAllCars = (state: RootState) => state.car.cars;
export const selectAvailableForDispatch = (state: RootState) => state.car.availableForDispatch;
export const selectCarsLoading = (state: RootState) => state.car.loading;
export const selectCarsError = (state: RootState) => state.car.error;
