// src/store/userSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

/**
 * The userSlice tracks user-specific choices or data:
 * - Which car the user selected
 * - Which station the user selected
 * - The user's current geolocation
 */
interface UserState {
  selectedCarId: number | null;
  selectedStationId: number | null;
  userLocation: google.maps.LatLngLiteral | null;
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
    // The user chooses a car by ID
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },
    // The user chooses a station by ID
    selectStation: (state, action: PayloadAction<number>) => {
      state.selectedStationId = action.payload;
    },
    // Geolocation from the browser or other source
    setUserLocation: (state, action: PayloadAction<google.maps.LatLngLiteral>) => {
      state.userLocation = action.payload;
    },
    // Clear out any user-specific selections
    resetUserSelections: (state) => {
      state.selectedCarId = null;
      state.selectedStationId = null;
      // userLocation remains, or reset here if you'd like
    },
  },
});

export const {
  selectCar,
  selectStation,
  setUserLocation,
  resetUserSelections,
} = userSlice.actions;

export default userSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectSelectedStationId = (state: RootState) => state.user.selectedStationId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
