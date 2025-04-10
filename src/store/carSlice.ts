// src/store/carSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import type { Car } from "@/types/cars";
import { fetchVehicleList } from "@/lib/cartrack";

/**
 * The shape of our CarState in Redux.
 */
interface CarState {
  cars: Car[];
  availableForDispatch: Car[];
  loading: boolean;
  error: string | null;
  scannedCar: Car | null; // Track the currently scanned car from QR code
}

/**
 * Thunk: fetchCars
 *  - calls fetchVehicleList()
 *  - transforms raw vehicles into our Car interface
 */
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

        const car: Car = {
          // Basic fields
          id: v.vehicle_id ?? 0, // numeric
          name: v.registration ?? "Unknown Vehicle",
          type: v.engine_type ?? "Unknown",
          price: 600, // Hard-coded example
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
          model: v.model ?? "Unknown Model",
          year: v.year ?? 0,
          odometer: odometerKm,
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

        // ------
        // OVERRIDE for "NY6662"
        // ------
        if (car.name === "NY6662") {
          car.model = "Hyundai Kona";
          car.year = 2020;
          car.modelUrl = "/cars/kona.glb";
        }

        return car;
      });

      return transformed;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Thunk to fetch a specific car by registration
 */
export const fetchCarByRegistration = createAsyncThunk<
  Car | null,
  string,
  { rejectValue: string; state: RootState }
>(
  "car/fetchCarByRegistration",
  async (registration, { getState, rejectWithValue }) => {
    try {
      // First check if the car is already in our state
      const state = getState();
      const existingCar = state.car.cars.find(
        c => c.name.toUpperCase() === registration.toUpperCase()
      );
      
      if (existingCar) {
        return existingCar;
      }
      
      // If not, fetch it from the API
      const result = await fetchVehicleList({ registration });
      
      if (!result || result.length === 0) {
        return null;
      }
      
      // Transform the raw vehicle to our Car model
      const v = result[0];
      const odometerKm = v.odometer ?? 0;
      
      const car: Car = {
        // Basic fields
        id: v.vehicle_id ?? 0,
        name: v.registration ?? registration,
        type: v.engine_type ?? "Unknown",
        price: 600,
        modelUrl: v.modelUrl ?? "/cars/defaultModel.glb",
        image: v.image,
        available: true,

        // Default features
        features: {
          range: 0,
          charging: "",
          acceleration: "",
        },

        // Coordinates
        lat: v.lat ?? 0,
        lng: v.lng ?? 0,

        // Additional fields
        model: v.model ?? "Unknown Model",
        year: v.year ?? 0,
        odometer: odometerKm,
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
      
      // Add OVERRIDE logic if needed (same as in fetchCars)
      if (car.name === "NY6662") {
        car.model = "Hyundai Kona";
        car.year = 2020;
        car.modelUrl = "/cars/kona.glb";
      }
      
      return car;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Initial Redux state for cars
 */
const initialState: CarState = {
  cars: [],
  availableForDispatch: [],
  loading: false,
  error: null,
  scannedCar: null,
};

/**
 * The Car slice
 */
const carSlice = createSlice({
  name: "car",
  initialState,
  reducers: {
    // Example of a custom reducer for setting "availableForDispatch"
    setAvailableForDispatch(state, action: PayloadAction<Car[]>) {
      state.availableForDispatch = action.payload;
    },
    
    // Set the scanned car from QR code
    setScannedCar(state, action: PayloadAction<Car | null>) {
      state.scannedCar = action.payload;
    },
    
    // Clear the scanned car
    clearScannedCar(state) {
      state.scannedCar = null;
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
      })
      // Handle fetchCarByRegistration
      .addCase(fetchCarByRegistration.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCarByRegistration.fulfilled, (state, action) => {
        state.loading = false;
        // If we found a car, add it to the list if not already there
        if (action.payload) {
          const exists = state.cars.some(car => car.id === action.payload?.id);
          if (!exists) {
            state.cars.push(action.payload);
          }
          // Also set it as the scanned car
          state.scannedCar = action.payload;
        }
      })
      .addCase(fetchCarByRegistration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions and reducer
export const { 
  setAvailableForDispatch,
  setScannedCar,
  clearScannedCar
} = carSlice.actions;

export default carSlice.reducer;

/**
 * Car selectors
 */
export const selectAllCars = (state: RootState) => state.car.cars;
export const selectAvailableForDispatch = (state: RootState) =>
  state.car.availableForDispatch;
export const selectCarsLoading = (state: RootState) => state.car.loading;
export const selectCarsError = (state: RootState) => state.car.error;
export const selectScannedCar = (state: RootState) => state.car.scannedCar;
