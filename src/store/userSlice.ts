import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

interface UserState {
  selectedCarId: number | null;
  departureStationId: number | null;
  arrivalStationId: number | null;
  userLocation: google.maps.LatLngLiteral | null;
  viewState: 'showCar' | 'showMap';  // Added for view state management
}

const initialState: UserState = {
  selectedCarId: null,
  departureStationId: null,
  arrivalStationId: null,
  userLocation: null,
  viewState: 'showCar',  // Default to car view
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    selectCar: (state, action: PayloadAction<number>) => {
      state.selectedCarId = action.payload;
    },
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
    // Add these new actions for station selection flow
    clearDepartureStation: (state) => {
      state.departureStationId = null;
    },
    clearArrivalStation: (state) => {
      state.arrivalStationId = null;
    },
    setViewState: (state, action: PayloadAction<'showCar' | 'showMap'>) => {
      state.viewState = action.payload;
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
  clearDepartureStation,
  clearArrivalStation,
  setViewState,
  resetUserSelections,
} = userSlice.actions;

// Selectors
export const selectSelectedCarId = (state: RootState) => state.user.selectedCarId;
export const selectDepartureStationId = (state: RootState) => state.user.departureStationId;
export const selectArrivalStationId = (state: RootState) => state.user.arrivalStationId;
export const selectUserLocation = (state: RootState) => state.user.userLocation;
export const selectViewState = (state: RootState) => state.user.viewState;

export default userSlice.reducer;
