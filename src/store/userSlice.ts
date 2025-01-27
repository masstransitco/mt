// userSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface UserState {
  selectedCarId: number | null;
  // Now we track both departure and arrival station IDs
  departureStationId: number | null;
  arrivalStationId: number | null;
  userLocation: google.maps.LatLngLiteral | null;
}

const initialState: UserState = {
  selectedCarId: null,
  departureStationId: null,
  arrivalStationId: null,
  userLocation: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },

    /**
     * For clarity, we make separate actions:
     * selectDepartureStation and selectArrivalStation
     */
    selectDepartureStation: (state, action: PayloadAction<number | null>) => {
      state.departureStationId = action.payload;
    },
    selectArrivalStation: (state, action: PayloadAction<number | null>) => {
      state.arrivalStationId = action.payload;
    },

    setUserLocation: (
      state,
      action: PayloadAction<google.maps.LatLngLiteral>
    ) => {
      state.userLocation = action.payload;
    },

    resetUserSelections: (state) => {
      state.selectedCarId = null;
      state.departureStationId = null;
      state.arrivalStationId = null;
    },
  },
});

export const {
  selectCar,
  selectDepartureStation,
  selectArrivalStation,
  setUserLocation,
  resetUserSelections,
} = userSlice.actions;

// Selectors
export const selectDepartureStationId = (state: RootState) =>
  state.user.departureStationId;
export const selectArrivalStationId = (state: RootState) =>
  state.user.arrivalStationId;
export const selectUserLocation = (state: RootState) =>
  state.user.userLocation;

export default userSlice.reducer;
