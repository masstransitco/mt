import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { DISPATCH_HUB } from "@/constants/map";

interface DispatchLocation {
  id: number;
  lat: number;
  lng: number;
}

interface DispatchState {
  locations: DispatchLocation[];
  loading: boolean;
  error: string | null;
}

const initialState: DispatchState = {
  locations: [],
  loading: false,
  error: null,
};

export const fetchDispatchLocations = createAsyncThunk<DispatchLocation[], void, { rejectValue: string }>(
  "dispatch/fetchDispatchLocations",
  async (_, { rejectWithValue }) => {
    try {
      const locations = [
        {
          id: 1,
          lat: DISPATCH_HUB.lat,
          lng: DISPATCH_HUB.lng,
        },
      ];
      return locations;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const dispatchSlice = createSlice({
  name: "dispatch",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDispatchLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDispatchLocations.fulfilled, (state, action: PayloadAction<DispatchLocation[]>) => {
        state.loading = false;
        state.locations = action.payload;
      })
      .addCase(fetchDispatchLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default dispatchSlice.reducer;

// Selectors
export const selectAllDispatchLocations = (state: RootState) => state.dispatch.locations;
export const selectDispatchLoading = (state: RootState) => state.dispatch.loading;
export const selectDispatchError = (state: RootState) => state.dispatch.error;
