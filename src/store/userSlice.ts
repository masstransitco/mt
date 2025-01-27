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
  selectedStationId: number | null; // allow null to clear the selection
  userLocation: google.maps.LatLngLiteral | null;
}

const initialState: UserState = {
  selectedCarId: null,
  selectedStationId: null,
  userLocation: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    /**
     * The user chooses a car by ID.
     * If you need to allow clearing a car selection,
     * you can also accept number | null here.
     */
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },

    /**
     * The user chooses a station by ID or clears it (by passing null).
     */
    selectStation: (state, action: PayloadAction<number | null>) => {
      state.selectedStationId = action.payload;
    },

    /**
     * Updates the user's geolocation (from the browser or any other source).
     */
    setUserLocation: (
      state,
      action: PayloadAction<google.maps.LatLngLiteral>
    ) => {
      state.userLocation = action.payload;
    },

    /**
     * Clears user selections of car and station.
     * (But leaves userLocation intact, or you can reset it if needed.)
     */
    resetUserSelections: (state) => {
      state.selectedCarId = null;
      state.selectedStationId = null;
      // state.userLocation = null; // Uncomment if you also want to clear location
    },
  },
});

// Export the actions
export const {
  selectCar,
  selectStation,
  setUserLocation,
  resetUserSelections,
} = userSlice.actions;

// Export the reducer for the store
export default userSlice.reducer;

/* --------------------------- Selectors --------------------------- */
export const selectSelectedCarId = (state: RootState) =>
  state.user.selectedCarId;

export const selectSelectedStationId = (state: RootState) =>
  state.user.selectedStationId;

export const selectUserLocation = (state: RootState) =>
  state.user.userLocation;
