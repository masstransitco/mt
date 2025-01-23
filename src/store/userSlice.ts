// src/store/userSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface UserState {
  selectedCarId: number | null;              // The car the user selected
  selectedStationId: number | null;          // The station the user selected
  userLocation: google.maps.LatLngLiteral | null; // The user's current location
}

const initialState: UserState = {
  selectedCarId: null,
  selectedStationId: null,
  userLocation: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },
    selectStation: (state, action: PayloadAction<number>) => {
      state.selectedStationId = action.payload;
    },
    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },
    resetBooking: (state) => {
      state.selectedCarId = null;
      state.selectedStationId = null;
      // userLocation remains, but you could reset it here if desired
    },
  },
});

export const {
  selectCar,
  selectStation,
  setUserLocation,
  resetBooking,
} = userSlice.actions;

export default userSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectSelectedStationId = (state: RootState) => state.user.selectedStationId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;