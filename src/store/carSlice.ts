import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { fetchVehicleList } from "@/lib/cartrack";
import type { Car } from "@/types/cars";

interface CarState {
  cars: Car[];
  availableForDispatch: Car[];
  loading: boolean;
  error: string | null;
}

export const fetchCars = createAsyncThunk<Car[], void, { rejectValue: string }>(
  "car/fetchCars",
  async (_, { rejectWithValue }) => {
    try {
      const rawVehicles = await fetchVehicleList();

      const transformed: Car[] = rawVehicles.map((v: any) => {
        const carId = v.id ?? v.registration ?? v.model;
        const displayName = v.model ?? v.registration ?? "Unknown Vehicle";
        return {
          id: carId,
          name: displayName,
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
          lat: v.lat,
          lng: v.lng,

          // NEW FIELDS
          model: v.model ?? "Unknown Model",
          year: v.year ?? 0,
          odometer: v.odometer ?? 0,
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
  availableForDispatch: [],
  loading: false,
  error: null,
};

const carSlice = createSlice({
  name: "car",
  initialState,
  reducers: {
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

export const { setAvailableForDispatch } = carSlice.actions;
export default carSlice.reducer;

// Selectors
export const selectAllCars = (state: RootState) => state.car.cars;
export const selectAvailableForDispatch = (state: RootState) =>
  state.car.availableForDispatch;
export const selectCarsLoading = (state: RootState) => state.car.loading;
export const selectCarsError = (state: RootState) => state.car.error;
